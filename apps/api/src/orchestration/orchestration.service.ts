import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventService } from '../event/event.service';

const KNOWLEDGE_EVENT_TYPES = new Set([
  'GOAL_CREATED', 'GOAL_UPDATED', 'GOAL_COMPLETED', 'GOAL_ARCHIVED',
  'PROJECT_CREATED', 'PROJECT_STARTED', 'PROJECT_COMPLETED', 'PROJECT_ARCHIVED',
  'TASK_CREATED', 'TASK_STARTED', 'TASK_PAUSED', 'TASK_RESUMED', 'TASK_COMPLETED', 'TASK_CANCELLED', 'TASK_PROGRESS_UPDATED',
  'STUDY_SESSION_STARTED', 'STUDY_SESSION_COMPLETED', 'TOPIC_REVISED',
  'USER_CREATED', 'USER_UPDATED', 'MOOD_UPDATED', 'ENERGY_UPDATED', 'FOCUS_LEVEL_UPDATED',
  'DOCUMENT_ADDED', 'CALENDAR_EVENT_IMPORTED',
]);

export type RoutableEvent = { id?: string; type: string; userId: { toString(): string } | string; payload?: Record<string, unknown> };

@Injectable()
export class OrchestrationService {
  constructor(
    private readonly events: EventService,
    @InjectQueue('knowledge-evaluation') private readonly knowledgeQueue: Queue,
    @InjectQueue('decision-recompute') private readonly decisionQueue: Queue,
    @InjectQueue('notification-evaluation') private readonly notificationQueue: Queue,
  ) {}

  async processEventBusJob(eventId: string): Promise<void> {
    const event = await this.events.findById(eventId);
    if (event) await this.handleEvent(event.toObject() as RoutableEvent);
  }

  async handleEvent(event: RoutableEvent): Promise<void> {
    const userId = typeof event.userId === 'string' ? event.userId : event.userId.toString();
    if (KNOWLEDGE_EVENT_TYPES.has(event.type)) {
      await this.knowledgeQueue.add('knowledge-evaluation', { eventId: event.id });
      return;
    }
    if (event.type === 'KNOWLEDGE_UPDATED') {
      await this.decisionQueue.add('decision-recompute', { userId, eventId: event.id });
      return;
    }
    if (event.type === 'MATERIAL_CHANGE_DETECTED') {
      const signal = event.payload?.signal ?? event.payload;
      await this.notificationQueue.add('notification-evaluation', { signal });
    }
  }
}
