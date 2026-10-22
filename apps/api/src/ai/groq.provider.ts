import { ConfigService } from '@nestjs/config';
import { AiProvider, AiResponse } from './ai.types';
import { parseStructuredText, requestJson, safePromptContext } from './provider-http.util';

export class GroqProvider implements AiProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(prompt: string, context: Record<string, unknown>, options?: { json?: boolean }): Promise<AiResponse> {
    const key = this.config.getOrThrow<string>('GROQ_API_KEY');
    const model = (typeof this.config.get === 'function' ? this.config.get<string>('GROQ_MODEL') : undefined) || 'openai/gpt-oss-20b';

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: `${prompt}\nContext: ${safePromptContext(context)}` }],
    };
    if (options?.json) {
      body.response_format = { type: 'json_object' };
    }
    const raw = await requestJson('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const text = raw?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('Malformed Groq response');
    return { text, raw };
  }

  async extractStructured(prompt: string, schema: object, context: Record<string, unknown>): Promise<object> {
    const response = await this.generate(`${prompt}\nReturn JSON matching this schema: ${JSON.stringify(schema)}`, context, { json: true });
    return parseStructuredText(response.text);
  }
}
