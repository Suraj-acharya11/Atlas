import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { PlanningService } from '../planning/planning.service';
import { TaskService } from '../task/task.service';
import { ExecutionDocument, ExecutionRecord } from './schemas/execution.schema';
import { ExecutionStartInput, ExecutionTransitionInput } from './execution.types';
import { assertTransition, ExecutionStatus } from './transitions.util';

const EVENT_BY_STATUS: Record<ExecutionStatus, string> = { started: 'TASK_STARTED', paused: 'TASK_PAUSED', resumed: 'TASK_RESUMED', completed: 'TASK_COMPLETED', partial: 'TASK_PROGRESS_UPDATED', abandoned: 'TASK_CANCELLED' };

@Injectable()
export class ExecutionService {
  constructor(@InjectModel(ExecutionRecord.name) private readonly model: Model<ExecutionDocument>, @InjectQueue('reflection-processing') private readonly reflectionQueue: Queue, private readonly tasks: TaskService, private readonly planning: PlanningService, private readonly events: EventService) {}

  async start(userId: string, input: ExecutionStartInput): Promise<ExecutionDocument> {
    await this.tasks.findOwnedOrThrow(userId, input.taskId);
    await this.planning.getMission(userId, input.missionId);
    const now = new Date();
    const record = await this.model.create({ userId: new Types.ObjectId(userId), taskId: new Types.ObjectId(input.taskId), missionId: new Types.ObjectId(input.missionId), status: 'started', startedAt: now, endedAt: null, actualDurationMinutes: 0, progressPercent: 0, createdAt: now });
    await this.events.record({ type: EVENT_BY_STATUS.started, userId, payload: { taskId: input.taskId, missionId: input.missionId, executionRecordId: record.id } });
    return record;
  }

  async findById(userId: string, recordId: string): Promise<ExecutionDocument> {
    const record = await this.model.findOne({ _id: recordId, userId: new Types.ObjectId(userId) }).exec();
    if (!record) throw new NotFoundException('Execution record not found');
    return record;
  }
  async findByRecordId(recordId: string): Promise<ExecutionDocument> {
    const record = await this.model.findById(recordId).exec();
    if (!record) throw new NotFoundException('Execution record not found');
    return record;
  }

  async transition(userId: string, recordId: string, input: ExecutionTransitionInput): Promise<ExecutionDocument> {
    const record = await this.findById(userId, recordId);
    const current = record.status as ExecutionStatus;
    assertTransition(current, input.status);
    const at = input.at ? new Date(input.at) : new Date();
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Invalid transition timestamp');
    if (input.progressPercent != null && (input.progressPercent < 0 || input.progressPercent > 100)) throw new BadRequestException('progressPercent must be between 0 and 100');
    record.status = input.status;
    record.endedAt = ['completed', 'partial', 'abandoned'].includes(input.status) ? at : null;
    record.actualDurationMinutes = Math.max(0, (at.getTime() - record.startedAt.getTime()) / 60_000);
    record.progressPercent = input.status === 'completed' ? 100 : input.progressPercent ?? record.progressPercent;
    const saved = await record.save();
    await this.events.record({ type: EVENT_BY_STATUS[input.status], userId, payload: { taskId: record.taskId.toString(), missionId: record.missionId.toString(), executionRecordId: record.id, progressPercent: saved.progressPercent } });
    if (['completed', 'partial', 'abandoned'].includes(input.status)) await this.reflectionQueue.add('execution-finished', { executionRecordId: saved.id }, { jobId: saved.id });
    return saved;
  }
}
