import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class DecisionFactorValue {
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) rawValue!: number;
  @Prop({ required: true }) weight!: number;
  @Prop({ required: true }) weightedValue!: number;
}

@Schema({ _id: false })
export class DecisionCandidateResult {
  @Prop({ required: true }) candidateId!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) score!: number;
  @Prop({ required: true }) confidence!: number;
  @Prop({ required: true, enum: ['low', 'moderate', 'high'] }) confidenceLabel!: string;
  @Prop({ required: true }) explanation!: string;
  @Prop({ type: [DecisionFactorValue], required: true }) factors!: DecisionFactorValue[];
}

@Schema({ _id: false })
export class DecisionRejection {
  @Prop({ required: true, enum: ['too_tired', 'no_time', 'already_completed', 'wrong_recommendation', 'not_interested', 'other'] }) reason!: string;
  @Prop({ required: true, default: false }) consequenceExplained!: boolean;
  @Prop({ required: true, default: Date.now }) recordedAt!: Date;
}

export type DecisionDocument = HydratedDocument<Decision>;

@Schema({ collection: 'decisions', versionKey: false })
export class Decision {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, enum: ['normal', 'deadline_critical'] }) weightProfile!: string;
  @Prop({ required: true }) confidence!: number;
  @Prop({ required: true, enum: ['low', 'moderate', 'high'] }) confidenceLabel!: string;
  @Prop({ type: [String], default: [] }) missingInputs!: string[];
  @Prop({ type: [DecisionCandidateResult], required: true }) priorityList!: DecisionCandidateResult[];
  @Prop({ required: true }) topCandidateId!: string;
  @Prop({ required: true }) topExplanation!: string;
  @Prop({ type: [String], default: [] }) warnings!: string[];
  @Prop({ type: Object, default: null }) suggestedFocusSession!: Record<string, unknown> | null;
  @Prop({ type: Object, default: null }) suggestedBreak!: Record<string, unknown> | null;
  @Prop({ type: String, default: null }) adaptiveChallenge!: string | null;
  @Prop({ type: [DecisionRejection], default: [] }) rejections!: DecisionRejection[];
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const DecisionSchema = SchemaFactory.createForClass(Decision);
DecisionSchema.index({ userId: 1, createdAt: -1 });
