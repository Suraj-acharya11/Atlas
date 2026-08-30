import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { NotificationService } from './notification.service';

@Controller('api/v1/users/me/device-tokens')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}
  @Post()
  register(@Req() request: Request, @Body('expoPushToken') expoPushToken: string) { return this.notifications.registerDeviceToken(actingUserId(request), expoPushToken); }
}
