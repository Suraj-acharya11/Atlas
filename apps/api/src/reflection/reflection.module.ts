import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ExecutionModule } from '../execution/execution.module';
import { PlanningModule } from '../planning/planning.module';
import { ReflectionService } from './reflection.service';
import { ReflectionController } from './reflection.controller';
import { ReflectionProcessingProcessor } from './reflection.processor';
import { LearningSignal, LearningSignalSchema } from './schemas/learning-signal.schema';

@Module({ imports: [MongooseModule.forFeature([{ name: LearningSignal.name, schema: LearningSignalSchema }]), BullModule.registerQueue({ name: 'reflection-processing' }, { name: 'reflection-signal-knowledge' }, { name: 'reflection-signal-ml' }), ExecutionModule, PlanningModule], controllers: [ReflectionController], providers: [ReflectionService, ReflectionProcessingProcessor], exports: [ReflectionService] })
export class ReflectionModule {}
