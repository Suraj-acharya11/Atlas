import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { DecisionModule } from '../decision/decision.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { DailyMissionProcessor } from './planning.processor';
import { Mission, MissionSchema } from './schemas/mission.schema';
import { WeeklyPlan, WeeklyPlanSchema } from './schemas/weekly-plan.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Mission.name, schema: MissionSchema }, { name: WeeklyPlan.name, schema: WeeklyPlanSchema }]), BullModule.registerQueue({ name: 'daily-mission' }), DecisionModule],
  controllers: [PlanningController],
  providers: [PlanningService, DailyMissionProcessor],
  exports: [PlanningService],
})
export class PlanningModule {}
