import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const KNOWLEDGE_CATEGORIES = ['identity', 'preference', 'capability', 'behavioral_pattern', 'context', 'goal_understanding', 'project_understanding', 'relationship'] as const;
export const KNOWLEDGE_STATUSES = ['pending', 'active'] as const;
export type KnowledgeDocument = HydratedDocument<KnowledgeRelationship>;

@Schema({ collection: 'knowledge_relationships', versionKey: false })
export class KnowledgeRelationship {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true }) subject!: string;
  @Prop({ required: true }) predicate!: string;
  @Prop({ required: true }) object!: string;
  @Prop({ required: true, type: String, enum: KNOWLEDGE_CATEGORIES }) category!: (typeof KNOWLEDGE_CATEGORIES)[number];
  @Prop({ required: true, min: 0, max: 100 }) confidence!: number;
  @Prop({ required: true, type: String, enum: KNOWLEDGE_STATUSES, default: 'pending' }) status!: (typeof KNOWLEDGE_STATUSES)[number];
  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] }) supportingEventIds!: Types.ObjectId[];
  @Prop({ required: true, default: 0 }) evidenceCount!: number;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
  @Prop({ required: true, default: Date.now }) lastUpdatedAt!: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null }) supersededBy!: Types.ObjectId | null;
}

export const KnowledgeRelationshipSchema = SchemaFactory.createForClass(KnowledgeRelationship);
KnowledgeRelationshipSchema.index({ userId: 1, subject: 1, predicate: 1 });
KnowledgeRelationshipSchema.index({ userId: 1, status: 1, lastUpdatedAt: -1 });
