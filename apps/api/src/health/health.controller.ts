import { Controller, Get } from '@nestjs/common'; import { HealthCheck } from '@nestjs/terminus'; import { Public } from '../auth/public.decorator'; import { HealthService } from './health.service';
@Controller('health') export class HealthController { constructor(private readonly service:HealthService){} @Public() @Get() @HealthCheck() check(){return this.service.check();} }
