import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { AiService } from './ai.service';
import { AiActionDispatcher } from './ai-action.dispatcher';
import { ExecuteAiActionDto } from './dto/ai-action.dto';

@Controller('api/v1/ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly dispatcher: AiActionDispatcher,
  ) {}
  @Post('work-analysis') workAnalysis(@Body() body: { requestId: string; subject: string; context?: Record<string, unknown> }) { return this.ai.analyzeWork(body.requestId, body.subject, body.context); }
  @Post('user-update') userUpdate(@Body() body: { message: string; context?: Record<string, unknown> }) { return this.ai.interpretUserUpdate(body.message, body.context); }
  @Post('chat') chat(@Req() req: Request, @Body() body: { message: string; context?: Record<string, unknown> }) {
    const userId = (req as any).user?.userId;
    return this.ai.generate(body.message, body.context, userId);
  }
  @Post('action/execute') executeAction(@Req() req: Request, @Body() body: ExecuteAiActionDto) { return this.dispatcher.execute(actingUserId(req), body); }
}
