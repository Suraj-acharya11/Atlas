import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', versionKey: false })
export class User {
  @Prop({ required: true, unique: true, index: true, trim: true, lowercase: true }) email!: string;
  @Prop({ required: true, select: false }) passwordHash!: string;
  @Prop({ required: true, default: Date.now }) createdAt!: Date;
  @Prop({ required: true }) timezone!: string;
  @Prop({ type: Object, default: {} }) preferences!: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);
