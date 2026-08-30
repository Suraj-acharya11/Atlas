import { Types } from 'mongoose';
import { TaskService } from '../src/task/task.service';

describe('TaskService Phase 1 standalone tasks', () => {
  it('allows a task without a project', async () => { const model: any = { create: jest.fn().mockResolvedValue({ id: 'task-1', toObject: () => ({ projectId: null }) }) }; const events: any = { record: jest.fn() }; const projects: any = { assertOwned: jest.fn() }; const service = new TaskService(model, events, projects); const userId = new Types.ObjectId().toHexString(); await service.create(userId, { title: 'Independent task' }); expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: null })); expect(projects.assertOwned).not.toHaveBeenCalled(); expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_CREATED', userId })); });
});
