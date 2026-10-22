export type Goal = { _id: string; title: string; description?: string; status: 'active' | 'completed' | 'archived'; createdAt?: string };
export type Project = { _id: string; title: string; goalIds: string[]; status: 'active' | 'completed' | 'archived'; archivedAt?: string | null; createdAt?: string };
export type Task = {
  _id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDurationMinutes?: number | null;
  status: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  deadline?: string | null;
  projectId?: string | null;
  createdAt?: string;
};
export type MissionBlock = {
  id: string;
  taskId?: string | null;
  title: string;
  kind: 'fixed' | 'flexible';
  period: string;
  startsAt?: string | null;
  endsAt?: string | null;
};
export type FocusSession = {
  objective: string;
  durationMinutes: number;
  expectedOutcome: string;
  recommendedBreakMinutes: number;
  missionId: string;
};
export type Mission = {
  _id: string;
  date: string;
  objective?: string;
  supportingTaskIds?: string[];
  status?: 'active' | 'superseded' | 'completed';
  blocks?: MissionBlock[];
  focusSessions?: FocusSession[];
  createdAt?: string;
};
export type Decision = {
  _id: string;
  id?: string;
  topCandidateId?: string;
  topExplanation?: string;
  confidence?: number;
  confidenceLabel?: 'low' | 'moderate' | 'high';
  priorityList?: Array<{
    candidateId: string;
    title: string;
    score?: number;
    confidence?: number;
    confidenceLabel?: string;
    explanation?: string;
    factors?: Array<{ key: string; rawValue: number; weightedValue: number }>;
    estimatedDurationMinutes?: number | null;
  }>;
};
export type ReflectionValue = 'underestimated' | 'accurate' | 'overestimated';
export type Reflection = {
  _id: string;
  userId?: string;
  taskId: string;
  missionId: string;
  executionRecordId: string;
  timeEstimate: ReflectionValue;
  difficulty: ReflectionValue;
  progress: ReflectionValue;
  planAdherence: 'full' | 'partial' | 'none';
  cause: string;
  createdAt: string;
};
export type ExecutionStatus = 'started' | 'paused' | 'resumed' | 'completed' | 'partial' | 'abandoned';
export type ExecutionRecord = {
  _id: string;
  userId?: string;
  taskId: string;
  missionId: string;
  status: ExecutionStatus;
  startedAt: string;
  endedAt: string | null;
  actualDurationMinutes: number;
  progressPercent: number;
  createdAt?: string;
};
export type DocumentStatus = 'active' | 'referenced' | 'archived' | 'deleted';
export type DocumentRecord = {
  _id: string;
  userId?: string;
  filename: string;
  mimeType: 'application/pdf' | 'text/plain' | string;
  storagePath?: string;
  status: DocumentStatus;
  uploadedAt: string;
  lastUsedAt?: string | null;
  pageCount: number | null;
  extractedText: string | null;
};

export type AiActionProposal =
  | {
      type: 'CREATE_TASK';
      parameters: {
        title: string;
        deadline?: string | null;
        estimatedDurationMinutes?: number;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        projectId?: string | null;
      };
      requiresConfirmation: true;
      confirmationMessage: string;
    }
  | {
      type: 'CREATE_GOAL';
      parameters: {
        title: string;
        description?: string;
        targetDate?: string;
      };
      requiresConfirmation: true;
      confirmationMessage: string;
    }
  | {
      type: 'REQUEST_REPLAN';
      parameters: { reason?: string };
      requiresConfirmation: true;
      confirmationMessage: string;
    };

export type AiChatResultData = {
  text: string;
  action?: AiActionProposal | null;
};

export type AiActionResultData = {
  actionType: 'CREATE_TASK' | 'CREATE_GOAL' | 'REQUEST_REPLAN';
  status: 'executed';
  text: string;
  entityId?: string;
  timetable?: Mission;
};
