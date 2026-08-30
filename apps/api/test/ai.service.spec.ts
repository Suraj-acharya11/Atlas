import { AiService } from '../src/ai/ai.service';
import { createAiProvider, createEmbeddingProvider } from '../src/ai/ai.module';
import { GeminiProvider } from '../src/ai/gemini.provider';
import { GroqProvider } from '../src/ai/groq.provider';

const config = (values: Record<string, string>) => ({ get: jest.fn((key: string) => values[key]), getOrThrow: jest.fn((key: string) => values[key]) }) as any;

describe('Phase 7 AI provider selection', () => {
  it('switches reasoning provider using AI_PROVIDER only', () => {
    expect(createAiProvider(config({ AI_PROVIDER: 'gemini' }))).toBeInstanceOf(GeminiProvider);
    expect(createAiProvider(config({ AI_PROVIDER: 'groq' }))).toBeInstanceOf(GroqProvider);
  });
  it('selects embeddings independently from reasoning', () => {
    expect(createEmbeddingProvider(config({ AI_PROVIDER: 'groq', EMBEDDING_PROVIDER: 'gemini' }))).toBeInstanceOf(GeminiProvider);
  });
});

describe('AiService', () => {
  it('returns typed AI_UNAVAILABLE instead of throwing', async () => {
    const provider = { generate: jest.fn().mockRejectedValue(new Error('quota')), extractStructured: jest.fn() };
    const service = new AiService(provider as any, {} as any);
    await expect(service.generate('hello')).resolves.toEqual({ ok: false, reason: 'AI_UNAVAILABLE' });
  });

  it('normalizes uncertain WorkAnalysis fields and caches them for two hours', async () => {
    const provider = { extractStructured: jest.fn().mockResolvedValue({ workType: 'study', complexityIndicator: 'not-valid' }), generate: jest.fn() };
    const cache = { get: jest.fn().mockResolvedValue(null), setex: jest.fn().mockResolvedValue('OK') };
    const service = new AiService(provider as any, cache as any);
    const result = await service.analyzeWork('request-1', 'DBMS assignment');
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ subject: 'DBMS assignment', workType: 'study', complexityIndicator: 'uncertain', estimatedGenericEffort: 'uncertain', topics: [] }) });
    expect(cache.setex).toHaveBeenCalledWith('ai:work-analysis:request-1', 7200, expect.any(String));
  });

  it('returns separately routed pieces for a multi-topic update', async () => {
    const provider = { extractStructured: jest.fn().mockResolvedValue({ pieces: [{ kind: 'time_constraint', content: '30 minutes', confidence: 'certain' }, { kind: 'current_state', content: 'exhausted', confidence: 'uncertain' }, { kind: 'preference', content: 'avoid project tonight', confidence: 'certain' }] }), generate: jest.fn() };
    const service = new AiService(provider as any, {} as any);
    await expect(service.interpretUserUpdate('I only have 30 minutes, I am exhausted, and I do not want this project tonight')).resolves.toEqual({ ok: true, data: [expect.objectContaining({ kind: 'time_constraint' }), expect.objectContaining({ kind: 'current_state' }), expect.objectContaining({ kind: 'preference' })] });
  });
});
