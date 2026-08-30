import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventModule } from '../event/event.module';
import { OrchestrationController } from './orchestration.controller';
import { OrchestrationProcessor } from './orchestration.processor';
import { OrchestrationService } from './orchestration.service';

@Module({
  imports: [EventModule, BullModule.registerQueue({ name: 'event-bus' }, { name: 'knowledge-evaluation' }, { name: 'decision-recompute' }, { name: 'reflection-processing' }, { name: 'decay-tick' }, { name: 'notification-evaluation' })],
  controllers: [OrchestrationController],
  providers: [OrchestrationService, OrchestrationProcessor],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
