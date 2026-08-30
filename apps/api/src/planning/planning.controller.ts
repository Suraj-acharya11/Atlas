import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { PlanningInput, ReplanRequest } from './planning.types';
import { PlanningService } from './planning.service';

@Controller('api/v1/planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}
  @Post('missions/today') generate(@Req() request: Request, @Body() input: PlanningInput) { return this.planning.generateDailyMission(actingUserId(request), new Date(), input); }
  @Post('schedule') schedule(@Req() request: Request, @Body('timezone') timezone: string) { return this.planning.registerDailyMissionSchedule(actingUserId(request), timezone); }
  @Get('missions/:id') get(@Req() request: Request, @Param('id') id: string) { return this.planning.getMission(actingUserId(request), id); }
  @Post('missions/:id/replan') replan(@Req() request: Request, @Param('id') id: string, @Body() body: ReplanRequest) { return this.planning.replanMission(actingUserId(request), id, body.triggerEvent, body.input); }
  @Post('weekly') weekly(@Req() request: Request, @Body() body: { weekStartDate: string; emphasizedGoalIds: string[]; notes?: string }) { return this.planning.saveWeeklyPlan(actingUserId(request), body.weekStartDate, body.emphasizedGoalIds, body.notes); }
  @Get('weekly/:weekStartDate') getWeekly(@Req() request: Request, @Param('weekStartDate') weekStartDate: string) { return this.planning.getWeeklyPlan(actingUserId(request), weekStartDate); }
}
