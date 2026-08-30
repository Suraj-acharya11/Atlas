import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ExpoPushClient } from './expo-push.client';
import { NotificationController } from './notification.controller';
import { NotificationDigestProcessor, NotificationEvaluationProcessor } from './notification.processor';
import { NotificationService } from './notification.service';
import { DeviceToken, DeviceTokenSchema } from './schemas/device-token.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { PendingDigest, PendingDigestSchema } from './schemas/pending-digest.schema';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: DeviceToken.name, schema: DeviceTokenSchema }, { name: Notification.name, schema: NotificationSchema }, { name: PendingDigest.name, schema: PendingDigestSchema }]), BullModule.registerQueue({ name: 'notification-evaluation' }, { name: 'notification-digest' })],
  controllers: [NotificationController],
  providers: [NotificationService, ExpoPushClient, NotificationEvaluationProcessor, NotificationDigestProcessor],
  exports: [NotificationService],
})
export class NotificationModule {}
