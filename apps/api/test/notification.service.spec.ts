import { NotificationService } from '../src/notification/notification.service';

const userId = '507f1f77bcf86cd799439011';

function service() {
  const deviceTokens = {
    findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([{ expoPushToken: 'ExponentPushToken[test]' }]) }) }),
  };
  const notifications = {
    create: jest.fn().mockImplementation(async (value) => ({ ...value, save: jest.fn().mockResolvedValue(undefined) })),
  };
  const digests = {
    findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    find: jest.fn(),
    deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
  };
  const push = { send: jest.fn().mockResolvedValue(undefined) };
  const instance = new NotificationService(deviceTokens as any, notifications as any, digests as any, {} as any, push as any, { get: jest.fn() } as any);
  return { instance, deviceTokens, notifications, digests, push };
}

describe('Phase 10 notifications', () => {
  it('ignores Knowledge-only signals and creates no notification', async () => {
    const { instance, notifications, digests } = service();
    await expect(instance.handleMaterialChange({ userId, type: 'knowledge_only', whatChanged: 'confidence changed', recommendation: 'none', reason: 'no action' })).resolves.toBeNull();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(digests.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('delivers an overdue task as CRITICAL immediately', async () => {
    const { instance, notifications, push } = service();
    await instance.handleMaterialChange({ userId, type: 'task_overdue', whatChanged: 'Task is overdue', recommendation: 'Start the task now', reason: 'The deadline passed' });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'CRITICAL', whatChanged: 'Task is overdue' }));
    expect(push.send).toHaveBeenCalledWith('ExponentPushToken[test]', { whatChanged: 'Task is overdue', recommendation: 'Start the task now', reason: 'The deadline passed' });
    expect(Object.keys(push.send.mock.calls[0][1]).sort()).toEqual(['reason', 'recommendation', 'whatChanged']);
  });

  it('batches repeated LOW signals into one pending digest', async () => {
    const { instance, digests } = service();
    const signal = { userId, type: 'minor_update' as const, whatChanged: 'A small update', recommendation: 'Review later', reason: 'Informational' };
    await instance.handleMaterialChange(signal);
    await instance.handleMaterialChange(signal);
    expect(digests.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(digests.findOneAndUpdate.mock.calls[0][1]).toEqual(expect.objectContaining({ $push: { items: { whatChanged: 'A small update', recommendation: 'Review later', reason: 'Informational' } } }));
  });

  it('flushes one digest notification and sends it through Expo', async () => {
    const { instance, digests, notifications, push } = service();
    const digest = { _id: 'digest-1', userId, items: [{ whatChanged: 'A', recommendation: 'Do A', reason: 'R1' }, { whatChanged: 'B', recommendation: 'Do B', reason: 'R2' }] };
    digests.find.mockReturnValue({ cursor: () => (async function* () { yield digest; })() });
    await expect(instance.flushLowPriorityDigests()).resolves.toBe(1);
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'LOW', whatChanged: 'A; B', recommendation: 'Do A; Do B', reason: 'R1; R2' }));
    expect(push.send).toHaveBeenCalledTimes(1);
    expect(digests.deleteOne).toHaveBeenCalledWith({ _id: 'digest-1' });
  });
});
