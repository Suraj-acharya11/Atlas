import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { DecisionContext } from './decision.types';
import { DecisionService, RejectionReason } from './decision.service';

@Controller('api/v1/decisions')
export class DecisionController {
  constructor(private readonly decisions: DecisionService) {}
  @Get('latest') getLatest(@Req() request: Request) { return this.decisions.getLatest(actingUserId(request)); }
  @Post('recompute') recompute(@Req() request: Request, @Body() context: DecisionContext) { return this.decisions.generate(actingUserId(request), context); }
  @Get(':id') get(@Req() request: Request, @Param('id') id: string) { return this.decisions.findById(id, actingUserId(request)); }
  @Post(':id/rejection') reject(@Req() request: Request, @Param('id') id: string, @Body('reason') reason: RejectionReason) { return this.decisions.recordRejection(id, reason, actingUserId(request)); }
}
