import { BadRequestException, Injectable } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TaskService } from '../task/task.service';
import { GoalService } from '../goal/goal.service';
import { PlanningService } from '../planning/planning.service';
import { AiActionResultData } from './ai.types';
import { CreateGoalActionDto, CreateTaskActionDto, ExecuteAiActionDto, RequestReplanActionDto } from './dto/ai-action.dto';

@Injectable()
export class AiActionDispatcher {
  constructor(
    private readonly taskService: TaskService,
    private readonly goalService: GoalService,
    private readonly planningService: PlanningService,
  ) {}

  async execute(userId: string, input: ExecuteAiActionDto): Promise<AiActionResultData> {
    switch (input.actionType) {
      case 'CREATE_TASK': {
        const dto = plainToInstance(CreateTaskActionDto, input.parameters);
        const errors = await validate(dto);
        if (errors.length > 0) {
          throw new BadRequestException(`Invalid parameters for CREATE_TASK: ${errors.map((e) => Object.values(e.constraints ?? {})).flat().join(', ')}`);
        }
        const created = await this.taskService.create(userId, {
          title: dto.title,
          deadline: dto.deadline ?? undefined,
          priority: dto.priority ?? 'medium',
          estimatedDurationMinutes: dto.estimatedDurationMinutes ?? undefined,
          projectId: dto.projectId ?? undefined,
        });
        return {
          actionType: 'CREATE_TASK',
          status: 'executed',
          text: `Task "${created.title}" was created successfully.`,
          entityId: created._id?.toString() ?? created.id,
        };
      }

      case 'CREATE_GOAL': {
        const dto = plainToInstance(CreateGoalActionDto, input.parameters);
        const errors = await validate(dto);
        if (errors.length > 0) {
          throw new BadRequestException(`Invalid parameters for CREATE_GOAL: ${errors.map((e) => Object.values(e.constraints ?? {})).flat().join(', ')}`);
        }
        const created = await this.goalService.create(userId, {
          title: dto.title,
          description: dto.description,
        });
        return {
          actionType: 'CREATE_GOAL',
          status: 'executed',
          text: `Goal "${created.title}" was created successfully.`,
          entityId: created._id?.toString() ?? created.id,
        };
      }

      case 'REQUEST_REPLAN': {
        const dto = plainToInstance(RequestReplanActionDto, input.parameters);
        const errors = await validate(dto);
        if (errors.length > 0) {
          throw new BadRequestException(`Invalid parameters for REQUEST_REPLAN: ${errors.map((e) => Object.values(e.constraints ?? {})).flat().join(', ')}`);
        }
        // First retrieve or generate today's mission
        const currentMission = await this.planningService.generateDailyMission(userId);
        // Then invoke replanMission using the active mission's ID and triggering event
        const replanned = await this.planningService.replanMission(userId, currentMission._id.toString(), {
          type: 'USER_UNAVAILABLE', // triggers shouldRegenerate() -> true
          payload: { reason: dto.reason || 'User requested replanning' },
        });
        return {
          actionType: 'REQUEST_REPLAN',
          status: 'executed',
          text: 'Today’s timetable was successfully recomputed by the Planning Engine.',
          entityId: replanned?._id?.toString() ?? (replanned as any)?.id ?? currentMission._id.toString(),
          timetable: replanned,
        };
      }

      default:
        throw new BadRequestException(`Unsupported action type: ${(input as any).actionType}`);
    }
  }
}
