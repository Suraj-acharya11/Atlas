import { DecisionCandidate, DecisionContext, DecisionFactor } from '../decision.types';

export class EnergyFitFactor implements DecisionFactor {
  key = 'energyFit';
  evaluate(candidate: DecisionCandidate, context: DecisionContext): number {
    if (candidate.difficulty == null || context.energy == null) return 50;
    return Math.max(0, 100 - Math.abs(candidate.difficulty - context.energy) * 25);
  }
}
