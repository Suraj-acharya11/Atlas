import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { ExpoPushClient } from './expo-push.client';
import { DeviceToken, DeviceTokenDocument } from './schemas/device-token.schema';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { DigestItem, PendingDigest, PendingDigestDocument } from './schemas/pending-digest.schema';
import { MATERIAL_CHANGE_TYPES, MaterialChangeDetected, NotificationContent, NotificationPriority } from './notification.types';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(DeviceToken.name) private readonly deviceTokens: Model<DeviceTokenDocument>,
    @InjectModel(Notification.name) private readonly notifications: Model<NotificationDocument>,
    @InjectModel(PendingDigest.name) private readonly digests: Model<PendingDigestDocument>,
    @InjectQueue('notification-digest') private readonly digestQueue: Queue,
    private readonly push: ExpoPushClient,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.digestQueue.add('flush-low-priority-digests', {}, { repeat: { every: 4 * 60 * 60 * 1000 }, jobId: 'notification-digest-every-four-hours' });
  }

  async registerDeviceToken(userId: string, expoPushToken: string): Promise<DeviceTokenDocument> {
    if (!Types.ObjectId.isValid(userId) || !expoPushToken?.trim()) throw new BadRequestException('A valid Expo push token is required');
    return this.deviceTokens.findOneAndUpdate(
      { expoPushToken: expoPushToken.trim() },
      { $set: { userId: new Types.ObjectId(userId), expoPushToken: expoPushToken.trim() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, runValidators: true },
    ).exec() as Promise<DeviceTokenDocument>;
  }

  async handleMaterialChange(signal: MaterialChangeDetected): Promise<NotificationDocument | null> {
    if (!signal || signal.type === MATERIAL_CHANGE_TYPES.knowledgeOnly) return null;
    if (!Types.ObjectId.isValid(signal.userId)) throw new BadRequestException('A valid userId is required');
    const priority = this.priorityFor(signal.type);
    const content = this.contentFor(signal);
    if (priority === 'LOW') {
      await this.digests.findOneAndUpdate(
        { userId: new Types.ObjectId(signal.userId) },
        { $push: { items: content }, $set: { updatedAt: new Date() }, $setOnInsert: { userId: new Types.ObjectId(signal.userId) } },
        { upsert: true, new: true, runValidators: true },
      ).exec();
      return null;
    }

    const notification = await this.notifications.create({ userId: new Types.ObjectId(signal.userId), priority, ...content, status: 'pending', deliveredAt: null, createdAt: new Date() });
    if (priority === 'CRITICAL' || priority === 'HIGH') await this.deliver(notification, content);
    return notification;
  }

  async flushLowPriorityDigests(): Promise<number> {
    const cursor = this.digests.find().cursor();
    let flushed = 0;
    for await (const digest of cursor) {
      const content = this.digestContent(digest.items);
      if (!content) { await this.digests.deleteOne({ _id: digest._id }).exec(); continue; }
      const notification = await this.notifications.create({ userId: digest.userId, priority: 'LOW', ...content, status: 'pending', deliveredAt: null, createdAt: new Date() });
      await this.deliver(notification, content);
      await this.digests.deleteOne({ _id: digest._id }).exec();
      flushed += 1;
    }
    return flushed;
  }

  private async deliver(notification: NotificationDocument, content: NotificationContent): Promise<void> {
    const tokens = await this.deviceTokens.find({ userId: notification.userId }).lean().exec();
    if (!tokens.length) { notification.status = 'stored'; await notification.save(); return; }
    await Promise.all(tokens.map((token) => this.push.send(token.expoPushToken, content)));
    notification.status = 'delivered';
    notification.deliveredAt = new Date();
    await notification.save();
  }

  private priorityFor(type: MaterialChangeDetected['type']): NotificationPriority {
    if (type === MATERIAL_CHANGE_TYPES.taskOverdue || type === MATERIAL_CHANGE_TYPES.planImpossible) return 'CRITICAL';
    if (type === MATERIAL_CHANGE_TYPES.nextBestActionChanged || type === MATERIAL_CHANGE_TYPES.deadlineMovedCloser) return 'HIGH';
    if (type === MATERIAL_CHANGE_TYPES.replanningChangedSchedule) return 'NORMAL';
    if (type === MATERIAL_CHANGE_TYPES.minorUpdate) return 'LOW';
    throw new BadRequestException(`Unsupported material change type: ${type}`);
  }

  private contentFor(signal: MaterialChangeDetected): NotificationContent {
    const label = signal.lastValidOutputPreserved ? 'Last valid Decision/Plan preserved. ' : '';
    return { whatChanged: signal.whatChanged, recommendation: signal.recommendation, reason: `${label}${signal.reason}` };
  }

  private digestContent(items: DigestItem[]): NotificationContent | null {
    if (!items.length) return null;
    return {
      whatChanged: items.map((item) => item.whatChanged).join('; '),
      recommendation: items.map((item) => item.recommendation).join('; '),
      reason: items.map((item) => item.reason).join('; '),
    };
  }
}
