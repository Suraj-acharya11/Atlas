import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PlanningService } from './planning.service';

@Processor('daily-mission')
export class DailyMissionProcessor extends WorkerHost {
  constructor(private readonly planning: PlanningService) { super(); }
  async process(job: Job<{ userId: string }>): Promise<void> { await this.planning.generateDailyMission(job.data.userId); }
}
