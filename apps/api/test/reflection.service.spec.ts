import { Types } from 'mongoose';
import { ReflectionService } from '../src/reflection/reflection.service';

describe('ReflectionService Phase 6', () => {
  it('creates one structured LearningSignal with unknown cause and publishes it', async () => {
    const executionRecord: any = { _id: new Types.ObjectId(), userId: new Types.ObjectId(), taskId: new Types.ObjectId(), missionId: new Types.ObjectId(), status: 'partial', actualDurationMinutes: 40, progressPercent: 40 };
    const signal: any = { id: 'signal-1', toObject: () => ({ userId: executionRecord.userId.toString(), taskId: executionRecord.taskId.toString(), missionId: executionRecord.missionId.toString(), cause: 'unknown' }) };
    const model: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }), create: jest.fn().mockResolvedValue(signal) };
    const queue: any = { add: jest.fn().mockResolvedValue(undefined) };
    const execution: any = { findByRecordId: jest.fn().mockResolvedValue(executionRecord) };
    const planning: any = { getMission: jest.fn().mockResolvedValue({ focusSessions: [{ durationMinutes: 25 }] }) };
    const service = new ReflectionService(model, queue, queue, execution, planning);
    const result = await service.processExecution(executionRecord._id.toString());
    expect(result).toBe(signal);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ cause: 'unknown', progress: 'overestimated', planAdherence: 'partial' }));
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith('learning-signal', expect.objectContaining({ signalId: 'signal-1' }), { jobId: 'signal-1' });
  });

  it('does not create a second signal for the same execution record', async () => {
    const existing = { id: 'existing-signal' };
    const model: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }), create: jest.fn() };
    const service = new ReflectionService(model, {} as any, {} as any, {} as any, {} as any);
    expect(await service.processExecution(new Types.ObjectId().toString())).toBe(existing);
    expect(model.create).not.toHaveBeenCalled();
  });
});
