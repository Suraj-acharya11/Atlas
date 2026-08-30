import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'; import { HydratedDocument, Types } from 'mongoose';
export type GoalDocument=HydratedDocument<Goal>;
@Schema({collection:'goals',versionKey:false}) export class Goal { @Prop({type:Types.ObjectId,required:true,index:true}) userId!:Types.ObjectId; @Prop({required:true,trim:true}) title!:string; @Prop({required:true,default:''}) description!:string; @Prop({required:true,enum:['active','completed','archived'],default:'active'}) status!:string; @Prop({required:true,default:Date.now}) createdAt!:Date; }
export const GoalSchema=SchemaFactory.createForClass(Goal); GoalSchema.index({userId:1,status:1,createdAt:-1});
