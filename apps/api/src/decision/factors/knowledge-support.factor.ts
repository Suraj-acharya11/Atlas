import { DecisionCandidate, DecisionContext, DecisionFactor } from '../decision.types';

export class KnowledgeSupportFactor implements DecisionFactor {
  key = 'knowledgeSupport';
  evaluate(candidate: DecisionCandidate, _context: DecisionContext): number {
    return Math.max(0, Math.min(100, candidate.knowledgeConfidence ?? 0));
  }
}
