import { DecisionCandidate, DecisionContext, DecisionFactor } from '../decision.types';

export class GoalImportanceFactor implements DecisionFactor {
  key = 'goalImportance';
  evaluate(candidate: DecisionCandidate, context: DecisionContext): number {
    if (typeof candidate.goalImportance === 'number') return Math.max(0, Math.min(100, candidate.goalImportance));
    if (!candidate.activeGoalIds?.length) return 0;
    return candidate.activeGoalIds.includes(context.primaryGoalId ?? '') ? 100 : 50;
  }
}
