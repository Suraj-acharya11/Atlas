import { KnowledgeService } from './knowledge.service';
import { KNOWLEDGE_CATEGORIES } from './schemas/knowledge.schema';

export type InitialSeedItem = {
  subject: string;
  predicate: string;
  object: string;
  category: (typeof KNOWLEDGE_CATEGORIES)[number];
};

/**
 * 7 strong explicit and behavioral observations from source data.
 * Speculative narrative hypotheses are intentionally excluded.
 */
export const INITIAL_PERSONALIZATION_ITEMS: InitialSeedItem[] = [
  {
    subject: 'user',
    predicate: 'prefers_strict_feedback',
    object: 'feedback',
    category: 'preference',
  },
  {
    subject: 'user',
    predicate: 'prefers_actionable_guidance',
    object: 'guidance',
    category: 'preference',
  },
  {
    subject: 'user',
    predicate: 'values_practical_competence',
    object: 'competence',
    category: 'preference',
  },
  {
    subject: 'user',
    predicate: 'challenges_canonical_solutions',
    object: 'solutions',
    category: 'behavioral_pattern',
  },
  {
    subject: 'user',
    predicate: 'learns_by_constructing_first',
    object: 'implementation',
    category: 'behavioral_pattern',
  },
  {
    subject: 'user',
    predicate: 'prefers_minimal_complexity',
    object: 'architecture',
    category: 'preference',
  },
  {
    subject: 'user',
    predicate: 'sensitive_to_omissions',
    object: 'constraints',
    category: 'behavioral_pattern',
  },
];

/**
 * Seeds initial personalization for a user through the standard KnowledgeService.evaluate pipeline.
 * Evaluates 2 imported supporting events per item to establish active status (confidence 50, evidenceCount 2)
 * without manufacturing synthetic internal Event IDs.
 */
export async function seedInitialPersonalization(
  knowledgeService: KnowledgeService,
  userId: string,
): Promise<number> {
  let seededCount = 0;

  for (const item of INITIAL_PERSONALIZATION_ITEMS) {
    const existing = await knowledgeService.query(userId, {
      predicate: item.predicate,
      subject: item.subject,
    });

    if (existing.length > 0) continue;

    // Evaluate initial imported evidence (2 supporting evaluations to reach active threshold)
    await knowledgeService.evaluate({
      userId,
      payload: {
        knowledge: {
          ...item,
          supports: true,
        },
      },
    });

    await knowledgeService.evaluate({
      userId,
      payload: {
        knowledge: {
          ...item,
          supports: true,
        },
      },
    });

    seededCount++;
  }

  return seededCount;
}
