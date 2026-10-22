import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlanningService } from './planning.service';
import { NotificationService } from '../notification/notification.service';

@Processor('daily-mission')
export class DailyMissionProcessor extends WorkerHost {
  constructor(
    private readonly planning: PlanningService,
    @Optional() private readonly notifications?: NotificationService,
  ) { super(); }
  async process(job: Job<{ userId: string }>): Promise<void> {
    await this.planning.generateDailyMission(job.data.userId);
    if (this.notifications) {
      await this.notifications.checkDeadlineNotifications(job.data.userId).catch(() => {});
    }
  }
}
