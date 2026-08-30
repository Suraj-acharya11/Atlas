import { shouldRegenerate } from '../src/planning/regeneration.util';

describe('Planning regeneration gate', () => {
  it.each(['MOOD_UPDATED', 'ENERGY_UPDATED', 'HIGH_PRIORITY_TASK_ADDED', 'TASK_DEADLINE_CHANGED', 'USER_UNAVAILABLE', 'CALENDAR_COMMITMENT_CHANGED', 'MISSION_COMPLETED_EARLY'])('regenerates for %s', (type) => {
    expect(shouldRegenerate({}, { type })).toBe(true);
  });
  it('fails safe for unknown events', () => {
    expect(shouldRegenerate({}, { type: 'TASK_COMPLETED' })).toBe(false);
  });
});
