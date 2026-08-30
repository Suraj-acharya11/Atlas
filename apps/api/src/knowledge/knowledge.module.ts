import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { EventModule } from '../event/event.module';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeEvaluationProcessor, KnowledgeDecayProcessor } from './knowledge.processor';
import { KnowledgeReflectionSignalProcessor } from './reflection-signal.processor';
import { KnowledgeRelationship, KnowledgeRelationshipSchema } from './schemas/knowledge.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: KnowledgeRelationship.name, schema: KnowledgeRelationshipSchema }]), BullModule.registerQueue({ name: 'knowledge-evaluation' }, { name: 'decay-tick' }, { name: 'reflection-signal-knowledge' }), EventModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeEvaluationProcessor, KnowledgeDecayProcessor, KnowledgeReflectionSignalProcessor],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
