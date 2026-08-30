import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateTaskDto { @IsOptional() @IsString() @MaxLength(200) title?:string; @IsOptional() @IsIn(['todo','in_progress','paused','completed','cancelled']) status?:string; @IsOptional() @IsDateString() deadline?:string|null; @IsOptional() @IsString() projectId?:string|null; }
