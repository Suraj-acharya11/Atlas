import { Types } from 'mongoose';
import { KnowledgeReflectionSignalProcessor } from '../src/knowledge/reflection-signal.processor';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { DecisionService } from '../src/decision/decision.service';
import { PlanningService } from '../src/planning/planning.service';

describe('Learning Loop Integration (learning.integration.spec.ts)', () => {
  const userId = '507f1f77bcf86cd799439011';

  describe('LearningSignal -> KnowledgeEvidence -> KnowledgeRelationship', () => {
    it('converts an underestimated signal into supporting evidence that activates knowledge after 2 events', async () => {
      const first = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        subject: 'user',
        predicate: 'underestimates_duration',
        object: 'task',
        category: 'behavioral_pattern',
        confidence: 20,
        evidenceCount: 0,
        supportingEventIds: [] as Types.ObjectId[],
        status: 'pending',
        lastUpdatedAt: new Date(),
        save: jest.fn(),
      } as any;
      first.save.mockResolvedValue(first);

      const second = {
        ...first,
        _id: new Types.ObjectId(),
        confidence: 35,
        evidenceCount: 1,
        supportingEventIds: [new Types.ObjectId()],
        status: 'pending',
        save: jest.fn(),
      } as any;
      second.save.mockResolvedValue(second);

      const model: any = {
        findOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(second),
        }),
        create: jest.fn().mockResolvedValue(first),
        find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      };

      const knowledgeService = new KnowledgeService(model);
      const processor = new KnowledgeReflectionSignalProcessor(knowledgeService);

      const underSignal = {
        userId,
        taskId: 't1',
        missionId: 'm1',
        timeEstimate: 'underestimated',
        difficulty: 'accurate',
        progress: 'accurate',
        planAdherence: 'full',
        cause: 'unknown',
      };

      // 1st signal -> pending (confidence: 35, evidence: 1)
      await processor.process({ data: { signalId: 's1', signal: underSignal } } as any);
      expect(first.confidence).toBe(35);
      expect(first.evidenceCount).toBe(1);
      expect(first.status).toBe('pending');

      // 2nd signal -> active (confidence: 50, evidence: 2)
      await processor.process({ data: { signalId: 's2', signal: underSignal } } as any);
      expect(second.confidence).toBe(50);
      expect(second.evidenceCount).toBe(2);
      expect(second.status).toBe('active');
    });

    it('accurate signal provides contradicting evidence to reduce bias confidence without deleting', async () => {
      const relationshipUnder = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        subject: 'user',
        predicate: 'underestimates_duration',
        object: 'task',
        category: 'behavioral_pattern',
        confidence: 50,
        evidenceCount: 2,
        supportingEventIds: [new Types.ObjectId(), new Types.ObjectId()],
        status: 'active',
        lastUpdatedAt: new Date(),
        save: jest.fn(),
      } as any;
      relationshipUnder.save.mockResolvedValue(relationshipUnder);

      const model: any = {
        findOne: jest.fn().mockImplementation((query: any) => ({
          exec: jest.fn().mockResolvedValue(
            query.predicate === 'underestimates_duration' ? relationshipUnder : null,
          ),
        })),
        create: jest.fn().mockImplementation((doc: any) => {
          const created = { ...doc, save: jest.fn().mockResolvedValue(doc) };
          return Promise.resolve(created);
        }),
        find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        deleteOne: jest.fn(),
      };

      const knowledgeService = new KnowledgeService(model);
      const processor = new KnowledgeReflectionSignalProcessor(knowledgeService);

      const accurateSignal = {
        userId,
        taskId: 't1',
        missionId: 'm1',
        timeEstimate: 'accurate',
        difficulty: 'accurate',
        progress: 'accurate',
        planAdherence: 'full',
        cause: 'unknown',
      };

      await processor.process({ data: { signalId: 's3', signal: accurateSignal } } as any);

      // Contradicting evidence on underestimates_duration: 50 - 20 = 30 -> drops back to 'pending'
      expect(relationshipUnder.confidence).toBe(30);
      expect(relationshipUnder.status).toBe('pending');
      expect(model.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('Active Knowledge -> Decision -> Planning behavior', () => {
    it('elevates knowledgeConfidence for candidates when active knowledge exists', async () => {
      const activeRelationship = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        subject: 'user',
        predicate: 'underestimates_duration',
        object: 'task',
        category: 'behavioral_pattern',
        confidence: 65,
        status: 'active',
      };

      const taskId = new Types.ObjectId();
      const tasks = {
        findAll: jest.fn().mockResolvedValue([
          { _id: taskId, title: 'Write tests', status: 'todo', projectId: null, deadline: null },
        ]),
      };
      const projects = { findAll: jest.fn().mockResolvedValue([]) };
      const goals = { findAll: jest.fn().mockResolvedValue([]) };
      const knowledge = {
        query: jest.fn().mockResolvedValue([activeRelationship]),
      };
      const ml = { getAdjustment: jest.fn().mockResolvedValue({ adjustment: 0, reliable: false }) };
      const events = { record: jest.fn() };
      const model: any = { create: jest.fn().mockImplementation((doc: any) => ({ _id: new Types.ObjectId(), ...doc })) };

      const factors = [
        {
          key: 'knowledgeSupport',
          evaluate: (c: any) => c.knowledgeConfidence ?? 0,
        },
      ];

      const decisionService = new DecisionService(
        model,
        factors as any,
        tasks as any,
        projects as any,
        goals as any,
        knowledge as any,
        ml as any,
        events as any,
      );

      const decision = await decisionService.generate(userId, {});

      expect(knowledge.query).toHaveBeenCalledWith(userId, { status: 'active' });
      expect(model.create).toHaveBeenCalled();
      const createdDoc = model.create.mock.calls[0][0];
      const candidateResult = createdDoc.priorityList[0];
      expect(candidateResult.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'knowledgeSupport', rawValue: 65 }),
        ]),
      );
    });

    it('inactive / pending knowledge does not elevate knowledgeConfidence (score = 0)', async () => {
      const taskId = new Types.ObjectId();
      const tasks = {
        findAll: jest.fn().mockResolvedValue([
          { _id: taskId, title: 'Write tests', status: 'todo', projectId: null, deadline: null },
        ]),
      };
      const projects = { findAll: jest.fn().mockResolvedValue([]) };
      const goals = { findAll: jest.fn().mockResolvedValue([]) };
      // query for status: 'active' returns empty array because knowledge is pending
      const knowledge = {
        query: jest.fn().mockResolvedValue([]),
      };
      const ml = { getAdjustment: jest.fn().mockResolvedValue({ adjustment: 0, reliable: false }) };
      const events = { record: jest.fn() };
      const model: any = { create: jest.fn().mockImplementation((doc: any) => ({ _id: new Types.ObjectId(), ...doc })) };

      const factors = [
        {
          key: 'knowledgeSupport',
          evaluate: (c: any) => c.knowledgeConfidence ?? 0,
        },
      ];

      const decisionService = new DecisionService(
        model,
        factors as any,
        tasks as any,
        projects as any,
        goals as any,
        knowledge as any,
        ml as any,
        events as any,
      );

      await decisionService.generate(userId, {});

      const createdDoc = model.create.mock.calls[0][0];
      const candidateResult = createdDoc.priorityList[0];
      expect(candidateResult.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'knowledgeSupport', rawValue: 0 }),
        ]),
      );
    });

    it('preserves existing planning behavior and focus session defaults', async () => {
      const topTaskId = new Types.ObjectId();
      const decisionDoc = {
        _id: new Types.ObjectId(),
        priorityList: [{ candidateId: topTaskId.toHexString(), title: 'Important Task' }],
      };
      const createdMission: any = {
        _id: new Types.ObjectId(),
        focusSessions: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      const missions: any = {
        findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        create: jest.fn().mockResolvedValue(createdMission),
      };
      const decisions: any = {
        getLatest: jest.fn().mockResolvedValue(decisionDoc),
        generate: jest.fn(),
      };

      const planningService = new PlanningService(missions, {} as any, {} as any, decisions);
      const mission = await planningService.generateDailyMission(userId, new Date('2026-01-05T12:00:00Z'));

      expect(mission).toBe(createdMission);
      expect(missions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          objective: 'Important Task',
          supportingTaskIds: [topTaskId],
        }),
      );
      expect(createdMission.focusSessions).toEqual([
        expect.objectContaining({
          objective: 'Important Task',
          durationMinutes: 25,
          recommendedBreakMinutes: 5,
        }),
      ]);
    });
  });
});
