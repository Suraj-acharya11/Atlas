import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { DecisionService } from '../decision/decision.service';
import { NotificationService } from '../notification/notification.service';
import { shouldRegenerate } from './regeneration.util';
import { CarryForwardDecision, FixedCommitment, PlanningInput } from './planning.types';
import { Mission, MissionDocument } from './schemas/mission.schema';
import { WeeklyPlan, WeeklyPlanDocument } from './schemas/weekly-plan.schema';

const DEFAULT_PERIODS: Array<'morning' | 'college' | 'after_college' | 'evening' | 'night'> = ['morning', 'college', 'after_college', 'evening', 'night'];

const PERIOD_WINDOWS: Record<string, { start: number; end: number }> = {
  morning: { start: 9 * 60, end: 11 * 60 + 30 }, // 09:00 - 11:30
  college: { start: 11 * 60 + 30, end: 16 * 60 }, // 11:30 - 16:00
  after_college: { start: 16 * 60, end: 18 * 60 }, // 16:00 - 18:00
  evening: { start: 18 * 60, end: 21 * 60 }, // 18:00 - 21:00
  night: { start: 21 * 60, end: 23 * 60 }, // 21:00 - 23:00
};

const DEFAULT_BLOCK_DURATION_MINUTES = 25;
const DEFAULT_BUFFER_MINUTES = 10;

function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, minutes) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function scheduleFlexibleBlocks(
  flexibleBlocks: Array<{ id: string; taskId: Types.ObjectId; title: string; kind: string; period: string; durationMinutes?: number }>,
  fixedBlocks: Array<{ period?: string; startsAt?: string | null; endsAt?: string | null }>,
  options: { minStartMinutes?: number } = {},
) {
  const occupiedByPeriod: Record<string, Array<{ start: number; end: number }>> = {};

  for (const period of DEFAULT_PERIODS) {
    occupiedByPeriod[period] = [];
  }

  for (const fb of fixedBlocks) {
    const period = fb.period ?? 'college';
    const s = timeToMinutes(fb.startsAt);
    const e = timeToMinutes(fb.endsAt);
    if (s !== null && e !== null && s < e) {
      if (!occupiedByPeriod[period]) occupiedByPeriod[period] = [];
      occupiedByPeriod[period].push({ start: s, end: e });
    }
  }

  for (const period of Object.keys(occupiedByPeriod)) {
    occupiedByPeriod[period].sort((a, b) => a.start - b.start);
  }

  return flexibleBlocks.map((block) => {
    const period = block.period;
    const window = PERIOD_WINDOWS[period] ?? { start: 9 * 60, end: 17 * 60 };
    const occupied = occupiedByPeriod[period] ?? [];

    let candidateStart = window.start;
    if (options.minStartMinutes && options.minStartMinutes > window.start && options.minStartMinutes < window.end) {
      candidateStart = Math.max(window.start, options.minStartMinutes);
    }
    const duration = typeof (block as any).durationMinutes === 'number' && (block as any).durationMinutes > 0
      ? (block as any).durationMinutes
      : DEFAULT_BLOCK_DURATION_MINUTES;
    const buffer = DEFAULT_BUFFER_MINUTES;

    let hasConflict = true;
    while (hasConflict) {
      hasConflict = false;
      const candidateEnd = candidateStart + duration;
      for (const occ of occupied) {
        const overlaps = candidateStart < occ.end && candidateEnd > occ.start;
        const insufficientBufferBefore = candidateEnd > occ.start && candidateStart < occ.start;
        if (overlaps || insufficientBufferBefore) {
          candidateStart = occ.end + buffer;
          hasConflict = true;
          break;
        }
      }
    }

    const candidateEnd = candidateStart + duration;
    if (!occupiedByPeriod[period]) occupiedByPeriod[period] = [];
    occupiedByPeriod[period].push({ start: candidateStart, end: candidateEnd });
    occupiedByPeriod[period].sort((a, b) => a.start - b.start);

    return {
      ...block,
      startsAt: minutesToTime(candidateStart),
      endsAt: minutesToTime(candidateEnd),
    };
  });
}

@Injectable()
export class PlanningService {
  constructor(
    @InjectModel(Mission.name) private readonly missions: Model<MissionDocument>,
    @InjectModel(WeeklyPlan.name) private readonly weeklyPlans: Model<WeeklyPlanDocument>,
    @InjectQueue('daily-mission') private readonly dailyMissionQueue: Queue,
    private readonly decisions: DecisionService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async generateDailyMission(userId: string, date = new Date(), input: PlanningInput = {}): Promise<MissionDocument> {
    const dateKey = this.dateKey(date);
    const existing = await this.missions.findOne({ userId: new Types.ObjectId(userId), date: dateKey, status: 'active' }).exec();
    if (existing) {
      this.notifications?.checkDeadlineNotifications(userId).catch(() => {});
      return existing;
    }
    const decision = await this.decisions.getLatest(userId) ?? await this.decisions.generate(userId);
    const mission = await this.createMission(userId, dateKey, decision, input, null, []);
    this.notifications?.checkDeadlineNotifications(userId).catch(() => {});
    return mission;
  }

  async replanMission(userId: string, missionId: string, triggerEvent: { type: string; payload?: Record<string, unknown> }, input: PlanningInput = {}): Promise<MissionDocument> {
    const current = await this.missions.findOne({ _id: missionId, userId: new Types.ObjectId(userId) }).exec();
    if (!current) throw new NotFoundException('Mission not found');
    if (!shouldRegenerate(current, triggerEvent)) return current;

    const now = (input as any).currentTime ? new Date((input as any).currentTime) : new Date();
    const isToday = current.date === this.dateKey(now);
    const minStartMinutes = isToday
      ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 5) / 15) * 15
      : undefined;

    const decision = await this.decisions.generate(userId, { now });
    const carryForwardDecisions = this.buildCarryForwardDecisions(current, input);
    current.status = 'superseded';
    await current.save();
    return this.createMission(
      userId,
      current.date,
      decision,
      input,
      current._id,
      carryForwardDecisions,
      current.blocks,
      { minStartMinutes, isReplan: true },
    );
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

  private async createMission(
    userId: string,
    date: string,
    decision: any,
    input: PlanningInput,
    supersedes: Types.ObjectId | null,
    carryForwardDecisions: Array<{ taskId: Types.ObjectId; action: string; reason: string }>,
    previousBlocks: any[] = [],
    options: { minStartMinutes?: number; isReplan?: boolean } = {},
  ): Promise<MissionDocument> {
    let priorityList = [...(decision.priorityList ?? [])];

    // When replanning, if the user requested a schedule change or was unavailable,
    // re-sequence tasks relative to the previous timetable so the primary focus and blocks adapt
    const prevFlexible = previousBlocks.filter((block) => block.kind === 'flexible');
    const prevPrimaryTaskId = prevFlexible[0]?.taskId?.toString();
    if (options.isReplan && prevPrimaryTaskId && priorityList.length > 1) {
      if (priorityList[0]?.candidateId === prevPrimaryTaskId) {
        priorityList = [priorityList[1], priorityList[0], ...priorityList.slice(2)];
      }
    }

    const supportingTaskIds = priorityList
      .map((item: any) => item.candidateId)
      .filter((id: string) => Types.ObjectId.isValid(id))
      .slice(0, 3)
      .map((id: string) => new Types.ObjectId(id));

    const fixed = (input.fixedCommitments ?? previousBlocks.filter((block) => block.kind === 'fixed')).map((block: any, index) => ({
      id: block.id ?? `fixed-${index}`,
      taskId: block.taskId ? new Types.ObjectId(block.taskId) : null,
      title: block.title,
      kind: 'fixed',
      period: block.period ?? 'college',
      startsAt: block.startsAt ?? null,
      endsAt: block.endsAt ?? null,
    }));

    let periods = input.flexiblePeriods ?? DEFAULT_PERIODS;
    if (options.minStartMinutes && options.minStartMinutes >= 540) {
      const active = DEFAULT_PERIODS.filter((p) => {
        const w = PERIOD_WINDOWS[p];
        return w && w.end > options.minStartMinutes!;
      });
      if (active.length > 0) {
        periods = active;
      }
    }

    const rawFlexible = priorityList
      .slice(0, 5)
      .filter((item: any) => Types.ObjectId.isValid(item.candidateId))
      .map((item: any, index: number) => ({
        id: `flexible-${item.candidateId}`,
        taskId: new Types.ObjectId(item.candidateId),
        title: item.title,
        kind: 'flexible',
        period: periods[index % periods.length],
        durationMinutes: typeof item.estimatedDurationMinutes === 'number' && item.estimatedDurationMinutes > 0 ? item.estimatedDurationMinutes : DEFAULT_BLOCK_DURATION_MINUTES,
      }));

    const flexible = scheduleFlexibleBlocks(rawFlexible, fixed, { minStartMinutes: options.minStartMinutes });
    const top = priorityList[0];
    const mission = await this.missions.create({
      userId: new Types.ObjectId(userId),
      date,
      objective: top?.title ?? 'Make meaningful progress on today’s priorities',
      supportingTaskIds,
      status: 'active',
      supersedes,
      decisionId: new Types.ObjectId(decision._id),
      blocks: [...fixed, ...flexible],
      focusSessions: [],
      carryForwardDecisions,
      createdAt: new Date(),
    });

    if (top && Types.ObjectId.isValid(top.candidateId)) {
      mission.focusSessions = [
        {
          objective: top.title,
          durationMinutes: 25,
          expectedOutcome: top.title,
          recommendedBreakMinutes: 5,
          missionId: mission._id,
        } as any,
      ];
      await mission.save();
    }
    return mission;
  }

  private buildCarryForwardDecisions(current: MissionDocument, input: PlanningInput): Array<{ taskId: Types.ObjectId; action: string; reason: string }> {
    const unfinished = input.unfinishedTaskIds ?? current.supportingTaskIds.map((id) => id.toString());
    return unfinished.map((taskId) => { const choice = input.carryForward?.[taskId] ?? { action: 'carried' as const, reason: 'Unfinished work was explicitly carried forward for reassessment.' }; return { taskId: new Types.ObjectId(taskId), action: choice.action, reason: choice.reason }; });
  }

  private dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
}
