import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { ExecutionService } from '../execution/execution.service';
import { PlanningService } from '../planning/planning.service';
import { LearningSignal, LearningSignalDocument } from './schemas/learning-signal.schema';

@Injectable()
export class ReflectionService {
  constructor(@InjectModel(LearningSignal.name) private readonly model: Model<LearningSignalDocument>, @InjectQueue('reflection-signal-knowledge') private readonly knowledgeSignalQueue: Queue, @InjectQueue('reflection-signal-ml') private readonly mlSignalQueue: Queue, private readonly execution: ExecutionService, private readonly planning: PlanningService) {}

  async processExecution(executionRecordId: string): Promise<LearningSignalDocument | null> {
    const existing = await this.model.findOne({ executionRecordId: new Types.ObjectId(executionRecordId) }).exec();
    if (existing) return existing;
    const record = await this.execution.findByRecordId(executionRecordId);
    if (!['completed', 'partial', 'abandoned'].includes(record.status)) return null;
    const mission = await this.planning.getMission(record.userId.toString(), record.missionId.toString());
    const plannedMinutes = mission.focusSessions[0]?.durationMinutes ?? 25;
    const actualMinutes = record.actualDurationMinutes;
    const signal = await this.model.create({
      executionRecordId: record._id,
      userId: record.userId,
      taskId: record.taskId,
      missionId: record.missionId,
      timeEstimate: actualMinutes > plannedMinutes * 1.2 ? 'underestimated' : actualMinutes < plannedMinutes * 0.8 ? 'overestimated' : 'accurate',
      difficulty: 'accurate',
      progress: record.progressPercent >= 100 ? 'accurate' : 'overestimated',
      planAdherence: record.status === 'completed' && actualMinutes <= plannedMinutes * 1.2 ? 'full' : record.status === 'abandoned' ? 'none' : 'partial',
      cause: 'unknown',
      createdAt: new Date(),
    });
    const payload = { signalId: signal.id, signal: signal.toObject() };
    await this.knowledgeSignalQueue.add('learning-signal', payload, { jobId: signal.id });
    await this.mlSignalQueue.add('learning-signal', payload, { jobId: signal.id });
    return signal;
  }

  async findForUser(userId: string): Promise<LearningSignalDocument[]> { return this.model.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean().exec() as Promise<LearningSignalDocument[]>; }
}
