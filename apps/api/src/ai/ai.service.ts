import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AI_CACHE, AI_PROVIDER } from './ai.tokens';
import { AiProvider, AiResult, AiResponse, RoutedUpdatePiece, WorkAnalysis } from './ai.types';

const WORK_ANALYSIS_SCHEMA = { subject: 'string', workType: 'string', topics: ['string'], sections: ['string'], explicitRequirements: ['string'], explicitPrerequisites: ['string'], complexityIndicator: ['low|moderate|high|uncertain'], estimatedGenericEffort: "uncertain|{value:number,unit:string}" };

@Injectable()
export class AiService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider, @Inject(AI_CACHE) private readonly cache: Redis) {}

  async generate(prompt: string, context: Record<string, unknown> = {}): Promise<AiResult<AiResponse>> {
    try { return { ok: true, data: await this.provider.generate(prompt, context) }; } catch { return { ok: false, reason: 'AI_UNAVAILABLE' }; }
  }

  async extractStructured(prompt: string, schema: object, context: Record<string, unknown> = {}): Promise<AiResult<object>> {
    try { return { ok: true, data: await this.provider.extractStructured(prompt, schema, context) }; } catch { return { ok: false, reason: 'AI_UNAVAILABLE' }; }
  }

  async analyzeWork(requestId: string, subject: string, context: Record<string, unknown> = {}): Promise<AiResult<WorkAnalysis>> {
    const cached = await this.cache.get(this.cacheKey(requestId));
    if (cached) return { ok: true, data: JSON.parse(cached) as WorkAnalysis };
    const result = await this.extractStructured('Analyze this work generically. Never estimate personalized duration and use "uncertain" when evidence is missing.', WORK_ANALYSIS_SCHEMA, { ...context, subject });
    if (!result.ok) return result;
    const analysis = this.normalizeWorkAnalysis(result.data, subject);
    await this.cache.setex(this.cacheKey(requestId), 7200, JSON.stringify(analysis));
    return { ok: true, data: analysis };
  }

  async interpretUserUpdate(message: string, context: Record<string, unknown> = {}): Promise<AiResult<RoutedUpdatePiece[]>> {
    const result = await this.extractStructured('Split this user update into separate routed pieces. Do not merge unrelated topics. Mark uncertain pieces explicitly.', { pieces: [{ kind: 'time_constraint|current_state|preference|other', content: 'string', confidence: 'certain|uncertain' }] }, { ...context, message });
    if (!result.ok) return result;
    const pieces = Array.isArray((result.data as any).pieces) ? (result.data as any).pieces : [];
    return { ok: true, data: pieces.map((piece: any) => ({ kind: ['time_constraint', 'current_state', 'preference', 'other'].includes(piece.kind) ? piece.kind : 'other', content: typeof piece.content === 'string' ? piece.content : 'uncertain', confidence: piece.confidence === 'certain' ? 'certain' : 'uncertain' })) };
  }

  private normalizeWorkAnalysis(value: object, subject: string): WorkAnalysis {
    const data = value as Partial<WorkAnalysis>;
    const complexity = ['low', 'moderate', 'high', 'uncertain'].includes(data.complexityIndicator ?? '') ? data.complexityIndicator! : 'uncertain';
    const effort = data.estimatedGenericEffort && data.estimatedGenericEffort !== 'uncertain' && typeof data.estimatedGenericEffort === 'object' && typeof data.estimatedGenericEffort.value === 'number' && typeof data.estimatedGenericEffort.unit === 'string' ? data.estimatedGenericEffort : 'uncertain';
    return { subject: data.subject || subject, workType: data.workType || 'uncertain', topics: Array.isArray(data.topics) ? data.topics : [], sections: Array.isArray(data.sections) ? data.sections : [], explicitRequirements: Array.isArray(data.explicitRequirements) ? data.explicitRequirements : [], explicitPrerequisites: Array.isArray(data.explicitPrerequisites) ? data.explicitPrerequisites : [], complexityIndicator: complexity as WorkAnalysis['complexityIndicator'], estimatedGenericEffort: effort };
  }
  private cacheKey(requestId: string): string { return `ai:work-analysis:${requestId}`; }
}
