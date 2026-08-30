import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DecisionService } from './decision.service';

@Processor('decision-recompute')
export class DecisionRecomputeProcessor extends WorkerHost {
  constructor(private readonly decisions: DecisionService) { super(); }
  async process(job: Job<{ userId: string; context?: Record<string, unknown> }>): Promise<void> { await this.decisions.generate(job.data.userId, job.data.context ?? {}); }
}
