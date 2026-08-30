export type NotificationModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean; status: string }>;
  getExpoPushTokenAsync: (options: { projectId: string }) => Promise<{ data: string }>;
};

export class NotificationSetupError extends Error {
  constructor(public readonly code: 'missing-project-id' | 'permission-denied' | 'missing-token') {
    super(code === 'missing-project-id' ? 'Expo project ID is not configured.' : code === 'permission-denied' ? 'Notification permission was not granted.' : 'Expo did not return a push token.');
  }
}

export async function registerForPushNotifications(notifications: NotificationModule, projectId: string | undefined, registerToken: (expoPushToken: string) => Promise<unknown>) {
  if (!projectId) throw new NotificationSetupError('missing-project-id');
  const permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) throw new NotificationSetupError('permission-denied');
  const response = await notifications.getExpoPushTokenAsync({ projectId });
  if (!response.data) throw new NotificationSetupError('missing-token');
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
