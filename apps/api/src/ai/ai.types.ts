export type AiResponse = { text: string; raw?: unknown };
export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: 'AI_UNAVAILABLE' };

export interface AiProvider {
  generate(prompt: string, context: Record<string, unknown>): Promise<AiResponse>;
  extractStructured(prompt: string, schema: object, context: Record<string, unknown>): Promise<object>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export type WorkAnalysis = {
  subject: string;
  workType: string;
  topics: string[];
  sections: string[];
  explicitRequirements: string[];
  explicitPrerequisites: string[];
  complexityIndicator: 'low' | 'moderate' | 'high' | 'uncertain';
  estimatedGenericEffort: 'uncertain' | { value: number; unit: string };
};

export type RoutedUpdatePiece = { kind: 'time_constraint' | 'current_state' | 'preference' | 'other'; content: string; confidence: 'certain' | 'uncertain' };

export type AiActionType = 'CREATE_TASK' | 'CREATE_GOAL' | 'REQUEST_REPLAN';

export type CreateTaskActionParameters = {
  title: string;
  deadline?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDurationMinutes?: number;
  projectId?: string | null;
};

export type CreateGoalActionParameters = {
  title: string;
  description?: string;
};

export type RequestReplanActionParameters = {
  reason?: string;
};

export type AiActionProposal =
  | {
      type: 'CREATE_TASK';
      parameters: CreateTaskActionParameters;
      requiresConfirmation: true;
      confirmationMessage: string;
    }
  | {
      type: 'CREATE_GOAL';
      parameters: CreateGoalActionParameters;
      requiresConfirmation: true;
      confirmationMessage: string;
    }
  | {
      type: 'REQUEST_REPLAN';
      parameters: RequestReplanActionParameters;
      requiresConfirmation: true;
      confirmationMessage: string;
    };

export type AiChatResultData = {
  text: string;
  action?: AiActionProposal | null;
  raw?: unknown;
};

export type AiActionResultData = {
  actionType: AiActionType;
  status: 'executed';
  text: string;
  entityId?: string;
  timetable?: unknown;
};
