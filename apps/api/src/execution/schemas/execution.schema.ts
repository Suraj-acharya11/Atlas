import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ExecutionDocument = HydratedDocument<ExecutionRecord>;

@Schema({ collection: 'execution_records', versionKey: false })
export class ExecutionRecord {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) taskId!: Types.ObjectId;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) missionId!: Types.ObjectId;
  @Prop({ required: true, enum: ['started', 'paused', 'resumed', 'completed', 'partial', 'abandoned'] }) status!: string;
  @Prop({ required: true }) startedAt!: Date;
  @Prop({ type: Date, default: null }) endedAt!: Date | null;
  @Prop({ required: true, default: 0 }) actualDurationMinutes!: number;
  @Prop({ required: true, min: 0, max: 100, default: 0 }) progressPercent!: number;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const ExecutionSchema = SchemaFactory.createForClass(ExecutionRecord);
ExecutionSchema.index({ userId: 1, missionId: 1, createdAt: -1 });
