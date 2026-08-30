import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditAction = 'LOGIN' | 'FAILED_LOGIN' | 'PASSWORD_CHANGED' | 'ACCOUNT_DELETED';
export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ collection: 'audit_logs', versionKey: false })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null, index: true }) userId!: Types.ObjectId | null;
  @Prop({ required: true, enum: ['LOGIN', 'FAILED_LOGIN', 'PASSWORD_CHANGED', 'ACCOUNT_DELETED'] }) action!: AuditAction;
  @Prop({ required: true }) success!: boolean;
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) metadata!: Record<string, unknown>;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ userId: 1, createdAt: -1 });
