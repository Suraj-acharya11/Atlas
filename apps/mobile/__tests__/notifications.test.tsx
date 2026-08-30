import { createNotificationRegistrationGuard, registerForPushNotifications, NotificationSetupError } from '../lib/notifications';

function nativeNotifications(granted = true) {
  return {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted, status: granted ? 'granted' : 'denied' }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  };
}

describe('notification registration', () => {
  it('rejects denied permission without requesting a token', async () => {
    const notifications = nativeNotifications(false);
    const register = jest.fn();

    await expect(registerForPushNotifications(notifications, 'project-1', register)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('gets the Expo token and registers it with the authenticated API boundary', async () => {
    const notifications = nativeNotifications();
    const register = jest.fn().mockResolvedValue(undefined);

    await expect(registerForPushNotifications(notifications, 'project-1', register)).resolves.toBe('ExponentPushToken[test]');
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(register).toHaveBeenCalledWith('ExponentPushToken[test]');
  });

  it('does not prompt for permission when the project ID is missing', async () => {
    const notifications = nativeNotifications();
    const register = jest.fn();

    await expect(registerForPushNotifications(notifications, undefined, register)).rejects.toEqual(new NotificationSetupError('missing-project-id'));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('propagates backend registration failures', async () => {
    const notifications = nativeNotifications();
    const register = jest.fn().mockRejectedValue(new Error('Registration failed'));

    await expect(registerForPushNotifications(notifications, 'project-1', register)).rejects.toThrow('Registration failed');
  });

  it('prevents duplicate registration operations while the first is pending', async () => {
    const guard = createNotificationRegistrationGuard();
    let resolve: (value: string) => void = () => undefined;
    const first = guard.run(() => new Promise<string>((complete) => { resolve = complete; }));
    const second = await guard.run(async () => 'duplicate');

    expect(second).toBeUndefined();
    resolve('registered');
    await expect(first).resolves.toBe('registered');
  });
});
