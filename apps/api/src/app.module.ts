import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { GoalModule } from './goal/goal.module';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
import { EventModule } from './event/event.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { DecisionModule } from './decision/decision.module';
import { PlanningModule } from './planning/planning.module';
import { ExecutionModule } from './execution/execution.module';
import { ReflectionModule } from './reflection/reflection.module';
import { AiModule } from './ai/ai.module';
import { NotificationModule } from './notification/notification.module';
import { DocumentModule } from './document/document.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { MlModule } from './ml/ml.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import * as path from 'node:path';

@Module({imports:[ConfigModule.forRoot({isGlobal:true,envFilePath:[path.resolve(__dirname,'../../../../.env'),path.resolve(__dirname,'../../../.env'),path.resolve(process.cwd(),'../../.env'),path.resolve(process.cwd(),'.env')]}),BullModule.forRootAsync({inject:[ConfigService],useFactory:(c:ConfigService)=>({connection:{url:c.getOrThrow('REDIS_URL')}})}),MongooseModule.forRootAsync({inject:[ConfigService],useFactory:(c:ConfigService)=>({uri:c.getOrThrow('MONGO_URI')})}),HealthModule,AuthModule,UserModule,GoalModule,ProjectModule,TaskModule,EventModule,KnowledgeModule,DecisionModule,PlanningModule,ExecutionModule,ReflectionModule,AiModule,NotificationModule,DocumentModule,RetrievalModule,MlModule,OrchestrationModule]})
export class AppModule {}
