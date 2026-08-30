import { userUpdateMessage } from '../lib/ai-updates';

describe('AI user-update response handling', () => {
  it('renders all routed pieces returned by the backend', () => {
    expect(userUpdateMessage({ ok: true, data: [{ content: 'I have less time today.' }, { content: 'Keep the current priority.' }] })).toBe('I have less time today., Keep the current priority.');
  });

  it('does not treat AI_UNAVAILABLE as a successful update', () => {
    expect(() => userUpdateMessage({ ok: false, reason: 'AI_UNAVAILABLE' })).toThrow('ATLAS AI is unavailable right now.');
  });
});
