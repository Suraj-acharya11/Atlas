import { ConfigService } from '@nestjs/config';
import { AiProvider, AiResponse } from './ai.types';
import { parseStructuredText, requestJson, safePromptContext } from './provider-http.util';

export class GroqProvider implements AiProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(prompt: string, context: Record<string, unknown>): Promise<AiResponse> {
    const key = this.config.getOrThrow<string>('GROQ_API_KEY');
    const raw = await requestJson('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: `${prompt}\nContext: ${safePromptContext(context)}` }] }),
    });
    const text = raw?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('Malformed Groq response');
    return { text, raw };
  }

  async extractStructured(prompt: string, schema: object, context: Record<string, unknown>): Promise<object> {
    const response = await this.generate(`${prompt}\nReturn JSON matching this schema: ${JSON.stringify(schema)}`, context);
    return parseStructuredText(response.text);
  }
}
