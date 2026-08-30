import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { EventModule } from '../event/event.module';
import { GoalModule } from '../goal/goal.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MlModule } from '../ml/ml.module';
import { ProjectModule } from '../project/project.module';
import { TaskModule } from '../task/task.module';
import { DecisionController } from './decision.controller';
import { DecisionService } from './decision.service';
import { DecisionRecomputeProcessor } from './decision.processor';
import { DECISION_FACTORS } from './decision.tokens';
import { DeadlineUrgencyFactor } from './factors/deadline-urgency.factor';
import { DifficultyPenaltyFactor } from './factors/difficulty-penalty.factor';
import { EnergyFitFactor } from './factors/energy-fit.factor';
import { ContextFitFactor } from './factors/context-fit.factor';
import { GoalImportanceFactor } from './factors/goal-importance.factor';
import { KnowledgeSupportFactor } from './factors/knowledge-support.factor';
import { Decision, DecisionSchema } from './schemas/decision.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Decision.name, schema: DecisionSchema }]), BullModule.registerQueue({ name: 'decision-recompute' }), EventModule, GoalModule, ProjectModule, TaskModule, KnowledgeModule, MlModule],
  controllers: [DecisionController],
  providers: [DecisionService, DecisionRecomputeProcessor, { provide: DECISION_FACTORS, useValue: [new GoalImportanceFactor(), new DeadlineUrgencyFactor(), new ContextFitFactor(), new EnergyFitFactor(), new KnowledgeSupportFactor(), new DifficultyPenaltyFactor()] }],
  exports: [DecisionService],
})
export class DecisionModule {}
