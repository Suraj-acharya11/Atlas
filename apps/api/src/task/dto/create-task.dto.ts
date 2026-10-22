import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedDurationMinutes?: number;
}
