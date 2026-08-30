import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationContent } from './notification.types';

@Injectable()
export class ExpoPushClient {
  private readonly endpoint: string;

  constructor(config: ConfigService) { this.endpoint = config.get('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send'); }

  async send(expoPushToken: string, content: NotificationContent): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: expoPushToken, data: content }),
    });
    if (!response.ok) throw new Error(`Expo push failed (${response.status})`);
  }
}
