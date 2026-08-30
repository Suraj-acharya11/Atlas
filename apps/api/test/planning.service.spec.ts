import { Types } from 'mongoose';
import { PlanningService } from '../src/planning/planning.service';

const userId = '507f1f77bcf86cd799439011';
const decision = { _id: new Types.ObjectId(), priorityList: [{ candidateId: new Types.ObjectId().toHexString(), title: 'Priority task' }] };

describe('PlanningService Phase 5', () => {
  it('keeps an existing active daily Mission stable', async () => {
    const existing = { id: 'mission-1' };
    const missions: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }) };
    const decisions: any = { getLatest: jest.fn() };
    const service = new PlanningService(missions, {} as any, {} as any, decisions);
    expect(await service.generateDailyMission(userId, new Date('2026-01-05T12:00:00Z'))).toBe(existing);
    expect(decisions.getLatest).not.toHaveBeenCalled();
  });

  it('supersedes a mission while preserving fixed blocks and recording carry-forward choices', async () => {
    const oldId = new Types.ObjectId();
    const fixed = { id: 'meeting-1', title: 'Class', kind: 'fixed', period: 'college', startsAt: '10:00', endsAt: '11:00' };
    const current: any = { _id: oldId, date: '2026-01-05', supportingTaskIds: [new Types.ObjectId()], blocks: [fixed], status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    const created: any = { _id: new Types.ObjectId(), focusSessions: [], save: jest.fn().mockResolvedValue(undefined) };
    const missions: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(current) }), create: jest.fn().mockResolvedValue(created) };
    const decisions: any = { generate: jest.fn().mockResolvedValue(decision) };
    const service = new PlanningService(missions, {} as any, {} as any, decisions);
    const result = await service.replanMission(userId, oldId.toHexString(), { type: 'TASK_DEADLINE_CHANGED' }, { unfinishedTaskIds: [current.supportingTaskIds[0].toHexString()], carryForward: { [current.supportingTaskIds[0].toHexString()]: { action: 'reprioritized', reason: 'Fresh priority evaluation required.' } } });
    expect(current.status).toBe('superseded');
    expect(created).toBe(result);
    expect(missions.create).toHaveBeenCalledWith(expect.objectContaining({ supersedes: oldId, carryForwardDecisions: [expect.objectContaining({ action: 'reprioritized', reason: 'Fresh priority evaluation required.' })], blocks: expect.arrayContaining([expect.objectContaining({ id: 'meeting-1', title: 'Class', kind: 'fixed', startsAt: '10:00', endsAt: '11:00' })]) }));
  });

  it('registers and cancels a timezone-aware repeatable daily job', async () => {
    const queue: any = { getRepeatableJobs: jest.fn().mockResolvedValue([{ name: 'daily-mission', id: `daily-mission:${userId}`, key: 'repeat-key' }]), removeRepeatableByKey: jest.fn().mockResolvedValue(undefined), add: jest.fn().mockResolvedValue(undefined) };
    const service = new PlanningService({} as any, {} as any, queue, {} as any);
    await service.registerDailyMissionSchedule(userId, 'Asia/Kolkata');
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('repeat-key');
    expect(queue.add).toHaveBeenCalledWith('daily-mission', { userId }, expect.objectContaining({ repeat: { pattern: '0 8 * * *', tz: 'Asia/Kolkata' } }));
  });
});
