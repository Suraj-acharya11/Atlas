import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrchestrationService } from './orchestration.service';

@Processor('event-bus')
export class OrchestrationProcessor extends WorkerHost {
  constructor(private readonly orchestration: OrchestrationService) { super(); }
  async process(job: Job<{ eventId: string }>): Promise<void> { await this.orchestration.processEventBusJob(job.data.eventId); }
}
