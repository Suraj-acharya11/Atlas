import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateTaskDto { @IsString() @MaxLength(200) title!:string; @IsOptional() @IsString() projectId?:string; @IsOptional() @IsDateString() deadline?:string; }
