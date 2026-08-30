import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MlService } from './ml.service';

@Processor('reflection-signal-ml')
export class MlReflectionSignalProcessor extends WorkerHost {
  constructor(private readonly ml: MlService) { super(); }
  async process(job: Job<{ signalId: string; signal: unknown }>): Promise<void> { await this.ml.recordLearningSignal(job.data.signal); }
}
