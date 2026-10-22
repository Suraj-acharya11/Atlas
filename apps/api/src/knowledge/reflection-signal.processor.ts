import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KnowledgeService } from './knowledge.service';

type SignalJob = { signalId: string; signal: { userId: string; taskId: string; missionId: string; timeEstimate: string; difficulty: string; progress: string; planAdherence: string; cause: string } };

@Processor('reflection-signal-knowledge')
export class KnowledgeReflectionSignalProcessor extends WorkerHost {
  constructor(private readonly knowledge: KnowledgeService) { super(); }
  async process(job: Job<SignalJob>): Promise<void> {
    const signal = job.data.signal;
    if (!signal) return;

    // Convert timeEstimate variance into evidence about duration estimation bias
    if (signal.timeEstimate === 'underestimated') {
      await this.knowledge.evaluate({
        userId: signal.userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'underestimates_duration',
            object: 'task',
            category: 'behavioral_pattern',
            supports: true,
          },
        },
      });
    } else if (signal.timeEstimate === 'overestimated') {
      await this.knowledge.evaluate({
        userId: signal.userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'overestimates_duration',
            object: 'task',
            category: 'behavioral_pattern',
            supports: true,
          },
        },
      });
    } else if (signal.timeEstimate === 'accurate') {
      // Accurate execution acts as contradicting evidence against estimation bias
      await this.knowledge.evaluate({
        userId: signal.userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'underestimates_duration',
            object: 'task',
            category: 'behavioral_pattern',
            supports: false,
          },
        },
      });
      await this.knowledge.evaluate({
        userId: signal.userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'overestimates_duration',
            object: 'task',
            category: 'behavioral_pattern',
            supports: false,
          },
        },
      });
    }
  }
}
