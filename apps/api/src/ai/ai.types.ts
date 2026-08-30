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
