import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Post('work-analysis') workAnalysis(@Body() body: { requestId: string; subject: string; context?: Record<string, unknown> }) { return this.ai.analyzeWork(body.requestId, body.subject, body.context); }
  @Post('user-update') userUpdate(@Body() body: { message: string; context?: Record<string, unknown> }) { return this.ai.interpretUserUpdate(body.message, body.context); }
}
