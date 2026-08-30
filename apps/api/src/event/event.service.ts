import { BadRequestException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { EventType, EVENT_TYPE_SET } from '@atlas/shared';
import Redis from 'ioredis';
import { Event, EventDocument } from './schemas/event.schema';
import { REDIS_CLIENT } from './redis.constants';

export type RecordEventInput = { type: EventType | string; userId: string; payload: Record<string, unknown>; occurredAt?: Date | null; source?: 'USER' | 'SYSTEM' | 'EXTERNAL'; actor?: 'USER' | 'SYSTEM' };

@Injectable()
export class EventService implements OnModuleDestroy {
  constructor(@InjectModel(Event.name) private readonly model: Model<EventDocument>, @InjectQueue('event-bus') private readonly eventBus: Queue, @Inject(REDIS_CLIENT) private readonly redis: Redis) {}
  async record(input: RecordEventInput): Promise<EventDocument | null> {
    if (!EVENT_TYPE_SET.has(input.type)) throw new BadRequestException(`Unsupported event type: ${input.type}`);
    const dedupeKey = createHash('sha256').update(JSON.stringify({ userId: input.userId, type: input.type, payload: input.payload })).digest('hex');
    const claimed = await this.redis.set(`dedupe:${dedupeKey}`, '1', 'EX', 5, 'NX');
    if (claimed !== 'OK') return null;
    const event = await this.model.create({ type: input.type, recordedAt: new Date(), occurredAt: input.occurredAt ?? null, source: input.source ?? 'USER', actor: input.actor ?? 'USER', userId: new Types.ObjectId(input.userId), payload: input.payload, dedupeKey });
    await this.eventBus.add('event-recorded', { eventId: event.id });
    return event;
  }
  async findById(id: string): Promise<EventDocument | null> { return this.model.findById(id).exec(); }
  async onModuleDestroy(): Promise<void> { await this.redis.quit(); }
}
