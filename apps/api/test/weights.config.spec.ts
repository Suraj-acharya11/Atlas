import { selectWeightProfile, WEIGHTS } from '../src/decision/weights.config';

describe('Decision weight profiles', () => {
  it('uses normal weights unless a candidate reaches deadline urgency 80', () => {
    expect(selectWeightProfile([{ deadlineUrgency: 79 }])).toBe('normal');
    expect(selectWeightProfile([{ deadlineUrgency: 80 }])).toBe('deadline_critical');
    expect(WEIGHTS.deadline_critical.deadlineUrgency).toBe(0.35);
  });
});
