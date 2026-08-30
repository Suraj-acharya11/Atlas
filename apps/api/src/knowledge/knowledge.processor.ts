import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EventService } from '../event/event.service';
import { KnowledgeService } from './knowledge.service';

@Processor('knowledge-evaluation')
export class KnowledgeEvaluationProcessor extends WorkerHost {
  constructor(private readonly events: EventService, private readonly knowledge: KnowledgeService) { super(); }
  async process(job: Job<{ eventId: string }>): Promise<void> {
    const event = await this.events.findById(job.data.eventId);
    if (event) {
      const relationship = await this.knowledge.evaluate(event.toObject());
      if (relationship) await this.events.record({ type: 'KNOWLEDGE_UPDATED', userId: event.userId.toString(), source: 'SYSTEM', actor: 'SYSTEM', payload: { sourceEventId: event.id, relationshipId: relationship.id } });
    }
  }
}

@Processor('decay-tick')
export class KnowledgeDecayProcessor extends WorkerHost {
  constructor(private readonly knowledge: KnowledgeService) { super(); }
  async process(): Promise<void> { await this.knowledge.decayStale(); }
}
