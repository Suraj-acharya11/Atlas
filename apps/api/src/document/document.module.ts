import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { DocumentController } from './document.controller';
import { DocumentExtractionService } from './document-extraction.service';
import { DocumentLifecycleProcessor } from './document.lifecycle.processor';
import { DocumentService } from './document.service';
import { DocumentRecord, DocumentRecordSchema } from './schemas/document.schema';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: DocumentRecord.name, schema: DocumentRecordSchema }]), BullModule.registerQueue({ name: 'document-lifecycle' }), AiModule, RetrievalModule],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentExtractionService, DocumentLifecycleProcessor],
  exports: [DocumentService],
})
export class DocumentModule {}
