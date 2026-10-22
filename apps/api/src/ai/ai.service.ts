import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { AI_CACHE, AI_PROVIDER } from './ai.tokens';
import { AiChatResultData, AiProvider, AiResult, AiResponse, RoutedUpdatePiece, WorkAnalysis } from './ai.types';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { seedInitialPersonalization } from '../knowledge/initial-personalization.seed';

const WORK_ANALYSIS_SCHEMA = { subject: 'string', workType: 'string', topics: ['string'], sections: ['string'], explicitRequirements: ['string'], explicitPrerequisites: ['string'], complexityIndicator: ['low|moderate|high|uncertain'], estimatedGenericEffort: "uncertain|{value:number,unit:string}" };

function formatKnowledgeGuidance(relationship: { predicate: string; object: string }): string | null {
  switch (relationship.predicate) {
    case 'prefers_strict_feedback':
      return 'The user prefers direct, blunt, and realistic evaluation over reassurance or praise. Highlight weaknesses and risks first; avoid unearned softeners.';
    case 'prefers_actionable_guidance':
      return 'The user prefers concrete next actions and exact steps before abstract theory.';
    case 'values_practical_competence':
      return 'The user values practical competence and runnable, working solutions over descriptive summaries.';
    case 'challenges_canonical_solutions':
      return 'When presenting textbook or standard solutions, explain why they are preferred and compare trade-offs with alternatives.';
    case 'learns_by_constructing_first':
      return 'The user learns by building/trying first; engage with their specific attempts and outputs directly.';
    case 'prefers_minimal_complexity':
      return 'Prefer the simplest viable architecture or design; avoid introducing complexity for its own sake.';
    case 'sensitive_to_omissions':
      return 'Be thorough with stated constraints; confirm all constraints are considered.';
    default:
      return null;
  }
}

import { DecisionService } from '../decision/decision.service';
import { PlanningService } from '../planning/planning.service';
import { GoalService } from '../goal/goal.service';
import { ProjectService } from '../project/project.service';
import { TaskService } from '../task/task.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(AI_CACHE) private readonly cache: Redis,
    @Optional() private readonly knowledge?: KnowledgeService,
    @Optional() private readonly decisionService?: DecisionService,
    @Optional() private readonly planningService?: PlanningService,
    @Optional() private readonly goalService?: GoalService,
    @Optional() private readonly projectService?: ProjectService,
    @Optional() private readonly taskService?: TaskService,
  ) {}

  async generate(prompt: string, context: Record<string, unknown> = {}, userId?: string): Promise<AiResult<AiChatResultData>> {
    try {
      let personalizationSection = '';
      let decisionSection = '';
      let planSection = '';
      let entitiesSection = '';
      let conversationHistorySection = '';

      if (userId && this.knowledge) {
        try {
          // Idempotent fallback: verify if initial personalization exists for this user
          const existingSeed = await this.knowledge.query(userId, {
            predicate: 'prefers_strict_feedback',
            subject: 'user',
          });

          if (existingSeed.length === 0) {
            await seedInitialPersonalization(this.knowledge, userId);
          }

          const activeKnowledge = await this.knowledge.query(userId, { status: 'active' });
          const relevant = activeKnowledge
            .filter((k) => k.category === 'preference' || k.category === 'behavioral_pattern')
            .slice(0, 7);
          const points = relevant.map(formatKnowledgeGuidance).filter((p): p is string => Boolean(p));
          if (points.length > 0) {
            personalizationSection = `\n\nLearned User Preferences & Behavioral Context (Guidance only — any direct instruction in the user's current message ALWAYS takes absolute precedence):\n${points.map((p) => `- ${p}`).join('\n')}\nNever mention internal metrics, scores, technical predicates, database records, or reference that you are reading from a knowledge base. Be completely natural.`;
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch active knowledge for AI context: ${err}`);
        }
      }

      if (userId && this.decisionService) {
        try {
          const latest = await this.decisionService.getLatest(userId);
          if (latest && latest.priorityList?.[0]) {
            const top = latest.priorityList[0];
            const factors = (top.factors ?? [])
              .map((f) => `${f.key} (raw ${f.rawValue}, weighted ${f.weightedValue.toFixed(1)})`)
              .join(', ');
            decisionSection = `\n\nLatest Decision Engine Recommendation for this user:
- Current Top Recommendation: "${top.title}" (Score: ${top.score.toFixed(1)}, Confidence: ${latest.confidenceLabel})
- Decision Explanation: ${top.explanation}
- Active Decision Factors: ${factors || 'Standard goal alignment'}
When the user asks "Why this recommendation?", explain the real Decision Engine factors above (e.g. deadline urgency, active goal alignment, learned knowledge support, energy fit) clearly and directly. Do not give generic productivity advice.`;
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch latest decision for AI context: ${err}`);
        }
      }

      if (userId && this.planningService) {
        try {
          const mission = await this.planningService.generateDailyMission(userId).catch(() => null);
          if (mission && mission.blocks?.length) {
            const blocksSummary = mission.blocks
              .slice(0, 5)
              .map((b) => `${b.startsAt || 'flexible'}-${b.endsAt || ''} ${b.title}`)
              .join(', ');
            planSection = `\n\nToday's Scheduled Timetable (Planning Engine):
- Objective: "${mission.objective || 'Focus'}"
- Scheduled Blocks: ${blocksSummary}
When the user asks to "Update my plan" or rearrange their timetable, reference their actual scheduled blocks and propose REQUEST_REPLAN with an appropriate reason.`;
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch today's mission for AI context: ${err}`);
        }
      }

      if (userId) {
        try {
          const [goals, projects, tasks] = await Promise.all([
            this.goalService?.findAll(userId).catch(() => []) ?? [],
            this.projectService?.findAll(userId).catch(() => []) ?? [],
            this.taskService?.findAll(userId).catch(() => []) ?? [],
          ]);

          const activeGoals = (goals || []).filter((g: any) => g.status !== 'completed' && g.status !== 'archived');
          const activeProjects = (projects || []).filter((p: any) => p.status !== 'completed' && p.status !== 'archived');
          const pendingTasks = (tasks || []).filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled');

          const goalMap = new Map((goals || []).map((g: any) => [String(g._id), g.title]));
          const projectMap = new Map((projects || []).map((p: any) => [String(p._id), p.title]));

          const goalsText = activeGoals.length > 0
            ? activeGoals.map((g: any) => `- "${g.title}" (${g.status || 'active'}${g.description ? `: ${g.description}` : ''})`).join('\n')
            : 'None';

          const projectsText = activeProjects.length > 0
            ? activeProjects.map((p: any) => {
                const linked = (p.goalIds || []).map((gid: any) => goalMap.get(String(gid))).filter(Boolean);
                const linkStr = linked.length ? ` [advances goal: ${linked.join(', ')}]` : '';
                return `- "${p.title}" (${p.status || 'active'})${linkStr}`;
              }).join('\n')
            : 'None';

          const tasksText = pendingTasks.length > 0
            ? pendingTasks.slice(0, 20).map((t: any) => {
                const projTitle = t.projectId ? projectMap.get(String(t.projectId)) : null;
                const projStr = projTitle ? ` [project: "${projTitle}"]` : '';
                const dlStr = t.deadline ? ` (deadline: ${new Date(t.deadline).toISOString().split('T')[0]})` : ' (no deadline)';
                const prioStr = t.priority ? ` [priority: ${t.priority}]` : '';
                const durStr = t.estimatedDurationMinutes ? ` [${t.estimatedDurationMinutes}m]` : '';
                return `- "${t.title}"${prioStr}${durStr}${dlStr}${projStr}`;
              }).join('\n')
            : 'None';

          entitiesSection = `\n\nUser Data & Current Entities:
Active Goals:
${goalsText}

Active Projects:
${projectsText}

Pending Tasks:
${tasksText}

Ground all answers in the actual user data above. When asked about projects, tasks, deadlines, or recommendations, reference their exact titles, deadlines, and priorities. Never fabricate projects, goals, or tasks.`;
        } catch (err) {
          this.logger.warn(`Failed to fetch entities for AI context: ${err}`);
        }
      }

      const historyList = (context.history || context.recentMessages) as Array<{ from: string; text: string }> | undefined;
      if (Array.isArray(historyList) && historyList.length > 0) {
        conversationHistorySection = `\n\nRecent Conversation History:\n${historyList.slice(-6).map((m) => `${m.from === 'you' || m.from === 'user' ? 'User' : 'ATLAS'}: ${m.text}`).join('\n')}`;
      }

      // First, attempt to extract intent for supported V1 actions if user is expressing an actionable intent
      const systemInstruction = `You are ATLAS AI, a focused personal life operating system assistant.
You can answer user questions conversationally, OR propose one of three bounded actions:
1. CREATE_TASK: when the user explicitly wants to add, create, or schedule a task. Must have a clear title. Parameters: { title: string, deadline: string ISO or null, priority: 'low'|'medium'|'high'|'urgent' or null, estimatedDurationMinutes: number or null, projectId: string or null matching one of the user's active projects if mentioned }.
2. CREATE_GOAL: when the user explicitly wants to add or set a goal. Must have a clear title. Parameters: { title: string, description: string or null }.
3. REQUEST_REPLAN: when the user explicitly asks to replan, recompute, or rearrange their day or timetable. Parameters: { reason: string }.

Rules:
- If the user request is conversational or asks a question, set action to null.
- If information is missing or ambiguous (e.g. "add assignment" without details), set action to null and ask for clarification in text.
- If proposing an action, set confirmationMessage explaining clearly what will happen.
- All actions require user confirmation.
- Output JSON format matching the schema.${personalizationSection}${decisionSection}${planSection}${entitiesSection}${conversationHistorySection}`;

      const structuredSchema = {
        text: 'string (conversational reply or explanation of proposal)',
        action: {
          type: 'CREATE_TASK|CREATE_GOAL|REQUEST_REPLAN|null',
          parameters: {
            title: 'string or null',
            deadline: 'string ISO or null',
            description: 'string or null',
            reason: 'string or null',
            priority: 'low|medium|high|urgent|null',
            estimatedDurationMinutes: 'number or null',
            projectId: 'string or null',
          },
          confirmationMessage: 'string or null',
        },
      };

      const extracted = await this.provider.extractStructured(
        `${systemInstruction}\nUser message: "${prompt}"`,
        structuredSchema,
        context,
      );

      const parsed = extracted as any;
      if (parsed && typeof parsed.text === 'string') {
        const actionType = parsed.action?.type;
        if (actionType === 'CREATE_TASK' && parsed.action?.parameters?.title) {
          const params = parsed.action.parameters;
          const validPriorities = ['low', 'medium', 'high', 'urgent'];
          const priority = validPriorities.includes(params.priority) ? params.priority : 'medium';
          const duration = typeof params.estimatedDurationMinutes === 'number' && params.estimatedDurationMinutes > 0
            ? params.estimatedDurationMinutes
            : undefined;
          return {
            ok: true,
            data: {
              text: parsed.text,
              action: {
                type: 'CREATE_TASK',
                parameters: {
                  title: String(params.title).trim(),
                  deadline: params.deadline ? String(params.deadline) : null,
                  priority,
                  estimatedDurationMinutes: duration,
                  projectId: params.projectId ? String(params.projectId) : undefined,
                },
                requiresConfirmation: true,
                confirmationMessage: parsed.action.confirmationMessage || `Create task "${params.title}"?`,
              },
            },
          };
        }

        if (actionType === 'CREATE_GOAL' && parsed.action?.parameters?.title) {
          return {
            ok: true,
            data: {
              text: parsed.text,
              action: {
                type: 'CREATE_GOAL',
                parameters: {
                  title: String(parsed.action.parameters.title).trim(),
                  description: parsed.action.parameters.description ? String(parsed.action.parameters.description).trim() : undefined,
                },
                requiresConfirmation: true,
                confirmationMessage: parsed.action.confirmationMessage || `Set new goal "${parsed.action.parameters.title}"?`,
              },
            },
          };
        }

        if (actionType === 'REQUEST_REPLAN') {
          return {
            ok: true,
            data: {
              text: parsed.text,
              action: {
                type: 'REQUEST_REPLAN',
                parameters: {
                  reason: parsed.action.parameters?.reason ? String(parsed.action.parameters.reason) : 'User requested day replanning',
                },
                requiresConfirmation: true,
                confirmationMessage: parsed.action.confirmationMessage || 'Replan today’s timetable using your latest priorities?',
              },
            },
          };
        }

        return {
          ok: true,
          data: {
            text: parsed.text,
            action: null,
          },
        };
      }

      // Fallback to simple text generation if structured extraction returns unexpected format
      const raw = await this.provider.generate(prompt, context);
      return { ok: true, data: { text: raw.text, action: null, raw } };
    } catch (error) {
      this.logger.error(`generate failed: ${error instanceof Error ? error.message : error}`);
      return { ok: false, reason: 'AI_UNAVAILABLE' };
    }
  }

  async extractStructured(prompt: string, schema: object, context: Record<string, unknown> = {}): Promise<AiResult<object>> {
    try {
      return { ok: true, data: await this.provider.extractStructured(prompt, schema, context) };
    } catch (error) {
      this.logger.error(`extractStructured failed: ${error instanceof Error ? error.message : error}`);
      return { ok: false, reason: 'AI_UNAVAILABLE' };
    }
  }

  async analyzeWork(requestId: string, subject: string, context: Record<string, unknown> = {}): Promise<AiResult<WorkAnalysis>> {
    const cached = await this.cache.get(this.cacheKey(requestId));
    if (cached) return { ok: true, data: JSON.parse(cached) as WorkAnalysis };
    const result = await this.extractStructured('Analyze this work generically. Never estimate personalized duration and use "uncertain" when evidence is missing.', WORK_ANALYSIS_SCHEMA, { ...context, subject });
    if (!result.ok) return result;
    const analysis = this.normalizeWorkAnalysis(result.data, subject);
    await this.cache.setex(this.cacheKey(requestId), 7200, JSON.stringify(analysis));
    return { ok: true, data: analysis };
  }

  async interpretUserUpdate(message: string, context: Record<string, unknown> = {}): Promise<AiResult<RoutedUpdatePiece[]>> {
    const result = await this.extractStructured('Split this user update into separate routed pieces. Do not merge unrelated topics. Mark uncertain pieces explicitly.', { pieces: [{ kind: 'time_constraint|current_state|preference|other', content: 'string', confidence: 'certain|uncertain' }] }, { ...context, message });
    if (!result.ok) return result;
    const pieces = Array.isArray((result.data as any).pieces) ? (result.data as any).pieces : [];
    return { ok: true, data: pieces.map((piece: any) => ({ kind: ['time_constraint', 'current_state', 'preference', 'other'].includes(piece.kind) ? piece.kind : 'other', content: typeof piece.content === 'string' ? piece.content : 'uncertain', confidence: piece.confidence === 'certain' ? 'certain' : 'uncertain' })) };
  }

  private normalizeWorkAnalysis(value: object, subject: string): WorkAnalysis {
    const data = value as Partial<WorkAnalysis>;
    const complexity = ['low', 'moderate', 'high', 'uncertain'].includes(data.complexityIndicator ?? '') ? data.complexityIndicator! : 'uncertain';
    const effort = data.estimatedGenericEffort && data.estimatedGenericEffort !== 'uncertain' && typeof data.estimatedGenericEffort === 'object' && typeof data.estimatedGenericEffort.value === 'number' && typeof data.estimatedGenericEffort.unit === 'string' ? data.estimatedGenericEffort : 'uncertain';
    return { subject: data.subject || subject, workType: data.workType || 'uncertain', topics: Array.isArray(data.topics) ? data.topics : [], sections: Array.isArray(data.sections) ? data.sections : [], explicitRequirements: Array.isArray(data.explicitRequirements) ? data.explicitRequirements : [], explicitPrerequisites: Array.isArray(data.explicitPrerequisites) ? data.explicitPrerequisites : [], complexityIndicator: complexity as WorkAnalysis['complexityIndicator'], estimatedGenericEffort: effort };
  }
  private cacheKey(requestId: string): string { return `ai:work-analysis:${requestId}`; }
}
