import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateGoalDto { @IsOptional() @IsString() @MaxLength(200) title?:string; @IsOptional() @IsString() description?:string; @IsOptional() @IsIn(['active','completed','archived']) status?:string; }
