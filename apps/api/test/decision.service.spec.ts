import { Types } from 'mongoose';
import { DecisionService } from '../src/decision/decision.service';

const baseDeps = () => ({ tasks: { findAll: jest.fn() }, projects: { findAll: jest.fn() }, goals: { findAll: jest.fn() }, knowledge: { query: jest.fn() }, events: { record: jest.fn() } });

describe('DecisionService Phase 4', () => {
  it('weights fake factors deterministically and preserves the breakdown', async () => {
    const deps = baseDeps();
    const model: any = { create: jest.fn() };
    const ml = { getAdjustment: jest.fn().mockResolvedValue({ adjustment: 99, reliable: false }) };
    const factors = [{ key: 'goalImportance', evaluate: () => 100 }, { key: 'deadlineUrgency', evaluate: () => 0 }, { key: 'contextFit', evaluate: () => 100 }, { key: 'energyFit', evaluate: () => 100 }, { key: 'knowledgeSupport', evaluate: () => 100 }, { key: 'difficultyPenalty', evaluate: () => 0 }];
    const service = new DecisionService(model, factors as any, deps.tasks as any, deps.projects as any, deps.goals as any, deps.knowledge as any, ml as any, deps.events as any);
    const result = await service.scoreCandidates([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], {});
    expect(result[0].score).toBe(80);
    expect(result[0].factors).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'goalImportance', rawValue: 100, weightedValue: 30 })]));
    expect(ml.getAdjustment).toHaveBeenCalled();
  });

  it('stores explanations derived from the persisted factor values', async () => {
    const deps = baseDeps();
    deps.tasks.findAll.mockResolvedValue([{ _id: new Types.ObjectId(), title: 'Task', status: 'todo', projectId: null, deadline: null }]);
    deps.projects.findAll.mockResolvedValue([]); deps.goals.findAll.mockResolvedValue([]); deps.knowledge.query.mockResolvedValue([]);
    const stored = { id: 'decision-1' }; const model: any = { create: jest.fn().mockResolvedValue(stored) };
    const factors = [{ key: 'goalImportance', evaluate: () => 0 }, { key: 'deadlineUrgency', evaluate: () => 0 }, { key: 'contextFit', evaluate: () => 50 }, { key: 'energyFit', evaluate: () => 50 }, { key: 'knowledgeSupport', evaluate: () => 0 }, { key: 'difficultyPenalty', evaluate: () => 50 }];
    const service = new DecisionService(model, factors as any, deps.tasks as any, deps.projects as any, deps.goals as any, deps.knowledge as any, { getAdjustment: jest.fn().mockResolvedValue({ adjustment: 0, reliable: false }) } as any, deps.events as any);
    await service.generate('507f1f77bcf86cd799439011', {});
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ priorityList: [expect.objectContaining({ factors: expect.any(Array), explanation: expect.stringContaining('goalImportance=0') })] }));
  });

  it('explains a rejection consequence only once for the same reason', async () => {
    const deps = baseDeps();
    const decision: any = { userId: new Types.ObjectId('507f1f77bcf86cd799439011'), rejections: [], save: jest.fn().mockResolvedValue(undefined) };
    const model: any = { findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(decision) }) };
    const service = new DecisionService(model, [] as any, deps.tasks as any, deps.projects as any, deps.goals as any, deps.knowledge as any, {} as any, deps.events as any);
    const first = await service.recordRejection('decision-1', 'no_time');
    const second = await service.recordRejection('decision-1', 'no_time');
    expect(first.consequenceExplanation).not.toBeNull();
    expect(second.consequenceExplanation).toBeNull();
    expect(deps.events.record).toHaveBeenCalledTimes(2);
  });

  describe('getLatest read optimization', () => {
    it('returns the latest decision for the specified user without creating a new one', async () => {
      const deps = baseDeps();
      const userA = '507f1f77bcf86cd799439011';
      const existingDecision = { _id: new Types.ObjectId(), userId: new Types.ObjectId(userA), topCandidateId: 'task-1' };
      const model: any = {
        create: jest.fn(),
        findOne: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(existingDecision),
          }),
        }),
      };
      const service = new DecisionService(model, [] as any, deps.tasks as any, deps.projects as any, deps.goals as any, deps.knowledge as any, {} as any, deps.events as any);

      const result = await service.getLatest(userA);

      expect(result).toBe(existingDecision);
      expect(model.create).not.toHaveBeenCalled();
      expect(model.findOne).toHaveBeenCalledWith({ userId: new Types.ObjectId(userA) });
    });

    it('returns null when no decision exists for the user', async () => {
      const deps = baseDeps();
      const userA = '507f1f77bcf86cd799439011';
      const model: any = {
        create: jest.fn(),
        findOne: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      };
      const service = new DecisionService(model, [] as any, deps.tasks as any, deps.projects as any, deps.goals as any, deps.knowledge as any, {} as any, deps.events as any);

      const result = await service.getLatest(userA);

      expect(result).toBeNull();
      expect(model.create).not.toHaveBeenCalled();
    });

    it('ensures User A cannot read User B decisions by strictly querying by authenticated userId', async () => {
      const deps = baseDeps();
      const userA = '507f1f77bcf86cd799439011';
      const userB = '507f1f77bcf86cd799439022';
      const model: any = {
        findOne: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      };
      const service = new DecisionService(model, [] as any, deps.tasks as any, deps.projects as any, deps.goals as any, deps.knowledge as any, {} as any, deps.events as any);

      await service.getLatest(userA);
      expect(model.findOne).toHaveBeenCalledWith({ userId: new Types.ObjectId(userA) });
      expect(model.findOne).not.toHaveBeenCalledWith({ userId: new Types.ObjectId(userB) });
    });
  });

  describe('DR-004 Task -> Project -> Goal alignment resolution in DecisionService', () => {
    it('correctly maps task.projectId to project.goalIds and resolves activeGoalIds', async () => {
      const deps = baseDeps();
      const userId = '507f1f77bcf86cd799439011';

      const goalAId = new Types.ObjectId();
      const goalBId = new Types.ObjectId();
      const projId = new Types.ObjectId();
      const taskWithProjId = new Types.ObjectId();
      const standaloneTaskId = new Types.ObjectId();

      deps.tasks.findAll.mockResolvedValue([
        {
          _id: taskWithProjId,
          title: 'Project Task',
          status: 'todo',
          projectId: projId,
          deadline: null,
        },
        {
          _id: standaloneTaskId,
          title: 'Standalone Task',
          status: 'todo',
          projectId: null,
          deadline: null,
        },
      ]);

      deps.projects.findAll.mockResolvedValue([
        {
          _id: projId,
          title: 'Core Project',
          goalIds: [goalAId, goalBId],
          status: 'active',
        },
      ]);

      deps.goals.findAll.mockResolvedValue([
        { _id: goalAId, title: 'Active Goal A', status: 'active' },
        { _id: goalBId, title: 'Completed Goal B', status: 'completed' }, // should be filtered out
      ]);

      deps.knowledge.query.mockResolvedValue([]);

      const model: any = {
        create: jest.fn().mockImplementation((doc) => doc),
      };

      // GoalImportance factor evaluates activeGoalIds length
      const factors = [
        {
          key: 'goalImportance',
          evaluate: (candidate: any) => (candidate.activeGoalIds?.length > 0 ? 100 : 0),
        },
      ];

      const service = new DecisionService(
        model,
        factors as any,
        deps.tasks as any,
        deps.projects as any,
        deps.goals as any,
        deps.knowledge as any,
        { getAdjustment: jest.fn().mockResolvedValue({ adjustment: 0, reliable: false }) } as any,
        deps.events as any,
      );

      const decision = await service.generate(userId, {});

      expect(model.create).toHaveBeenCalled();
      const priorityList = (model.create.mock.calls[0][0] as any).priorityList;

      const projectTaskResult = priorityList.find((p: any) => p.candidateId === taskWithProjId.toString());
      const standaloneTaskResult = priorityList.find((p: any) => p.candidateId === standaloneTaskId.toString());

      // Project task should resolve goalAId (active) and score 100 on goalImportance
      expect(projectTaskResult.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'goalImportance', rawValue: 100 }),
        ]),
      );

      // Standalone task has no project / no goals and scores 0
      expect(standaloneTaskResult.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'goalImportance', rawValue: 0 }),
        ]),
      );
    });
  });
});

describe('DecisionController', () => {
  it('GET /latest calls decisions.getLatest with authenticated user and does not recompute', async () => {
    const { DecisionController } = await import('../src/decision/decision.controller');
    const decisions: any = { getLatest: jest.fn().mockResolvedValue({ id: 'decision-123' }), generate: jest.fn() };
    const controller = new DecisionController(decisions);
    const req: any = { user: { userId: '507f1f77bcf86cd799439011' } };

    const result = await controller.getLatest(req);

    expect(result).toEqual({ id: 'decision-123' });
    expect(decisions.getLatest).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(decisions.generate).not.toHaveBeenCalled();
  });

  it('POST /recompute explicitly calls decisions.generate', async () => {
    const { DecisionController } = await import('../src/decision/decision.controller');
    const decisions: any = { getLatest: jest.fn(), generate: jest.fn().mockResolvedValue({ id: 'decision-new' }) };
    const controller = new DecisionController(decisions);
    const req: any = { user: { userId: '507f1f77bcf86cd799439011' } };

    const result = await controller.recompute(req, { energy: 80 });

    expect(result).toEqual({ id: 'decision-new' });
    expect(decisions.generate).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { energy: 80 });
  });
});
