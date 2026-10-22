import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { EmbeddingService } from './embedding.service';
import { AI_CACHE, AI_PROVIDER, EMBEDDING_PROVIDER } from './ai.tokens';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { AiProvider, EmbeddingProvider } from './ai.types';

import { TaskModule } from '../task/task.module';
import { GoalModule } from '../goal/goal.module';
import { ProjectModule } from '../project/project.module';
import { PlanningModule } from '../planning/planning.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { DecisionModule } from '../decision/decision.module';
import { AiActionDispatcher } from './ai-action.dispatcher';

export function createAiProvider(config: ConfigService): AiProvider { return config.get('AI_PROVIDER') === 'gemini' ? new GeminiProvider(config) : new GroqProvider(config); }
export function createEmbeddingProvider(config: ConfigService): EmbeddingProvider { return new GeminiProvider(config); }

@Module({
  imports: [ConfigModule, TaskModule, GoalModule, ProjectModule, PlanningModule, KnowledgeModule, DecisionModule],
  controllers: [AiController],
  providers: [
    AiService,
    EmbeddingService,
    AiActionDispatcher,
    { provide: AI_PROVIDER, inject: [ConfigService], useFactory: createAiProvider },
    { provide: EMBEDDING_PROVIDER, inject: [ConfigService], useFactory: createEmbeddingProvider },
    { provide: AI_CACHE, inject: [ConfigService], useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')) },
  ],
  exports: [AiService, EmbeddingService, AiActionDispatcher],
})
export class AiModule {}
