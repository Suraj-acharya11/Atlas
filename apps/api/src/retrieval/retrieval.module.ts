import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RetrievalController } from './retrieval.controller';
import { QdrantClient } from './qdrant.client';
import { QDRANT_CLIENT, RetrievalService } from './retrieval.service';

@Module({
  imports: [ConfigModule, MongooseModule, AiModule, KnowledgeModule],
  controllers: [RetrievalController],
  providers: [
    RetrievalService,
    { provide: QDRANT_CLIENT, inject: [ConfigService], useFactory: (config: ConfigService) => new QdrantClient(config.getOrThrow<string>('QDRANT_URL')) },
  ],
  exports: [RetrievalService],
})
export class RetrievalModule {}
