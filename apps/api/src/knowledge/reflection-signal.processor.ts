import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KnowledgeService } from './knowledge.service';

type SignalJob = { signalId: string; signal: { userId: string; taskId: string; missionId: string; timeEstimate: string; difficulty: string; progress: string; planAdherence: string; cause: string } };

@Processor('reflection-signal-knowledge')
export class KnowledgeReflectionSignalProcessor extends WorkerHost {
  constructor(private readonly knowledge: KnowledgeService) { super(); }
  async process(job: Job<SignalJob>): Promise<void> {
    const signal = job.data.signal;
    await this.knowledge.evaluate({ userId: signal.userId, payload: {} });
  }
}
