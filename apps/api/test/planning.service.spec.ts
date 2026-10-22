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

  it('uses getLatest decision when available and does not generate a new decision', async () => {
    const existingDecision = { _id: new Types.ObjectId(), priorityList: [{ candidateId: new Types.ObjectId().toHexString(), title: 'Existing priority' }] };
    const createdMission: any = { _id: new Types.ObjectId(), focusSessions: [], save: jest.fn().mockResolvedValue(undefined) };
    const missions: any = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue(createdMission),
    };
    const decisions: any = {
      getLatest: jest.fn().mockResolvedValue(existingDecision),
      generate: jest.fn(),
    };
    const service = new PlanningService(missions, {} as any, {} as any, decisions);
    const mission = await service.generateDailyMission(userId, new Date('2026-01-05T12:00:00Z'));

    expect(decisions.getLatest).toHaveBeenCalledWith(userId);
    expect(decisions.generate).not.toHaveBeenCalled();
    expect(mission).toBe(createdMission);
  });

  it('assigns concrete startsAt and endsAt to flexible blocks with buffers and respects fixed commitments', async () => {
    const fixedBlock = { id: 'fixed-1', title: 'Daily Standup', kind: 'fixed', period: 'morning', startsAt: '09:00', endsAt: '09:30' };
    const priorityList = [
      { candidateId: new Types.ObjectId().toHexString(), title: 'Task 1' },
      { candidateId: new Types.ObjectId().toHexString(), title: 'Task 2' },
    ];
    const createdMission: any = { _id: new Types.ObjectId(), focusSessions: [], save: jest.fn().mockResolvedValue(undefined) };
    const missions: any = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue(createdMission),
    };
    const decisions: any = {
      getLatest: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), priorityList }),
      generate: jest.fn(),
    };
    const service = new PlanningService(missions, {} as any, {} as any, decisions);
    await service.generateDailyMission(userId, new Date('2026-01-05T12:00:00Z'), {
      fixedCommitments: [fixedBlock as any],
      flexiblePeriods: ['morning', 'morning'],
    });

    const createCall = missions.create.mock.calls[0][0];
    const blocks = createCall.blocks;

    // Fixed block is preserved
    const fixed = blocks.find((b: any) => b.id === 'fixed-1');
    expect(fixed).toMatchObject({ startsAt: '09:00', endsAt: '09:30' });

    // Flexible blocks receive concrete non-overlapping intervals avoiding the fixed block + buffer
    const flex1 = blocks.find((b: any) => b.id === `flexible-${priorityList[0].candidateId}`);
    const flex2 = blocks.find((b: any) => b.id === `flexible-${priorityList[1].candidateId}`);

    // Standup ends at 09:30 -> flex1 starts at 09:40 (10m buffer), ends at 10:05 (25m session)
    expect(flex1).toBeDefined();
    expect(flex1.startsAt).toBe('09:40');
    expect(flex1.endsAt).toBe('10:05');

    // flex1 ends at 10:05 -> flex2 starts at 10:15 (10m buffer), ends at 10:40 (25m session)
    expect(flex2).toBeDefined();
    expect(flex2.startsAt).toBe('10:15');
    expect(flex2.endsAt).toBe('10:40');
  });

  it('recomputes today schedule using current timetable and context, resequencing blocks', async () => {
    const task1Id = new Types.ObjectId();
    const task2Id = new Types.ObjectId();
    const oldId = new Types.ObjectId();
    const today = new Date().toISOString().slice(0, 10);

    const prevBlocks = [
      { id: `flexible-${task1Id.toHexString()}`, taskId: task1Id, title: 'Old Top Task', kind: 'flexible', period: 'morning', startsAt: '09:00', endsAt: '09:25' },
      { id: `flexible-${task2Id.toHexString()}`, taskId: task2Id, title: 'Second Task', kind: 'flexible', period: 'college', startsAt: '11:30', endsAt: '11:55' },
    ];

    const current: any = {
      _id: oldId,
      date: today,
      supportingTaskIds: [task1Id, task2Id],
      blocks: prevBlocks,
      status: 'active',
      save: jest.fn().mockResolvedValue(undefined),
    };

    const createdMission: any = {
      _id: new Types.ObjectId(),
      focusSessions: [],
      blocks: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    const missions: any = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(current) }),
      create: jest.fn().mockImplementation((doc) => {
        createdMission.blocks = doc.blocks;
        createdMission.objective = doc.objective;
        return createdMission;
      }),
    };

    const decisions: any = {
      generate: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        priorityList: [
          { candidateId: task1Id.toHexString(), title: 'Old Top Task' },
          { candidateId: task2Id.toHexString(), title: 'Second Task' },
        ],
      }),
    };

    const service = new PlanningService(missions, {} as any, {} as any, decisions);
    const replanned = await service.replanMission(userId, oldId.toHexString(), {
      type: 'USER_UNAVAILABLE',
      payload: { reason: 'Can we change the timetable' },
    });

    expect(current.status).toBe('superseded');
    expect(replanned).toBe(createdMission);

    // The created mission should have resequenced task2 to the lead position
    const createCall = missions.create.mock.calls[0][0];
    expect(createCall.objective).toBe('Second Task');
    expect(createCall.blocks[0].title).toBe('Second Task');
    expect(createCall.blocks[0].taskId.toString()).toBe(task2Id.toHexString());
    expect(createCall.blocks[1].title).toBe('Old Top Task');
    expect(createCall.blocks[1].taskId.toString()).toBe(task1Id.toHexString());
  });
});
