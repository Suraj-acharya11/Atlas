import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { GoalService } from '../goal/goal.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MlService } from '../ml/ml.service';
import { ProjectService } from '../project/project.service';
import { TaskService } from '../task/task.service';
import { DECISION_FACTORS } from './decision.tokens';
import { DecisionCandidate, DecisionContext, DecisionFactor, DecisionConfidenceLabel, FactorBreakdown } from './decision.types';
import { Decision, DecisionDocument } from './schemas/decision.schema';
import { WEIGHTS, selectWeightProfile } from './weights.config';

export type RejectionReason = 'too_tired' | 'no_time' | 'already_completed' | 'wrong_recommendation' | 'not_interested' | 'other';

@Injectable()
export class DecisionService {
  constructor(
    @InjectModel(Decision.name) private readonly model: Model<DecisionDocument>,
    @Inject(DECISION_FACTORS) private readonly factors: DecisionFactor[],
    private readonly tasks: TaskService,
    private readonly projects: ProjectService,
    private readonly goals: GoalService,
    private readonly knowledge: KnowledgeService,
    private readonly ml: MlService,
    private readonly events: EventService,
  ) {}

  async generate(userId: string, context: DecisionContext = {}): Promise<DecisionDocument> {
    const candidates = await this.generateCandidates(userId, context);
    const activeKnowledge = await this.knowledge.query(userId, { status: 'active' });
    const enriched = candidates.map((candidate) => ({ ...candidate, knowledgeConfidence: activeKnowledge.reduce((max, item) => Math.max(max, item.confidence), 0) }));
    const scored = await this.scoreCandidates(enriched, context);
    const missingInputs = this.missingInputs(enriched, context);
    const confidence = Math.max(0, 100 - missingInputs.length * 25);
    const confidenceLabel = this.confidenceLabel(confidence);
    const priorityList = scored.map((item) => ({ ...item, confidence, confidenceLabel, explanation: this.explanation(item, scored[0], scored[1], confidenceLabel) }));
    const top = priorityList[0];
    const decision = await this.model.create({
      userId: new Types.ObjectId(userId),
      weightProfile: scored.profile,
      confidence,
      confidenceLabel,
      missingInputs,
      priorityList,
      topCandidateId: top?.candidateId ?? '',
      topExplanation: top?.explanation ?? 'No eligible candidates are available.',
      warnings: this.warnings(enriched),
      suggestedFocusSession: top && !enriched.find((candidate) => candidate.id === top.candidateId)?.isRecovery ? { objective: top.title, durationMinutes: enriched.find((candidate) => candidate.id === top.candidateId)?.estimatedDurationMinutes ?? 25, expectedOutcome: top.title, recommendedBreakMinutes: 5 } : null,
      suggestedBreak: top && enriched.find((candidate) => candidate.id === top.candidateId)?.isRecovery ? { objective: top.title, durationMinutes: enriched.find((candidate) => candidate.id === top.candidateId)?.estimatedDurationMinutes ?? 10, expectedOutcome: 'Recover capacity before the next decision', recommendedBreakMinutes: 0 } : null,
      adaptiveChallenge: top ? `Make a concrete start on ${top.title}.` : null,
      rejections: [],
    });
    return decision;
  }

  async scoreCandidates(candidates: DecisionCandidate[], context: DecisionContext): Promise<(Array<DecisionCandidateResult> & { profile: keyof typeof WEIGHTS })> {
    const raw = candidates.map((candidate) => ({ candidate, values: this.factors.map((factor) => ({ key: factor.key, rawValue: Math.max(0, Math.min(100, factor.evaluate(candidate, context))) })) }));
    const profile = selectWeightProfile(raw.map((item) => ({ ...item.candidate, deadlineUrgency: item.values.find((value) => value.key === 'deadlineUrgency')?.rawValue ?? 0 })));
    const weights = WEIGHTS[profile];
    const scored = [] as Array<DecisionCandidateResult>;
    for (const item of raw) {
      const factors: FactorBreakdown[] = item.values.map((value) => ({ key: value.key, rawValue: value.rawValue, weight: weights[value.key as keyof typeof weights] ?? 0, weightedValue: value.rawValue * (weights[value.key as keyof typeof weights] ?? 0) }));
      const deterministicScore = factors.reduce((total, factor) => total + factor.weightedValue, 0);
      const adjustmentResult = await this.ml.getAdjustment(item.candidate, context);
      // The ML branch is intentionally exercised even though V1 always returns unreliable output.
      const score = adjustmentResult.reliable ? deterministicScore + adjustmentResult.adjustment : deterministicScore;
      scored.push({ candidateId: item.candidate.id, title: item.candidate.title, score, confidence: 0, confidenceLabel: 'low', explanation: '', factors });
    }
    scored.sort((a, b) => b.score - a.score);
    Object.defineProperty(scored, 'profile', { value: profile, enumerable: false });
    return scored as Array<DecisionCandidateResult> & { profile: keyof typeof WEIGHTS };
  }

  async findById(id: string, userId?: string): Promise<DecisionDocument> {
    const decision = await this.model.findById(id).exec();
    if (!decision || (userId && decision.userId.toString() !== userId)) throw new NotFoundException('Decision not found');
    return decision;
  }
  async getLatest(userId: string): Promise<DecisionDocument | null> {
    return this.model.findOne({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async recordRejection(decisionId: string, reason: RejectionReason, userId?: string): Promise<{ decisionId: string; reason: RejectionReason; consequenceExplanation: string | null }> {
    const valid: RejectionReason[] = ['too_tired', 'no_time', 'already_completed', 'wrong_recommendation', 'not_interested', 'other'];
    if (!valid.includes(reason)) throw new NotFoundException('Invalid rejection reason');
    const decision = await this.findById(decisionId, userId);
    const alreadyExplained = decision.rejections.some((rejection) => rejection.reason === reason && rejection.consequenceExplained);
    decision.rejections.push({ reason, consequenceExplained: !alreadyExplained, recordedAt: new Date() } as never);
    await decision.save();
    await this.events.record({ type: 'RECOMMENDATION_REJECTED', userId: decision.userId.toString(), payload: { decisionId, reason } });
    return { decisionId, reason, consequenceExplanation: alreadyExplained ? null : 'Choosing this action may delay the highest-ranked recommendation.' };
  }

  private async generateCandidates(userId: string, context: DecisionContext): Promise<DecisionCandidate[]> {
    const [tasks, projects, goals] = await Promise.all([this.tasks.findAll(userId), this.projects.findAll(userId), this.goals.findAll(userId)]);
    const goalMap = new Map(goals.map((goal: any) => [goal._id.toString(), goal]));
    const projectMap = new Map(projects.map((project: any) => [project._id.toString(), project]));
    const taskCandidates = tasks.filter((task: any) => !['completed', 'cancelled'].includes(task.status)).map((task: any) => {
      const project = task.projectId ? projectMap.get(task.projectId.toString()) : undefined;
      const activeGoalIds = (project?.goalIds ?? []).map((id: Types.ObjectId) => goalMap.get(id.toString())).filter((goal: any) => goal?.status === 'active').map((goal: any) => goal._id.toString());
      return { id: task._id.toString(), title: task.title, projectId: task.projectId?.toString() ?? null, activeGoalIds, deadline: task.deadline, estimatedDurationMinutes: null, difficulty: null };
    });
    return context.recoveryCandidate ? [...taskCandidates, context.recoveryCandidate] : taskCandidates;
  }

  private missingInputs(candidates: DecisionCandidate[], context: DecisionContext): string[] {
    const missing: string[] = [];
    if (context.energy == null) missing.push('energy context');
    if (context.availableMinutes == null) missing.push('available time');
    if (!context.primaryGoalId) missing.push('primary goal');
    if (candidates.length > 0 && candidates.every((candidate) => !candidate.deadline)) missing.push('deadline context');
    return missing;
  }

  private confidenceLabel(value: number): DecisionConfidenceLabel { return value < 50 ? 'low' : value < 80 ? 'moderate' : 'high'; }
  private explanation(item: DecisionCandidateResult, top: DecisionCandidateResult | undefined, second: DecisionCandidateResult | undefined, label: DecisionConfidenceLabel): string {
    const factors = item.factors.map((factor) => `${factor.key}=${factor.rawValue}`).join(', ');
    const tie = top && second && top.candidateId === item.candidateId && Math.abs(top.score - second.score) <= 5 ? ' Both are strong choices; this recommendation is only slightly ahead.' : '';
    return `Score ${item.score.toFixed(2)} from stored factors (${factors}); confidence: ${label}.${tie}`;
  }
  private warnings(candidates: DecisionCandidate[]): string[] { return candidates.filter((candidate) => candidate.deadline && candidate.deadline.getTime() < Date.now() + 86_400_000).map((candidate) => `${candidate.title} has an approaching deadline.`); }
}

type DecisionCandidateResult = { candidateId: string; title: string; score: number; confidence: number; confidenceLabel: DecisionConfidenceLabel; explanation: string; factors: FactorBreakdown[] };
