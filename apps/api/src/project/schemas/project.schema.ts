import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'; import { HydratedDocument, Types } from 'mongoose';
export type ProjectDocument=HydratedDocument<Project>;
@Schema({collection:'projects',versionKey:false}) export class Project { @Prop({type:Types.ObjectId,required:true,index:true}) userId!:Types.ObjectId; @Prop({required:true,trim:true}) title!:string; @Prop({type:[Types.ObjectId],ref:'Goal',default:[]}) goalIds!:Types.ObjectId[]; @Prop({required:true,enum:['active','completed','archived'],default:'active'}) status!:string; @Prop({type:Date,default:null}) archivedAt!:Date|null; }
export const ProjectSchema=SchemaFactory.createForClass(Project); ProjectSchema.index({userId:1,status:1});
