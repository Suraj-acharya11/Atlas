export type NotificationModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean; status: string }>;
  getExpoPushTokenAsync: (options: { projectId: string }) => Promise<{ data: string }>;
};

export type NotificationErrorCode = 'missing-project-id' | 'permission-denied' | 'missing-token' | 'fcm-unconfigured';

export class NotificationSetupError extends Error {
  constructor(public readonly code: NotificationErrorCode, message?: string) {
    super(
      message ??
        (code === 'missing-project-id'
          ? 'Expo project ID is not configured.'
          : code === 'permission-denied'
          ? 'Notification permission was not granted.'
          : code === 'fcm-unconfigured'
          ? 'Firebase Cloud Messaging (FCM) credentials are not configured in this build.'
          : 'Expo did not return a push token.')
    );
  }
}

export async function registerForPushNotifications(
  notifications: NotificationModule,
  projectId: string | undefined,
  registerToken: (expoPushToken: string) => Promise<unknown>,
) {
  if (!projectId) throw new NotificationSetupError('missing-project-id');
  const permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) throw new NotificationSetupError('permission-denied');

  let response: { data: string };
  try {
    response = await notifications.getExpoPushTokenAsync({ projectId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.toLowerCase().includes('firebase') ||
      message.toLowerCase().includes('fcm') ||
      message.toLowerCase().includes('google-services') ||
      message.toLowerCase().includes('play services') ||
      message.toLowerCase().includes('credentials')
    ) {
      throw new NotificationSetupError('fcm-unconfigured', `Firebase Cloud Messaging (FCM) credentials are not configured: ${message}`);
    }
    throw err;
  }

  if (!response?.data) throw new NotificationSetupError('missing-token');
  await registerToken(response.data);
  return response.data;
}

export function createNotificationRegistrationGuard() {
  let busy = false;
  return {
    run: async <T>(operation: () => Promise<T>) => {
      if (busy) return undefined;
      busy = true;
      try {
        return await operation();
      } finally {
        busy = false;
      }
    },
  };
}
