import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DeviceTokenDocument = HydratedDocument<DeviceToken>;

@Schema({ collection: 'device_tokens', versionKey: false })
export class DeviceToken {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, unique: true }) expoPushToken!: string;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);
