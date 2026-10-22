export async function requestJson(url: string, init: RequestInit, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, init);
    if (response.status === 429 && attempt < retries) {
      const errorBody = await response.text().catch(() => '');
      const match = errorBody.match(/try again in ([\d.]+)s/i);
      const delayMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 2500;
      await new Promise((r) => setTimeout(r, Math.min(delayMs, 8000)));
      continue;
    }
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`AI provider returned HTTP ${response.status}${errorBody ? `: ${errorBody}` : ''}`);
    }
    return response.json();
  }
}

export function parseStructuredText(text: string): object {
  const trimmed = text.trim();
  try {
    const directClean = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(directClean);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as object;
  } catch {}

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as object;
    } catch {}
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as object;
    } catch {}
  }

  throw new Error('AI provider returned a non-object structured result');
}

export function safePromptContext(context: Record<string, unknown>): string {
  return JSON.stringify(context, (key, value) => {
    if (/(secret|api[_-]?key|password(hash)?|authorization|bearer|jwt|accessToken|refreshToken)/i.test(key)) return '[REDACTED]';
    return value;
  });
}
