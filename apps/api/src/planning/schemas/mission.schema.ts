import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class MissionBlock {
  @Prop({ required: true }) id!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null }) taskId!: Types.ObjectId | null;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true, enum: ['fixed', 'flexible'] }) kind!: string;
  @Prop({ required: true }) period!: string;
  @Prop({ type: String, default: null }) startsAt!: string | null;
  @Prop({ type: String, default: null }) endsAt!: string | null;
}

@Schema({ _id: false })
export class FocusSession {
  @Prop({ required: true }) objective!: string;
  @Prop({ required: true }) durationMinutes!: number;
  @Prop({ required: true }) expectedOutcome!: string;
  @Prop({ required: true }) recommendedBreakMinutes!: number;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId }) missionId!: Types.ObjectId;
}

@Schema({ _id: false })
export class CarryForwardDecision {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId }) taskId!: Types.ObjectId;
  @Prop({ required: true, enum: ['carried', 'reprioritized', 'split', 'dropped'] }) action!: string;
  @Prop({ required: true }) reason!: string;
}

export type MissionDocument = HydratedDocument<Mission>;

@Schema({ collection: 'missions', versionKey: false })
export class Mission {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, index: true }) date!: string;
  @Prop({ required: true }) objective!: string;
  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] }) supportingTaskIds!: Types.ObjectId[];
  @Prop({ required: true, enum: ['active', 'superseded', 'completed'], default: 'active' }) status!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null }) supersedes!: Types.ObjectId | null;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId }) decisionId!: Types.ObjectId;
  @Prop({ type: [MissionBlock], default: [] }) blocks!: MissionBlock[];
  @Prop({ type: [FocusSession], default: [] }) focusSessions!: FocusSession[];
  @Prop({ type: [CarryForwardDecision], default: [] }) carryForwardDecisions!: CarryForwardDecision[];
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const MissionSchema = SchemaFactory.createForClass(Mission);
MissionSchema.index({ userId: 1, date: 1, status: 1 });
