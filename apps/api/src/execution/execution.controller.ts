import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { ExecutionStartInput, ExecutionTransitionInput } from './execution.types';
import { ExecutionService } from './execution.service';

@Controller('api/v1/execution')
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}
  @Post() start(@Req() request: Request, @Body() input: ExecutionStartInput) { return this.execution.start(actingUserId(request), input); }
  @Get(':id') get(@Req() request: Request, @Param('id') id: string) { return this.execution.findById(actingUserId(request), id); }
  @Post(':id/transition') transition(@Req() request: Request, @Param('id') id: string, @Body() input: ExecutionTransitionInput) { return this.execution.transition(actingUserId(request), id, input); }
}
