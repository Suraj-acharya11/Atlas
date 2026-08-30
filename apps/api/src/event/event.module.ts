import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { Event, EventSchema } from './schemas/event.schema';
import { REDIS_CLIENT } from './redis.constants';
@Module({ imports: [MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]), BullModule.registerQueue({ name: 'event-bus' })], controllers: [EventController], providers: [EventService, { provide: REDIS_CLIENT, inject: [ConfigService], useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')) }], exports: [EventService] })
export class EventModule {}
