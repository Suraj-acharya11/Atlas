import { applyDecay, applyEvidence, isActive } from '../src/knowledge/confidence.util';

describe('Knowledge confidence formula', () => {
  it('applies supporting evidence with cap', () => {
    expect(applyEvidence(20, true)).toBe(35);
    expect(applyEvidence(90, true)).toBe(95);
  });
  it('applies contradicting evidence with floor', () => {
    expect(applyEvidence(50, false)).toBe(30);
    expect(applyEvidence(10, false)).toBe(0);
  });
  it('decays only after the 21-day threshold and never below zero', () => {
    expect(applyDecay(80, 2)).toBe(80);
    expect(applyDecay(80, 3)).toBe(70);
    expect(applyDecay(5, 4)).toBe(0);
  });
  it('requires both confidence and evidence count to activate', () => {
    expect(isActive(50, 1)).toBe(false);
    expect(isActive(49, 2)).toBe(false);
    expect(isActive(50, 2)).toBe(true);
  });
});
