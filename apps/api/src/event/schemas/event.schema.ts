import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { EVENT_TYPE_SET } from '@atlas/shared';

export type EventDocument = HydratedDocument<Event>;

@Schema({ collection: 'events', versionKey: false })
export class Event {
  @Prop({ required: true, type: String, validate: { validator: (value: string) => EVENT_TYPE_SET.has(value) } }) type!: string;
  @Prop({ required: true, default: Date.now }) recordedAt!: Date;
  @Prop({ type: Date, default: null }) occurredAt!: Date | null;
  @Prop({ required: true, enum: ['USER', 'SYSTEM', 'EXTERNAL'] }) source!: 'USER' | 'SYSTEM' | 'EXTERNAL';
  @Prop({ required: true, enum: ['USER', 'SYSTEM'] }) actor!: 'USER' | 'SYSTEM';
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, type: MongooseSchema.Types.Mixed, default: {} }) payload!: Record<string, unknown>;
  @Prop({ required: true, index: true }) dedupeKey!: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ userId: 1, type: 1, recordedAt: -1 });
