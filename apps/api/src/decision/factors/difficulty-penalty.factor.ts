import { DecisionCandidate, DecisionContext, DecisionFactor } from '../decision.types';

export class DifficultyPenaltyFactor implements DecisionFactor {
  key = 'difficultyPenalty';
  evaluate(candidate: DecisionCandidate, _context: DecisionContext): number {
    if (candidate.difficulty == null) return 50;
    return Math.max(0, Math.min(100, candidate.difficulty * 20));
  }
}
