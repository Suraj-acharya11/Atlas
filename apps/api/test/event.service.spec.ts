import { BadRequestException } from '@nestjs/common';
import { EventService } from '../src/event/event.service';

describe('EventService Phase 2', () => {
  const userId = '507f1f77bcf86cd799439011';
  let model: { create: jest.Mock };
  let queue: { add: jest.Mock };
  let redis: { set: jest.Mock; quit: jest.Mock };
  let service: EventService;

  beforeEach(() => {
    model = { create: jest.fn().mockResolvedValue({ id: 'event-1' }) };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    redis = { set: jest.fn().mockResolvedValue('OK'), quit: jest.fn().mockResolvedValue('OK') };
    service = new EventService(model as never, queue as never, redis as never);
  });

  it('rejects disallowed types before Mongo persistence', async () => {
    await expect(service.record({ type: 'RAW_API_REQUEST', userId, payload: {} })).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.set).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('persists an allowed envelope and publishes one event-bus job', async () => {
    await service.record({ type: 'TASK_COMPLETED', userId, payload: { taskId: 'task-1' } });
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_COMPLETED', source: 'USER', actor: 'USER', occurredAt: null, userId: expect.anything(), dedupeKey: expect.any(String) }));
    expect(queue.add).toHaveBeenCalledWith('event-recorded', { eventId: 'event-1' });
  });

  it('collapses a duplicate within the Redis dedupe window', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const input = { type: 'TASK_COMPLETED', userId, payload: { taskId: 'task-1' } };
    await service.record(input);
    const duplicate = await service.record(input);
    expect(duplicate).toBeNull();
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenLastCalledWith(expect.stringMatching(/^dedupe:/), '1', 'EX', 5, 'NX');
  });
});
