import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReflectionService } from './reflection.service';

@Processor('reflection-processing')
export class ReflectionProcessingProcessor extends WorkerHost {
  constructor(private readonly reflection: ReflectionService) { super(); }
  async process(job: Job<{ executionRecordId: string }>): Promise<void> { await this.reflection.processExecution(job.data.executionRecordId); }
}
