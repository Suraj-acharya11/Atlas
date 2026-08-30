export const NEW_CANDIDATE_CONFIDENCE = 20;
export const SUPPORTING_EVIDENCE_DELTA = 15;
export const CONTRADICTING_EVIDENCE_DELTA = 20;
export const ACTIVE_CONFIDENCE_THRESHOLD = 50;
export const MIN_ACTIVE_EVIDENCE_COUNT = 2;
export const DECAY_AFTER_WEEKS = 3;
export const DECAY_DELTA = 10;

// Tunable placeholder formula from the V1 specification. Keep these exact values for V1.
export function applyEvidence(currentConfidence: number, isSupporting: boolean): number {
  const next = isSupporting ? currentConfidence + SUPPORTING_EVIDENCE_DELTA : currentConfidence - CONTRADICTING_EVIDENCE_DELTA;
  return Math.min(95, Math.max(0, next));
}

export function applyDecay(currentConfidence: number, weeksSinceLastEvidence: number): number {
  return weeksSinceLastEvidence >= DECAY_AFTER_WEEKS ? Math.max(0, currentConfidence - DECAY_DELTA) : currentConfidence;
}

export function isActive(confidence: number, evidenceCount: number): boolean {
  return confidence >= ACTIVE_CONFIDENCE_THRESHOLD && evidenceCount >= MIN_ACTIVE_EVIDENCE_COUNT;
}
