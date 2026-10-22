import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PrivacyService } from '../src/user/privacy.service';
import { ImportUserDataDto } from '../src/user/dto/import-user-data.dto';

describe('PrivacyService - Data Import & Export', () => {
  let service: PrivacyService;
  let connection: any;
  let collections: Record<string, any>;

  const userId = new Types.ObjectId().toHexString();
  const foreignUserId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    collections = {
      goals: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockImplementation(async (doc) => ({ insertedId: doc._id })),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      projects: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockImplementation(async (doc) => ({ insertedId: doc._id })),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      tasks: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockImplementation(async (doc) => ({ insertedId: doc._id })),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      knowledge_relationships: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockImplementation(async (doc) => ({ insertedId: doc._id })),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      events: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn(),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      missions: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn(),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      weekly_plans: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn(),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
      users: {
        findOne: jest.fn().mockResolvedValue({ timezone: 'UTC', displayName: 'Test User', bio: 'Test Bio', preferences: {} }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      },
      habits: {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockImplementation(async (doc) => ({ insertedId: doc._id })),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      },
    };

    connection = {
      collection: jest.fn((name: string) => collections[name]),
    };

    service = new PrivacyService(connection);
  });

  describe('exportUserData', () => {
    it('exports user data with schemaVersion 1 and scopes to authenticated user', async () => {
      const exported = await service.exportUserData(userId);

      expect(exported.schemaVersion).toBe(1);
      expect(exported.exportedAt).toBeDefined();
      expect(exported).toHaveProperty('goals');
      expect(exported).toHaveProperty('projects');
      expect(exported).toHaveProperty('tasks');
      expect(exported).toHaveProperty('knowledge');
      expect(exported).toHaveProperty('events');
      expect(exported).toHaveProperty('plans');
    });
  });

  describe('importUserData', () => {
    it('imports goals, projects, tasks, and knowledge while binding to authenticated user', async () => {
      const oldGoalId = new Types.ObjectId().toHexString();
      const oldProjectId = new Types.ObjectId().toHexString();

      const input: ImportUserDataDto = {
        schemaVersion: 1,
        goals: [
          {
            _id: oldGoalId,
            title: 'Master TypeScript',
            description: 'Learn advanced types',
            status: 'active',
          },
        ],
        projects: [
          {
            _id: oldProjectId,
            title: 'ATLAS V1 Architecture',
            goalIds: [oldGoalId],
            status: 'active',
          },
        ],
        tasks: [
          {
            title: 'Implement Data Import',
            status: 'todo',
            deadline: '2026-09-30T18:00:00.000Z',
            projectId: oldProjectId,
          },
        ],
        knowledge: [
          {
            subject: 'User',
            predicate: 'prefers',
            object: 'deep focus morning blocks',
            category: 'preference',
            confidence: 90,
            status: 'active',
          },
        ],
      };

      const result = await service.importUserData(userId, input);

      expect(result.imported).toEqual({
        goals: 1,
        projects: 1,
        tasks: 1,
        knowledge: 1,
      });
      expect(result.skippedDuplicates).toEqual({
        goals: 0,
        projects: 0,
        tasks: 0,
        knowledge: 0,
      });

      // Verify authenticated user ownership on all inserts
      const userObjId = new Types.ObjectId(userId);

      const insertedGoal = collections.goals.insertOne.mock.calls[0][0];
      expect(insertedGoal.userId.equals(userObjId)).toBe(true);
      expect(insertedGoal.title).toBe('Master TypeScript');
      expect(insertedGoal._id.toHexString()).not.toBe(oldGoalId); // New ID generated

      const newGoalId = insertedGoal._id;

      const insertedProject = collections.projects.insertOne.mock.calls[0][0];
      expect(insertedProject.userId.equals(userObjId)).toBe(true);
      expect(insertedProject.title).toBe('ATLAS V1 Architecture');
      expect(insertedProject._id.toHexString()).not.toBe(oldProjectId); // New ID generated
      // Check remapped goalId
      expect(insertedProject.goalIds).toEqual([newGoalId]);

      const newProjectId = insertedProject._id;

      const insertedTask = collections.tasks.insertOne.mock.calls[0][0];
      expect(insertedTask.userId.equals(userObjId)).toBe(true);
      expect(insertedTask.title).toBe('Implement Data Import');
      // Check remapped projectId
      expect(insertedTask.projectId.equals(newProjectId)).toBe(true);

      const insertedKnowledge = collections.knowledge_relationships.insertOne.mock.calls[0][0];
      expect(insertedKnowledge.userId.equals(userObjId)).toBe(true);
      expect(insertedKnowledge.subject).toBe('User');
      expect(insertedKnowledge.predicate).toBe('prefers');
      expect(insertedKnowledge.object).toBe('deep focus morning blocks');
      expect(insertedKnowledge.category).toBe('preference');
    });

    it('ignores foreign userId embedded in the imported JSON and forces authenticated user', async () => {
      const input = {
        goals: [
          {
            title: 'Hacked Goal',
            userId: foreignUserId, // Attempt to inject foreign ownership
          } as any,
        ],
      };

      await service.importUserData(userId, input);

      const insertedGoal = collections.goals.insertOne.mock.calls[0][0];
      expect(insertedGoal.userId.equals(new Types.ObjectId(userId))).toBe(true);
      expect(insertedGoal.userId.equals(new Types.ObjectId(foreignUserId))).toBe(false);
    });

    it('detects and skips duplicate goals, projects, tasks, and knowledge', async () => {
      const existingGoalId = new Types.ObjectId();
      const existingProjectId = new Types.ObjectId();

      collections.goals.findOne.mockResolvedValueOnce({ _id: existingGoalId, title: 'Existing Goal' });
      collections.projects.findOne.mockResolvedValueOnce({ _id: existingProjectId, title: 'Existing Project' });
      collections.tasks.findOne.mockResolvedValueOnce({ _id: new Types.ObjectId(), title: 'Existing Task' });
      collections.knowledge_relationships.findOne.mockResolvedValueOnce({ _id: new Types.ObjectId() });

      const input: ImportUserDataDto = {
        goals: [{ title: 'Existing Goal' }],
        projects: [{ title: 'Existing Project' }],
        tasks: [{ title: 'Existing Task' }],
        knowledge: [{ subject: 'A', predicate: 'B', object: 'C', category: 'context' }],
      };

      const result = await service.importUserData(userId, input);

      expect(result.imported).toEqual({ goals: 0, projects: 0, tasks: 0, knowledge: 0 });
      expect(result.skippedDuplicates).toEqual({ goals: 1, projects: 1, tasks: 1, knowledge: 1 });
      expect(collections.goals.insertOne).not.toHaveBeenCalled();
      expect(collections.projects.insertOne).not.toHaveBeenCalled();
      expect(collections.tasks.insertOne).not.toHaveBeenCalled();
      expect(collections.knowledge_relationships.insertOne).not.toHaveBeenCalled();
    });

    it('never inserts events or mission plans from imported JSON', async () => {
      const input = {
        events: [{ type: 'TASK_CREATED', payload: { fake: true } }],
        plans: {
          missions: [{ date: '2026-09-13', objective: 'Fake Mission' }],
          weeklyPlans: [{ weekStartDate: '2026-09-08' }],
        },
      } as any;

      await service.importUserData(userId, input);

      expect(collections.events.insertOne).not.toHaveBeenCalled();
      expect(collections.missions.insertOne).not.toHaveBeenCalled();
      expect(collections.weekly_plans.insertOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for invalid userId format', async () => {
      await expect(service.importUserData('invalid-user-id', {})).rejects.toThrow(BadRequestException);
    });

    it('updates user profile with displayName, bio, timezone, and preferences', async () => {
      const input: ImportUserDataDto = {
        profile: {
          timezone: 'America/New_York',
          displayName: 'Atlas Pilot',
          bio: 'Reliability Engineer',
          preferences: { dailyReminders: true, deepWorkStrict: true },
        },
      };

      await service.importUserData(userId, input);

      expect(collections.users.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            timezone: 'America/New_York',
            displayName: 'Atlas Pilot',
            bio: 'Reliability Engineer',
            preferences: { dailyReminders: true, deepWorkStrict: true },
          },
        },
      );
    });

    it('successfully validates and imports the realistic import-test-dataset.json', async () => {
      const fs = require('fs');
      const path = require('path');
      const { plainToInstance } = require('class-transformer');
      const { validate } = require('class-validator');

      const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/user/import-test-dataset.json'), 'utf-8'));
      const dto = plainToInstance(ImportUserDataDto, raw);
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors).toEqual([]);

      const result = await service.importUserData(userId, dto);
      expect(result.imported.goals).toBe(9);
      expect(result.imported.projects).toBe(2);
      expect(result.imported.tasks).toBe(12);
      expect(result.imported.knowledge).toBe(6);
      expect(result.imported.habits).toBe(3);
    });
  });
});
