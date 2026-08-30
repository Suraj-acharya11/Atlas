import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MlService } from './ml.service';
import { MlController } from './ml.controller';
import { MlReflectionSignalProcessor } from './reflection-signal.processor';
@Module({ imports: [BullModule.registerQueue({ name: 'reflection-signal-ml' })], controllers: [MlController], providers: [MlService, MlReflectionSignalProcessor], exports: [MlService] })
export class MlModule {}
