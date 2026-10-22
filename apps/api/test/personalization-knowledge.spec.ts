import { Types } from 'mongoose';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import {
  INITIAL_PERSONALIZATION_ITEMS,
  seedInitialPersonalization,
} from '../src/knowledge/initial-personalization.seed';
import { AiService } from '../src/ai/ai.service';

const userId = '507f1f77bcf86cd799439011';

describe('Personalization Knowledge Integration', () => {
  describe('Initial Knowledge Seeding', () => {
    it('seeds exactly the 7 strong observations as active knowledge and leaves hypotheses unseeded', async () => {
      const storedRelationships: any[] = [];

      const model: any = {
        find: jest.fn().mockImplementation((query: any) => ({
          sort: () => ({
            lean: () => ({
              exec: async () => {
                return storedRelationships.filter((r) => {
                  if (query.userId && !r.userId.equals(query.userId)) return false;
                  if (query.subject && r.subject !== query.subject) return false;
                  if (query.predicate && r.predicate !== query.predicate) return false;
                  if (query.status && r.status !== query.status) return false;
                  return true;
                });
              },
            }),
          }),
          exec: async () => [],
        })),
        findOne: jest.fn().mockImplementation((query: any) => ({
          exec: async () => {
            return (
              storedRelationships.find((r) => {
                if (query.userId && !r.userId.equals(query.userId)) return false;
                if (query.subject && r.subject !== query.subject) return false;
                if (query.predicate && r.predicate !== query.predicate) return false;
                if (query.object && r.object !== query.object) return false;
                return true;
              }) ?? null
            );
          },
        })),
        create: jest.fn().mockImplementation(async (data: any) => {
          const doc = {
            ...data,
            _id: new Types.ObjectId(),
            save: jest.fn().mockImplementation(async function (this: any) {
              return this;
            }),
          };
          storedRelationships.push(doc);
          return doc;
        }),
      };

      const knowledgeService = new KnowledgeService(model);

      // Seed initial personalization
      const count = await seedInitialPersonalization(knowledgeService, userId);
      expect(count).toBe(7);

      // Verify all 7 are active with confidence 50 and evidence count 2
      const activeKnowledge = await knowledgeService.query(userId, { status: 'active' });
      expect(activeKnowledge.length).toBe(7);

      const predicates = activeKnowledge.map((k) => k.predicate);
      expect(predicates).toEqual(
        expect.arrayContaining([
          'prefers_strict_feedback',
          'prefers_actionable_guidance',
          'values_practical_competence',
          'challenges_canonical_solutions',
          'learns_by_constructing_first',
          'prefers_minimal_complexity',
          'sensitive_to_omissions',
        ]),
      );

      for (const k of activeKnowledge) {
        expect(k.confidence).toBe(50);
        expect(k.evidenceCount).toBe(2);
        expect(k.status).toBe('active');
        // Does not manufacture fake ATLAS event IDs
        expect(k.supportingEventIds).toEqual([]);
      }

      // Verify hypotheses from blunt analysis remain completely unseeded
      const unseededHypotheses = [
        'pattern_hesitation_as_optimization',
        'pattern_action_vs_understanding_sequence',
        'pattern_outsourcing_the_stopping_point',
        'pattern_contrarian_instinct_ambiguous_cause',
        'pattern_compressing_the_path',
        'risk_guided_competence_without_independent_practice',
      ];
      for (const hypothesis of unseededHypotheses) {
        const found = await knowledgeService.query(userId, { predicate: hypothesis });
        expect(found.length).toBe(0);
      }

      // Idempotency: calling again should not duplicate
      const secondCount = await seedInitialPersonalization(knowledgeService, userId);
      expect(secondCount).toBe(0);
    });
  });

  describe('Contradicting and Supporting Evidence Evolution', () => {
    it('demotes active relationship to pending when contradicted by future conversation evidence', async () => {
      let relationship: any = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        subject: 'user',
        predicate: 'prefers_strict_feedback',
        object: 'feedback',
        category: 'preference',
        confidence: 50,
        evidenceCount: 2,
        supportingEventIds: [],
        status: 'active',
        supersededBy: null,
        lastUpdatedAt: new Date(),
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      const model: any = {
        findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(relationship) }),
        find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      };

      const knowledgeService = new KnowledgeService(model);

      // Future conversation produces contradictory evidence (e.g. user repeatedly requests gentle feedback)
      const updated = await knowledgeService.evaluate({
        userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'prefers_strict_feedback',
            object: 'feedback',
            category: 'preference',
            supports: false,
          },
        },
      });

      // Confidence drops by 20 (50 -> 30) and status demotes to pending without deleting the relationship
      expect(updated).not.toBeNull();
      expect(relationship.confidence).toBe(30);
      expect(relationship.evidenceCount).toBe(3);
      expect(relationship.status).toBe('pending');

      // Subsequent supporting evidence can restore confidence
      await knowledgeService.evaluate({
        userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'prefers_strict_feedback',
            object: 'feedback',
            category: 'preference',
            supports: true,
          },
        },
      });

      // Restored: 30 + 15 = 45 (still pending until reaches 50)
      expect(relationship.confidence).toBe(45);
      expect(relationship.status).toBe('pending');

      await knowledgeService.evaluate({
        userId,
        payload: {
          knowledge: {
            subject: 'user',
            predicate: 'prefers_strict_feedback',
            object: 'feedback',
            category: 'preference',
            supports: true,
          },
        },
      });

      // Restored: 45 + 15 = 60 (active again)
      expect(relationship.confidence).toBe(60);
      expect(relationship.status).toBe('active');
    });
  });

  describe('AI Interaction Layer Context Consumption', () => {
    it('injects humanized active knowledge into prompt and enforces immediate-message priority', async () => {
      const activeKnowledge = [
        {
          subject: 'user',
          predicate: 'prefers_strict_feedback',
          object: 'feedback',
          category: 'preference',
          confidence: 50,
          status: 'active',
        },
        {
          subject: 'user',
          predicate: 'prefers_actionable_guidance',
          object: 'guidance',
          category: 'preference',
          confidence: 50,
          status: 'active',
        },
      ];

      const knowledgeService: any = {
        query: jest.fn().mockResolvedValue(activeKnowledge),
      };

      let capturedPrompt = '';
      const provider: any = {
        extractStructured: jest.fn().mockImplementation(async (prompt: string) => {
          capturedPrompt = prompt;
          return {
            text: 'Here is a direct evaluation with concrete next steps.',
            action: null,
          };
        }),
      };

      const aiService = new AiService(provider, {} as any, knowledgeService);

      const result = await aiService.generate('Review my code attempt', {}, userId);

      expect(result.ok).toBe(true);
      expect(knowledgeService.query).toHaveBeenCalledWith(userId, { status: 'active' });

      // Check that prompt contains human-readable behavioral guidelines
      expect(capturedPrompt).toContain('The user prefers direct, blunt, and realistic evaluation');
      expect(capturedPrompt).toContain('The user prefers concrete next actions');

      // Check that immediate message priority rule is strictly enforced
      expect(capturedPrompt).toContain(
        "any direct instruction in the user's current message ALWAYS takes absolute precedence",
      );

      // Check that internal confidence values, predicate names, and IDs are NOT leaked
      expect(capturedPrompt).not.toContain('prefers_strict_feedback');
      expect(capturedPrompt).not.toContain('confidence');
      expect(capturedPrompt).not.toContain('ObjectId');
    });

    it('idempotently seeds initial personalization if missing on first chat, and does not re-seed on second chat', async () => {
      let stored: any[] = [];
      const knowledgeService: any = {
        query: jest.fn().mockImplementation(async (_uid: string, filter: any) => {
          let res = stored;
          if (filter?.predicate) {
            res = res.filter((s) => s.predicate === filter.predicate);
          }
          if (filter?.subject) {
            res = res.filter((s) => s.subject === filter.subject);
          }
          if (filter?.status) {
            res = res.filter((s) => s.status === filter.status);
          }
          return res;
        }),
        evaluate: jest.fn().mockImplementation(async (event: any) => {
          const k = event.payload.knowledge;
          let rel = stored.find((s) => s.predicate === k.predicate);
          if (!rel) {
            rel = { ...k, confidence: 20, evidenceCount: 0, status: 'pending' };
            stored.push(rel);
          }
          rel.confidence += 15;
          rel.evidenceCount += 1;
          if (rel.confidence >= 50 && rel.evidenceCount >= 2) rel.status = 'active';
          return rel;
        }),
      };

      const provider: any = {
        extractStructured: jest.fn().mockResolvedValue({ text: 'Reply', action: null }),
      };

      const aiService = new AiService(provider, {} as any, knowledgeService);

      // First call: user has no stored knowledge -> triggers seedInitialPersonalization
      await aiService.generate('First message', {}, userId);
      expect(stored.length).toBe(7);
      expect(stored.every((s) => s.status === 'active')).toBe(true);

      const evaluateCallsFirst = knowledgeService.evaluate.mock.calls.length;
      expect(evaluateCallsFirst).toBe(14); // 7 items * 2 evaluations

      // Second call: user already has knowledge -> does NOT re-seed
      await aiService.generate('Second message', {}, userId);
      expect(knowledgeService.evaluate.mock.calls.length).toBe(evaluateCallsFirst);
    });
  });
});
