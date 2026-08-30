export type DecisionCandidate = {
  id: string;
  title: string;
  projectId?: string | null;
  goalIds?: string[];
  activeGoalIds?: string[];
  deadline?: Date | null;
  estimatedDurationMinutes?: number | null;
  difficulty?: number | null;
  goalImportance?: number;
  knowledgeConfidence?: number;
  isRecovery?: boolean;
};

export type DecisionContext = {
  now?: Date;
  availableMinutes?: number;
  energy?: number;
  primaryGoalId?: string;
  recoveryCandidate?: DecisionCandidate;
};

export type DecisionFactor = {
  key: string;
  evaluate(candidate: DecisionCandidate, context: DecisionContext): number;
};

export type FactorBreakdown = { key: string; rawValue: number; weight: number; weightedValue: number };
export type DecisionConfidenceLabel = 'low' | 'moderate' | 'high';
