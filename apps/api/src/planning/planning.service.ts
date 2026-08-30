import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { DecisionService } from '../decision/decision.service';
import { shouldRegenerate } from './regeneration.util';
import { CarryForwardDecision, FixedCommitment, PlanningInput } from './planning.types';
import { Mission, MissionDocument } from './schemas/mission.schema';
import { WeeklyPlan, WeeklyPlanDocument } from './schemas/weekly-plan.schema';

const DEFAULT_PERIODS: Array<'morning' | 'college' | 'after_college' | 'evening' | 'night'> = ['morning', 'college', 'after_college', 'evening', 'night'];

@Injectable()
export class PlanningService {
  constructor(
    @InjectModel(Mission.name) private readonly missions: Model<MissionDocument>,
    @InjectModel(WeeklyPlan.name) private readonly weeklyPlans: Model<WeeklyPlanDocument>,
    @InjectQueue('daily-mission') private readonly dailyMissionQueue: Queue,
    private readonly decisions: DecisionService,
  ) {}

  async generateDailyMission(userId: string, date = new Date(), input: PlanningInput = {}): Promise<MissionDocument> {
    const dateKey = this.dateKey(date);
    const existing = await this.missions.findOne({ userId: new Types.ObjectId(userId), date: dateKey, status: 'active' }).exec();
    if (existing) return existing;
    const decision = await this.decisions.getLatest(userId) ?? await this.decisions.generate(userId);
    return this.createMission(userId, dateKey, decision, input, null, []);
  }

  async replanMission(userId: string, missionId: string, triggerEvent: { type: string; payload?: Record<string, unknown> }, input: PlanningInput = {}): Promise<MissionDocument> {
    const current = await this.missions.findOne({ _id: missionId, userId: new Types.ObjectId(userId) }).exec();
    if (!current) throw new NotFoundException('Mission not found');
    if (!shouldRegenerate(current, triggerEvent)) return current;
    const decision = await this.decisions.generate(userId);
    const carryForwardDecisions = this.buildCarryForwardDecisions(current, input);
    current.status = 'superseded';
    await current.save();
    return this.createMission(userId, current.date, decision, input, current._id, carryForwardDecisions, current.blocks);
  }

  async getMission(userId: string, missionId: string): Promise<MissionDocument> {
    const mission = await this.missions.findOne({ _id: missionId, userId: new Types.ObjectId(userId) }).exec();
    if (!mission) throw new NotFoundException('Mission not found');
    return mission;
  }

  async saveWeeklyPlan(userId: string, weekStartDate: string, emphasizedGoalIds: string[], notes = ''): Promise<WeeklyPlanDocument> {
    return this.weeklyPlans.findOneAndUpdate({ userId: new Types.ObjectId(userId), weekStartDate }, { $set: { emphasizedGoalIds: emphasizedGoalIds.map((id) => new Types.ObjectId(id)), notes } }, { new: true, upsert: true, runValidators: true }).exec();
  }

  async getWeeklyPlan(userId: string, weekStartDate: string): Promise<WeeklyPlanDocument | null> {
    return this.weeklyPlans.findOne({ userId: new Types.ObjectId(userId), weekStartDate }).exec();
  }

  async registerDailyMissionSchedule(userId: string, timezone: string): Promise<void> {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    await this.cancelDailyMissionSchedule(userId);
    await this.dailyMissionQueue.add('daily-mission', { userId }, { jobId: `daily-mission:${userId}`, repeat: { pattern: '0 8 * * *', tz: timezone } });
  }

  async cancelDailyMissionSchedule(userId: string): Promise<void> {
    const jobs = await this.dailyMissionQueue.getRepeatableJobs();
    for (const job of jobs) if (job.name === 'daily-mission' && (job.id === userId || job.id === `daily-mission:${userId}` || job.key.includes(userId))) await this.dailyMissionQueue.removeRepeatableByKey(job.key);
  }

  private async createMission(userId: string, date: string, decision: any, input: PlanningInput, supersedes: Types.ObjectId | null, carryForwardDecisions: Array<{ taskId: Types.ObjectId; action: string; reason: string }>, previousBlocks: any[] = []): Promise<MissionDocument> {
    const priorityList = decision.priorityList ?? [];
    const supportingTaskIds = priorityList.map((item: any) => item.candidateId).filter((id: string) => Types.ObjectId.isValid(id)).slice(0, 3).map((id: string) => new Types.ObjectId(id));
    const fixed = (input.fixedCommitments ?? previousBlocks.filter((block) => block.kind === 'fixed')).map((block: any, index) => ({ id: block.id ?? `fixed-${index}`, taskId: block.taskId ? new Types.ObjectId(block.taskId) : null, title: block.title, kind: 'fixed', period: block.period ?? 'college', startsAt: block.startsAt ?? null, endsAt: block.endsAt ?? null }));
    const periods = input.flexiblePeriods ?? DEFAULT_PERIODS;
    const flexible = priorityList.slice(0, 5).filter((item: any) => Types.ObjectId.isValid(item.candidateId)).map((item: any, index: number) => ({ id: `flexible-${item.candidateId}`, taskId: new Types.ObjectId(item.candidateId), title: item.title, kind: 'flexible', period: periods[index % periods.length] }));
    const top = priorityList[0];
    const mission = await this.missions.create({ userId: new Types.ObjectId(userId), date, objective: top?.title ?? 'Make meaningful progress on today’s priorities', supportingTaskIds, status: 'active', supersedes, decisionId: new Types.ObjectId(decision._id), blocks: [...fixed, ...flexible], focusSessions: [], carryForwardDecisions, createdAt: new Date() });
    if (top && Types.ObjectId.isValid(top.candidateId)) { mission.focusSessions = [{ objective: top.title, durationMinutes: 25, expectedOutcome: top.title, recommendedBreakMinutes: 5, missionId: mission._id } as any]; await mission.save(); }
    return mission;
  }

  private buildCarryForwardDecisions(current: MissionDocument, input: PlanningInput): Array<{ taskId: Types.ObjectId; action: string; reason: string }> {
    const unfinished = input.unfinishedTaskIds ?? current.supportingTaskIds.map((id) => id.toString());
    return unfinished.map((taskId) => { const choice = input.carryForward?.[taskId] ?? { action: 'carried' as const, reason: 'Unfinished work was explicitly carried forward for reassessment.' }; return { taskId: new Types.ObjectId(taskId), action: choice.action, reason: choice.reason }; });
  }

  private dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
}
