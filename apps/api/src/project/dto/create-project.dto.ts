import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateProjectDto { @IsString() @MaxLength(200) title!:string; @IsOptional() @IsArray() @IsString({each:true}) goalIds?:string[]; }
