import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { KNOWLEDGE_CATEGORIES } from '../../knowledge/schemas/knowledge.schema';

export class ImportProfilePreferencesDto {
  @IsOptional()
  @IsString()
  planningStyle?: string;

  @IsOptional()
  @IsString()
  preferredWorkStyle?: string;

  @IsOptional()
  @IsBoolean()
  aiAssistance?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyPlanning?: boolean;

  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  deepWorkStrict?: boolean;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

export class ImportProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Transform(({ value }) => (value != null ? String(value) : undefined))
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  longTermDirection?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

export class ImportGoalDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'in_progress' || value === 'open' || value === 'pending' || value === 'todo') return 'active';
    if (value === 'done') return 'completed';
    return value;
  })
  @IsIn(['active', 'completed', 'archived'])
  status?: 'active' | 'completed' | 'archived';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  successCriteria?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strategy?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentFocus?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areas?: string[];

  @IsOptional()
  @IsString()
  vision?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  architecture?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focus?: string[];

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  createdAt?: string | Date;

  @IsOptional()
  updatedAt?: string | Date;

  @IsOptional()
  archivedAt?: string | Date | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ImportProjectDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  @IsString()
  goalId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'in_progress' || value === 'open' || value === 'pending' || value === 'todo') return 'active';
    if (value === 'done') return 'completed';
    return value;
  })
  @IsIn(['active', 'completed', 'archived'])
  status?: 'active' | 'completed' | 'archived';

  @IsOptional()
  createdAt?: string | Date;

  @IsOptional()
  updatedAt?: string | Date;

  @IsOptional()
  archivedAt?: string | Date | null;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  deadline?: string;
}

export class ImportTaskDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  @IsString()
  goalId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : undefined))
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'pending' || value === 'open' || value === 'active' || value === 'recurring') return 'todo';
    if (value === 'done') return 'completed';
    return value;
  })
  @IsIn(['todo', 'in_progress', 'paused', 'completed', 'cancelled'])
  status?: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

  @IsOptional()
  @IsString()
  deadline?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedDurationMinutes?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return 'medium';
    const s = String(value).toLowerCase();
    if (s === 'critical') return 'urgent';
    if (['low', 'medium', 'high', 'urgent'].includes(s)) return s;
    return 'medium';
  })
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtasks?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testQuestions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentTopics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nextTopics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  practiceMethod?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technology?: string[];

  @IsOptional()
  @IsString()
  recurrence?: string;

  @IsOptional()
  createdAt?: string | Date;

  @IsOptional()
  updatedAt?: string | Date;

  @IsOptional()
  completedAt?: string | Date | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ImportHabitDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  _id?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  goalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class ImportEventDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  occurredAt?: string | Date;

  @IsOptional()
  timestamp?: string | Date;

  @IsOptional()
  createdAt?: string | Date;

  @IsOptional()
  @IsString()
  relatedGoalId?: string;

  @IsOptional()
  @IsString()
  relatedProjectId?: string;

  @IsOptional()
  @IsString()
  relatedTaskId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class ImportKnowledgeDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value !== null) {
      return value.title || value.name || value.id || JSON.stringify(value);
    }
    return value ? String(value) : undefined;
  })
  @IsString()
  subject?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value !== null) {
      return value.title || value.name || value.id || JSON.stringify(value);
    }
    return value ? String(value) : undefined;
  })
  @IsString()
  predicate?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value !== null) {
      return value.title || value.name || value.id || JSON.stringify(value);
    }
    return value ? String(value) : undefined;
  })
  @IsString()
  object?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const valStr = String(value || '').toLowerCase();
    return KNOWLEDGE_CATEGORIES.includes(valStr as any) ? valStr : 'context';
  })
  @IsIn(KNOWLEDGE_CATEGORIES)
  category?: (typeof KNOWLEDGE_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'number') return value;
    if (value === 'high') return 90;
    if (value === 'medium') return 70;
    if (value === 'low') return 50;
    const n = Number(value);
    return isNaN(n) ? 80 : n;
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  confidence?: number;

  @IsOptional()
  @IsIn(['pending', 'active'])
  status?: 'pending' | 'active';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportingEventIds?: string[];

  @IsOptional()
  @IsInt()
  evidenceCount?: number;

  @IsOptional()
  @IsString()
  supersededBy?: string | null;

  @IsOptional()
  createdAt?: string | Date;

  @IsOptional()
  lastUpdatedAt?: string | Date;
}

export class ImportUpcomingDeadlineDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

export class ImportDailyPlanningContextDto {
  @IsOptional()
  @IsString()
  currentDate?: string;

  @IsOptional()
  @IsString()
  primaryObjective?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUpcomingDeadlineDto)
  importantUpcomingDeadlines?: ImportUpcomingDeadlineDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  planningConsiderations?: string[];
}

export class ImportSkillsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  current?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  developing?: string[];
}

export class ImportPlansDto {
  @IsOptional()
  @IsArray()
  missions?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  weeklyPlans?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  weekly_plans?: Record<string, unknown>[];
}

export class ImportUserDataDto {
  @IsOptional()
  @IsInt()
  schemaVersion?: number;

  @IsOptional()
  @IsString()
  exportedAt?: string;

  @IsOptional()
  @IsString()
  exportDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportProfileDto)
  profile?: ImportProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportProfileDto)
  user?: ImportProfileDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportGoalDto)
  goals?: ImportGoalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProjectDto)
  projects?: ImportProjectDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTaskDto)
  tasks?: ImportTaskDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportHabitDto)
  habits?: ImportHabitDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEventDto)
  events?: ImportEventDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportKnowledgeDto)
  knowledge?: ImportKnowledgeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportDailyPlanningContextDto)
  dailyPlanningContext?: ImportDailyPlanningContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportSkillsDto)
  skills?: ImportSkillsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportPlansDto)
  plans?: ImportPlansDto;

  @IsOptional()
  @IsArray()
  missions?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  weeklyPlans?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  documents?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  reflections?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  learningSignals?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  decisions?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  stats?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  history?: Record<string, unknown>[];
}

export interface ImportSummary {
  imported: {
    goals: number;
    projects: number;
    tasks: number;
    knowledge: number;
    habits?: number;
    events?: number;
  };
  skippedDuplicates: {
    goals: number;
    projects: number;
    tasks: number;
    knowledge: number;
    habits?: number;
    events?: number;
  };
  message: string;
}
