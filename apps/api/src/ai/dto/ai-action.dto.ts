import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTaskActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  deadline?: string | null;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsString()
  projectId?: string | null;
}

export class CreateGoalActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RequestReplanActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ExecuteAiActionDto {
  @IsIn(['CREATE_TASK', 'CREATE_GOAL', 'REQUEST_REPLAN'])
  actionType!: 'CREATE_TASK' | 'CREATE_GOAL' | 'REQUEST_REPLAN';

  @IsObject()
  parameters!: Record<string, unknown>;
}
