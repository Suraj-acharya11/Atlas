import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationJob } from './notification.types';
import { NotificationService } from './notification.service';

@Processor('notification-evaluation')
export class NotificationEvaluationProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationService) { super(); }
  async process(job: Job<NotificationJob>): Promise<void> { await this.notifications.handleMaterialChange(job.data.signal); }
}

@Processor('notification-digest')
export class NotificationDigestProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationService) { super(); }
  async process(): Promise<void> { await this.notifications.flushLowPriorityDigests(); }
}
