import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type LearningSignalDocument = HydratedDocument<LearningSignal>;

@Schema({ collection: 'learning_signals', versionKey: false })
export class LearningSignal {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) taskId!: Types.ObjectId;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) missionId!: Types.ObjectId;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, unique: true }) executionRecordId!: Types.ObjectId;
  @Prop({ required: true, enum: ['underestimated', 'accurate', 'overestimated'] }) timeEstimate!: string;
  @Prop({ required: true, enum: ['underestimated', 'accurate', 'overestimated'] }) difficulty!: string;
  @Prop({ required: true, enum: ['underestimated', 'accurate', 'overestimated'] }) progress!: string;
  @Prop({ required: true, enum: ['full', 'partial', 'none'] }) planAdherence!: string;
  @Prop({ required: true }) cause!: string;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const LearningSignalSchema = SchemaFactory.createForClass(LearningSignal);
LearningSignalSchema.index({ userId: 1, createdAt: -1 });
