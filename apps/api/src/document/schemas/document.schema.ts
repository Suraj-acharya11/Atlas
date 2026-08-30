import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const DOCUMENT_STATUSES = ['active', 'referenced', 'archived', 'deleted'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type DocumentRecordDocument = HydratedDocument<DocumentRecord>;

@Schema({ collection: 'documents', versionKey: false })
export class DocumentRecord {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true }) filename!: string;
  @Prop({ required: true }) mimeType!: string;
  @Prop({ required: true }) storagePath!: string;
  @Prop({ required: true, type: String, enum: DOCUMENT_STATUSES, default: 'active', index: true }) status!: DocumentStatus;
  @Prop({ required: true, default: Date.now }) uploadedAt!: Date;
  @Prop({ type: Date, default: null, index: true }) lastUsedAt!: Date | null;
  @Prop({ type: Number, default: null }) pageCount!: number | null;
  @Prop({ type: String, default: null }) extractedText!: string | null;
}

export const DocumentRecordSchema = SchemaFactory.createForClass(DocumentRecord);
DocumentRecordSchema.index({ userId: 1, status: 1, lastUsedAt: 1 });
