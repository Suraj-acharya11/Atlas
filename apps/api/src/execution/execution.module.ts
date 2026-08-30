import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { EventModule } from '../event/event.module';
import { PlanningModule } from '../planning/planning.module';
import { TaskModule } from '../task/task.module';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionRecord, ExecutionSchema } from './schemas/execution.schema';

@Module({ imports: [MongooseModule.forFeature([{ name: ExecutionRecord.name, schema: ExecutionSchema }]), BullModule.registerQueue({ name: 'reflection-processing' }), EventModule, PlanningModule, TaskModule], controllers: [ExecutionController], providers: [ExecutionService], exports: [ExecutionService] })
export class ExecutionModule {}
