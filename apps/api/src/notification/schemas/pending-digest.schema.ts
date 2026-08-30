import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DigestItem = { whatChanged: string; recommendation: string; reason: string };
export type PendingDigestDocument = HydratedDocument<PendingDigest>;

@Schema({ _id: false })
export class DigestItemSchemaType {
  @Prop({ required: true }) whatChanged!: string;
  @Prop({ required: true }) recommendation!: string;
  @Prop({ required: true }) reason!: string;
}

@Schema({ collection: 'pending_digests', versionKey: false })
export class PendingDigest {
  @Prop({ required: true, unique: true, type: MongooseSchema.Types.ObjectId }) userId!: Types.ObjectId;
  @Prop({ type: [DigestItemSchemaType], default: [] }) items!: DigestItem[];
  @Prop({ required: true, default: Date.now }) updatedAt!: Date;
}

export const PendingDigestSchema = SchemaFactory.createForClass(PendingDigest);
