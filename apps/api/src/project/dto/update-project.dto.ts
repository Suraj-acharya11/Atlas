import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateProjectDto { @IsOptional() @IsString() @MaxLength(200) title?:string; @IsOptional() @IsArray() @IsString({each:true}) goalIds?:string[]; @IsOptional() @IsIn(['active','completed']) status?:string; }
