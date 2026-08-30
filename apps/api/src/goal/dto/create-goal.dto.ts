import { IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateGoalDto { @IsString() @MaxLength(200) title!:string; @IsOptional() @IsString() description?:string; }
