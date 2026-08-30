export type UserUpdateResponse = { ok: true; data: Array<{ content: string }> } | { ok: false; reason: 'AI_UNAVAILABLE' };

export function userUpdateMessage(result: UserUpdateResponse) {
  if (!result.ok) throw new Error('ATLAS AI is unavailable right now.');
  return result.data.map((item) => item.content).join(', ') || 'Update received by ATLAS.';
}
