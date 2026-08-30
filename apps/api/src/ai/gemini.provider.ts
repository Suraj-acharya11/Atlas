import { ConfigService } from '@nestjs/config';
import { AiProvider, AiResponse, EmbeddingProvider } from './ai.types';
import { parseStructuredText, requestJson, safePromptContext } from './provider-http.util';

export class GeminiProvider implements AiProvider, EmbeddingProvider {
  constructor(private readonly config: ConfigService) {}
  async generate(prompt: string, context: Record<string, unknown>): Promise<AiResponse> {
    const key = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const body = { contents: [{ parts: [{ text: `${prompt}\nContext: ${safePromptContext(context)}` }] }] };
    const raw = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') throw new Error('Malformed Gemini response');
    return { text, raw };
  }
  async extractStructured(prompt: string, schema: object, context: Record<string, unknown>): Promise<object> {
    const response = await this.generate(`${prompt}\nReturn JSON matching this schema: ${JSON.stringify(schema)}`, context);
    return parseStructuredText(response.text);
  }
  async embed(text: string): Promise<number[]> {
    const key = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const raw = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: { parts: [{ text }] } }) });
    if (!Array.isArray(raw?.embedding?.values)) throw new Error('Malformed Gemini embedding response');
    return raw.embedding.values;
  }
}
