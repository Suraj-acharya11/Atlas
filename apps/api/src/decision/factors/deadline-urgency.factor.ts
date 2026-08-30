import { DecisionCandidate, DecisionContext, DecisionFactor } from '../decision.types';

export class DeadlineUrgencyFactor implements DecisionFactor {
  key = 'deadlineUrgency';
  evaluate(candidate: DecisionCandidate, context: DecisionContext): number {
    if (!candidate.deadline) return 0;
    const days = (candidate.deadline.getTime() - (context.now ?? new Date()).getTime()) / 86_400_000;
    return Math.max(0, Math.min(100, 100 - (days / 14) * 100));
  }
}
