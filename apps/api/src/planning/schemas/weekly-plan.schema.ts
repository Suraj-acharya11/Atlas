import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WeeklyPlanDocument = HydratedDocument<WeeklyPlan>;

@Schema({ collection: 'weekly_plans', versionKey: false })
export class WeeklyPlan {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, index: true }) weekStartDate!: string;
  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] }) emphasizedGoalIds!: Types.ObjectId[];
  @Prop({ required: true, default: '' }) notes!: string;
}

export const WeeklyPlanSchema = SchemaFactory.createForClass(WeeklyPlan);
WeeklyPlanSchema.index({ userId: 1, weekStartDate: 1 }, { unique: true });
