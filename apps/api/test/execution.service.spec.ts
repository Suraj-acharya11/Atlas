import { Types } from 'mongoose';
import { ExecutionService } from '../src/execution/execution.service';

describe('ExecutionService Phase 6', () => {
  it('emits an event and queues exactly one reflection job on completion', async () => {
    const record: any = { _id: new Types.ObjectId(), id: 'execution-1', status: 'started', startedAt: new Date(Date.now() - 60_000), taskId: new Types.ObjectId(), missionId: new Types.ObjectId(), progressPercent: 0, save: jest.fn() };
    record.save.mockImplementation(async () => record);
    const model: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(record) }) };
    const queue: any = { add: jest.fn().mockResolvedValue(undefined) };
    const events: any = { record: jest.fn() };
    const service = new ExecutionService(model, queue, {} as any, {} as any, events);
    const result = await service.transition('507f1f77bcf86cd799439011', 'execution-1', { status: 'completed', at: new Date().toISOString() });
    expect(result.status).toBe('completed');
    expect(result.progressPercent).toBe(100);
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_COMPLETED' }));
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith('execution-finished', { executionRecordId: 'execution-1' }, { jobId: 'execution-1' });
  });
});
