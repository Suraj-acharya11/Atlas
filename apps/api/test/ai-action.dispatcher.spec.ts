import { BadRequestException } from '@nestjs/common';
import { AiActionDispatcher } from '../src/ai/ai-action.dispatcher';
import { TaskService } from '../src/task/task.service';
import { GoalService } from '../src/goal/goal.service';
import { PlanningService } from '../src/planning/planning.service';

describe('AiActionDispatcher', () => {
  let dispatcher: AiActionDispatcher;
  let taskService: Partial<TaskService>;
  let goalService: Partial<GoalService>;
  let planningService: Partial<PlanningService>;

  const userId = 'user-123';

  beforeEach(() => {
    taskService = {
      create: jest.fn().mockResolvedValue({
        _id: 'task-abc',
        title: 'Complete project proposal',
        deadline: new Date('2026-09-18T10:00:00.000Z'),
        status: 'pending',
      } as any),
    };

    goalService = {
      create: jest.fn().mockResolvedValue({
        _id: 'goal-xyz',
        title: 'Master TypeScript',
        description: 'Read docs and build apps',
        status: 'active',
      } as any),
    };

    planningService = {
      generateDailyMission: jest.fn().mockResolvedValue({
        _id: 'mission-today-123',
        date: '2026-09-13',
        status: 'active',
        blocks: [],
      } as any),
      replanMission: jest.fn().mockResolvedValue({
        _id: 'mission-replanned-456',
        date: '2026-09-13',
        status: 'active',
        blocks: [{ blockId: 'b1', title: 'Work session' }],
      } as any),
    };

    dispatcher = new AiActionDispatcher(
      taskService as TaskService,
      goalService as GoalService,
      planningService as PlanningService,
    );
  });

  describe('CREATE_TASK', () => {
    it('validates parameters and calls TaskService.create', async () => {
      const result = await dispatcher.execute(userId, {
        actionType: 'CREATE_TASK',
        parameters: {
          title: 'Complete project proposal',
          deadline: '2026-09-18T10:00:00.000Z',
        },
      });

      expect(taskService.create).toHaveBeenCalledWith(userId, expect.objectContaining({
        title: 'Complete project proposal',
        deadline: '2026-09-18T10:00:00.000Z',
      }));
      expect(result.status).toBe('executed');
      expect(result.actionType).toBe('CREATE_TASK');
      expect(result.text).toContain('Complete project proposal');
    });

    it('rejects CREATE_TASK without title', async () => {
      await expect(
        dispatcher.execute(userId, {
          actionType: 'CREATE_TASK',
          parameters: {} as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CREATE_GOAL', () => {
    it('validates parameters and calls GoalService.create', async () => {
      const result = await dispatcher.execute(userId, {
        actionType: 'CREATE_GOAL',
        parameters: {
          title: 'Master TypeScript',
          description: 'Read docs and build apps',
        },
      });

      expect(goalService.create).toHaveBeenCalledWith(userId, {
        title: 'Master TypeScript',
        description: 'Read docs and build apps',
      });
      expect(result.status).toBe('executed');
      expect(result.actionType).toBe('CREATE_GOAL');
      expect(result.text).toContain('Master TypeScript');
    });

    it('rejects CREATE_GOAL with empty title', async () => {
      await expect(
        dispatcher.execute(userId, {
          actionType: 'CREATE_GOAL',
          parameters: { title: '' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('REQUEST_REPLAN', () => {
    it('finds active today mission and invokes replanMission with trigger event', async () => {
      const result = await dispatcher.execute(userId, {
        actionType: 'REQUEST_REPLAN',
        parameters: {
          reason: 'Emergency meeting came up',
        },
      });

      expect(planningService.generateDailyMission).toHaveBeenCalledWith(userId);
      expect(planningService.replanMission).toHaveBeenCalledWith(
        userId,
        'mission-today-123',
        expect.objectContaining({
          type: 'USER_UNAVAILABLE',
          payload: { reason: 'Emergency meeting came up' },
        }),
      );
      expect(result.status).toBe('executed');
      expect(result.actionType).toBe('REQUEST_REPLAN');
      expect(result.entityId).toBe('mission-replanned-456');
      expect(result.timetable).toBeDefined();
    });
  });

  describe('Unknown / Invalid actions', () => {
    it('throws BadRequestException for unsupported action type', async () => {
      await expect(
        dispatcher.execute(userId, {
          actionType: 'UPDATE_TASK' as any,
          parameters: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
