import { OrchestrationService } from '../src/orchestration/orchestration.service';

const userId = '507f1f77bcf86cd799439011';

function queue() { return { add: jest.fn().mockResolvedValue(undefined) }; }

describe('Phase 11 OrchestrationService', () => {
  it('routes qualifying domain events to Knowledge only', async () => {
    const knowledge = queue(); const decision = queue(); const notification = queue();
    const service = new OrchestrationService({} as any, knowledge as any, decision as any, notification as any);
    await service.handleEvent({ id: 'event-1', type: 'TASK_COMPLETED', userId, payload: {} });
    expect(knowledge.add).toHaveBeenCalledWith('knowledge-evaluation', { eventId: 'event-1' });
    expect(decision.add).not.toHaveBeenCalled();
    expect(notification.add).not.toHaveBeenCalled();
  });

  it('routes only KNOWLEDGE_UPDATED to Decision recomputation', async () => {
    const knowledge = queue(); const decision = queue(); const notification = queue();
    const service = new OrchestrationService({} as any, knowledge as any, decision as any, notification as any);
    await service.handleEvent({ id: 'event-2', type: 'KNOWLEDGE_UPDATED', userId, payload: {} });
    expect(decision.add).toHaveBeenCalledWith('decision-recompute', { userId, eventId: 'event-2' });
    expect(knowledge.add).not.toHaveBeenCalled();
    expect(notification.add).not.toHaveBeenCalled();
  });

  it('routes only an existing MaterialChangeDetected signal to Notification', async () => {
    const knowledge = queue(); const decision = queue(); const notification = queue();
    const service = new OrchestrationService({} as any, knowledge as any, decision as any, notification as any);
    const signal = { userId, type: 'task_overdue', whatChanged: 'Overdue', recommendation: 'Start', reason: 'Deadline passed' };
    await service.handleEvent({ id: 'event-3', type: 'MATERIAL_CHANGE_DETECTED', userId, payload: { signal } });
    expect(notification.add).toHaveBeenCalledWith('notification-evaluation', { signal });
    expect(knowledge.add).not.toHaveBeenCalled();
    expect(decision.add).not.toHaveBeenCalled();
  });

  it('loads the Event through EventService before routing an event-bus job', async () => {
    const knowledge = queue(); const events = { findById: jest.fn().mockResolvedValue({ toObject: () => ({ id: 'event-4', type: 'TASK_STARTED', userId, payload: {} }) }) };
    const service = new OrchestrationService(events as any, knowledge as any, queue() as any, queue() as any);
    await service.processEventBusJob('event-4');
    expect(events.findById).toHaveBeenCalledWith('event-4');
    expect(knowledge.add).toHaveBeenCalledWith('knowledge-evaluation', { eventId: 'event-4' });
  });
});
