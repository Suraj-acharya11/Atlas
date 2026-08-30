export async function requestJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  return response.json();
}

export function parseStructuredText(text: string): object {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI provider returned a non-object structured result');
  return parsed as object;
}

export function safePromptContext(context: Record<string, unknown>): string {
  return JSON.stringify(context, (key, value) => {
    if (/(secret|api[_-]?key|password(hash)?|authorization|bearer|jwt|accessToken|refreshToken)/i.test(key)) return '[REDACTED]';
    return value;
  });
}
