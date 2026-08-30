import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { NotificationPriority } from '../notification.types';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: 'notifications', versionKey: false })
export class Notification {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, enum: ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] }) priority!: NotificationPriority;
  @Prop({ required: true }) whatChanged!: string;
  @Prop({ required: true }) recommendation!: string;
  @Prop({ required: true }) reason!: string;
  @Prop({ required: true, enum: ['pending', 'delivered', 'stored'], default: 'pending' }) status!: 'pending' | 'delivered' | 'stored';
  @Prop({ type: Date, default: null }) deliveredAt!: Date | null;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
