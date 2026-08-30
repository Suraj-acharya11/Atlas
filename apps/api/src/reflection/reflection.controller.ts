import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { ReflectionService } from './reflection.service';

@Controller('api/v1/reflection')
export class ReflectionController {
  constructor(private readonly reflection: ReflectionService) {}
  @Get('signals') signals(@Req() request: Request) { return this.reflection.findForUser(actingUserId(request)); }
}
