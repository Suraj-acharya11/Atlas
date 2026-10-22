import { Types } from 'mongoose';
import { ProjectService } from '../src/project/project.service';

const chain = (value: any) => ({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) });

describe('ProjectService Phase 1 lifecycle', () => {
  it('archives without deleting project data', async () => { const model: any = { findOneAndUpdate: jest.fn() }; const events: any = { record: jest.fn() }; const goals: any = { assertAllOwned: jest.fn() }; const service = new ProjectService(model, events, goals); const userId = new Types.ObjectId().toHexString(); const existing = { _id: new Types.ObjectId(), title: 'History' }; model.findOneAndUpdate.mockReturnValue(chain(existing)); const result = await service.archive(userId, existing._id.toHexString()); expect(result).toBe(existing); expect(model.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ $set: expect.objectContaining({ status: 'archived', archivedAt: expect.any(Date) }) }), expect.objectContaining({ new: true })); expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'PROJECT_ARCHIVED' })); });

  it('creates project with multiple owned goals', async () => {
    const model: any = {
      create: jest.fn().mockImplementation((doc) => ({
        id: 'proj-123',
        ...doc,
        toObject: () => ({ id: 'proj-123', ...doc }),
      })),
    };
    const events: any = { record: jest.fn().mockResolvedValue(undefined) };
    const goals: any = { assertAllOwned: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectService(model, events, goals);
    const userId = new Types.ObjectId().toHexString();
    const goal1 = new Types.ObjectId().toHexString();
    const goal2 = new Types.ObjectId().toHexString();

    const result = await service.create(userId, {
      title: 'Redesign Project',
      goalIds: [goal1, goal2],
    });

    expect(goals.assertAllOwned).toHaveBeenCalledWith(userId, [goal1, goal2]);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Redesign Project',
        userId: new Types.ObjectId(userId),
        goalIds: [new Types.ObjectId(goal1), new Types.ObjectId(goal2)],
      }),
    );
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PROJECT_CREATED', userId }),
    );
    expect(result.title).toBe('Redesign Project');
  });

  it('rejects project creation if goals are not owned or invalid', async () => {
    const model: any = { create: jest.fn() };
    const events: any = { record: jest.fn() };
    const goals: any = {
      assertAllOwned: jest.fn().mockRejectedValue(new Error('Invalid or non-owned goal')),
    };
    const service = new ProjectService(model, events, goals);
    const userId = new Types.ObjectId().toHexString();

    await expect(
      service.create(userId, {
        title: 'Unauthorized Goals Project',
        goalIds: ['non-owned-or-invalid-goal'],
      }),
    ).rejects.toThrow('Invalid or non-owned goal');

    expect(model.create).not.toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();
  });

  it('isolates projects by userId on findAll and findOwnedOrThrow', async () => {
    const model: any = {
      find: jest.fn().mockReturnValue(chain([{ _id: new Types.ObjectId(), title: 'UserA Project' }])),
      findOne: jest.fn().mockReturnValue(chain(null)),
    };
    const events: any = { record: jest.fn() };
    const goals: any = { assertAllOwned: jest.fn() };
    const service = new ProjectService(model, events, goals);
    const userA = new Types.ObjectId().toHexString();
    const userB = new Types.ObjectId().toHexString();
    const projId = new Types.ObjectId().toHexString();

    const list = await service.findAll(userA);
    expect(model.find).toHaveBeenCalledWith({ userId: new Types.ObjectId(userA) });
    expect(list).toHaveLength(1);

    // User B trying to access User A's project
    await expect(service.findOwnedOrThrow(userB, projId)).rejects.toThrow('Project not found');
    expect(model.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(projId),
      userId: new Types.ObjectId(userB),
    });
  });

  it('updates project title, status, and goalIds while checking goal ownership', async () => {
    const existing = { _id: new Types.ObjectId(), title: 'Updated Project', status: 'completed' };
    const model: any = {
      findOneAndUpdate: jest.fn().mockReturnValue(chain(existing)),
    };
    const events: any = { record: jest.fn().mockResolvedValue(undefined) };
    const goals: any = { assertAllOwned: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectService(model, events, goals);
    const userId = new Types.ObjectId().toHexString();
    const newGoalId = new Types.ObjectId().toHexString();

    const result = await service.update(userId, existing._id.toHexString(), {
      title: 'Updated Project',
      status: 'completed',
      goalIds: [newGoalId],
    });

    expect(goals.assertAllOwned).toHaveBeenCalledWith(userId, [newGoalId]);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: existing._id, userId: new Types.ObjectId(userId) },
      expect.objectContaining({
        $set: expect.objectContaining({
          title: 'Updated Project',
          status: 'completed',
          goalIds: [new Types.ObjectId(newGoalId)],
        }),
      }),
      expect.objectContaining({ new: true }),
    );
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PROJECT_COMPLETED', userId }),
    );
    expect(result).toBe(existing);
  });
});
