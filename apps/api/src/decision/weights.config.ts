import { DecisionCandidate } from './decision.types';

export const WEIGHTS = {
  normal: { goalImportance: 0.30, deadlineUrgency: 0.20, contextFit: 0.20, energyFit: 0.15, knowledgeSupport: 0.15, difficultyPenalty: -0.10 },
  deadline_critical: { deadlineUrgency: 0.35, goalImportance: 0.25, contextFit: 0.15, energyFit: 0.10, knowledgeSupport: 0.10, difficultyPenalty: -0.05 },
} as const;

export type WeightProfile = keyof typeof WEIGHTS;

export function selectWeightProfile(candidates: Array<{ deadlineUrgency?: number } | DecisionCandidate>, deadlineUrgency?: (candidate: DecisionCandidate) => number): WeightProfile {
  if (deadlineUrgency) return candidates.some((candidate) => deadlineUrgency(candidate as DecisionCandidate) >= 80) ? 'deadline_critical' : 'normal';
  return candidates.some((candidate) => (candidate as { deadlineUrgency?: number }).deadlineUrgency !== undefined && (candidate as { deadlineUrgency: number }).deadlineUrgency >= 80) ? 'deadline_critical' : 'normal';
}
