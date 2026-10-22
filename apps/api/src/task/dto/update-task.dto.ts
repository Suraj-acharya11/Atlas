import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'paused', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsString()
  projectId?: string | null;

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
  estimatedDurationMinutes?: number | null;
}
