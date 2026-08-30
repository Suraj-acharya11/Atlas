import { DecisionCandidate, DecisionContext, DecisionFactor } from '../decision.types';

export class ContextFitFactor implements DecisionFactor {
  key = 'contextFit';
  evaluate(candidate: DecisionCandidate, context: DecisionContext): number {
    if (!candidate.estimatedDurationMinutes || !context.availableMinutes || context.availableMinutes <= 0) return 50;
    if (candidate.estimatedDurationMinutes <= context.availableMinutes) return 100;
    return Math.max(0, 100 - ((candidate.estimatedDurationMinutes - context.availableMinutes) / candidate.estimatedDurationMinutes) * 100);
  }
}
