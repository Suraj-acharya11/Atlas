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
});
