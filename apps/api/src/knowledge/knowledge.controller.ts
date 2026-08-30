import { Controller, Delete, Get, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { KnowledgeService } from './knowledge.service';

@Controller('api/v1/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}
  @Get()
  query(@Req() request: Request, @Query() filters: { subject?: string; predicate?: string; category?: string; status?: 'pending' | 'active' }) {
    return this.knowledge.query(actingUserId(request), filters);
  }
  @Delete(':id') delete(@Req() request: Request, @Param('id') id: string) { return this.knowledge.delete(actingUserId(request), id); }
}
