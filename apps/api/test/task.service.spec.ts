import { Types } from 'mongoose';
import { TaskService } from '../src/task/task.service';

describe('TaskService Phase 1 standalone tasks', () => {
  it('allows a task without a project', async () => { const model: any = { create: jest.fn().mockResolvedValue({ id: 'task-1', toObject: () => ({ projectId: null }) }) }; const events: any = { record: jest.fn() }; const projects: any = { assertOwned: jest.fn() }; const service = new TaskService(model, events, projects); const userId = new Types.ObjectId().toHexString(); await service.create(userId, { title: 'Independent task' }); expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: null })); expect(projects.assertOwned).not.toHaveBeenCalled(); expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_CREATED', userId })); });

  it('assigns a task to an owned project successfully', async () => {
    const projId = new Types.ObjectId().toHexString();
    const userId = new Types.ObjectId().toHexString();
    const model: any = {
      create: jest.fn().mockResolvedValue({
        id: 'task-2',
        toObject: () => ({ id: 'task-2', projectId: new Types.ObjectId(projId) }),
      }),
    };
    const events: any = { record: jest.fn().mockResolvedValue(undefined) };
    const projects: any = { assertOwned: jest.fn().mockResolvedValue(undefined) };
    const service = new TaskService(model, events, projects);

    const created = await service.create(userId, {
      title: 'Linked task',
      projectId: projId,
    });

    expect(projects.assertOwned).toHaveBeenCalledWith(userId, projId);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Linked task',
        projectId: new Types.ObjectId(projId),
        userId: new Types.ObjectId(userId),
      }),
    );
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TASK_CREATED', userId }),
    );
    expect(created.projectId).toEqual(new Types.ObjectId(projId));
  });

  it('rejects task creation when assigned to another user or non-existent project', async () => {
    const projId = new Types.ObjectId().toHexString();
    const userId = new Types.ObjectId().toHexString();
    const model: any = { create: jest.fn() };
    const events: any = { record: jest.fn() };
    const projects: any = {
      assertOwned: jest.fn().mockRejectedValue(new Error('Project not found')),
    };
    const service = new TaskService(model, events, projects);

    await expect(
      service.create(userId, {
        title: 'Unauthorized project task',
        projectId: projId,
      }),
    ).rejects.toThrow('Project not found');

    expect(projects.assertOwned).toHaveBeenCalledWith(userId, projId);
    expect(model.create).not.toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();
  });
});
