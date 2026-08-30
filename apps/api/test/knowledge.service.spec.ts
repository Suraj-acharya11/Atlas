import { Types } from 'mongoose';
import { KnowledgeService } from '../src/knowledge/knowledge.service';

const event = (id: string, supports = true) => ({ _id: new Types.ObjectId(id), userId: new Types.ObjectId('507f1f77bcf86cd799439011'), payload: { knowledge: { subject: 'user', predicate: 'prefers_evening', object: 'study', category: 'preference', supports } } });

describe('KnowledgeService Phase 3', () => {
  it('keeps one claim pending, then activates it after the second supporting event', async () => {
    const first = { _id: new Types.ObjectId(), confidence: 20, evidenceCount: 0, supportingEventIds: [] as Types.ObjectId[], status: 'pending', lastUpdatedAt: new Date(), save: jest.fn() } as any;
    first.save.mockResolvedValue(first);
    const second = { ...first, _id: new Types.ObjectId(), confidence: 35, evidenceCount: 1, supportingEventIds: [new Types.ObjectId()], status: 'pending', save: jest.fn() } as any;
    second.save.mockResolvedValue(second);
    const model: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(second) }), create: jest.fn().mockResolvedValue(first), find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) };
    const service = new KnowledgeService(model);
    await service.evaluate(event('507f1f77bcf86cd799439012'));
    expect(first.confidence).toBe(35);
    expect(first.status).toBe('pending');
    await service.evaluate(event('507f1f77bcf86cd799439013'));
    expect(second.confidence).toBe(50);
    expect(second.evidenceCount).toBe(2);
    expect(second.status).toBe('active');
  });

  it('reduces confidence for contradiction without deleting the relationship', async () => {
    const relationship = { _id: new Types.ObjectId(), confidence: 60, evidenceCount: 2, supportingEventIds: [], status: 'active', lastUpdatedAt: new Date(), save: jest.fn() } as any;
    relationship.save.mockResolvedValue(relationship);
    const model: any = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(relationship) }), find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }), deleteOne: jest.fn() };
    const service = new KnowledgeService(model);
    const result = await service.evaluate(event('507f1f77bcf86cd799439014', false));
    expect(result).toBe(relationship);
    expect(relationship.confidence).toBe(40);
    expect(relationship.status).toBe('pending');
    expect(model.deleteOne).not.toHaveBeenCalled();
  });

  it('decays stale relationships without deleting them', async () => {
    const relationship = { confidence: 80, evidenceCount: 2, status: 'active', lastUpdatedAt: new Date(0), save: jest.fn() } as any;
    relationship.save.mockResolvedValue(relationship);
    const model: any = { find: jest.fn().mockReturnValue({ cursor: () => (async function* () { yield relationship; })() }) };
    const service = new KnowledgeService(model);
    const changed = await service.decayStale(new Date('2026-01-22T00:00:00.000Z'));
    expect(changed).toBe(1);
    expect(relationship.confidence).toBe(70);
    expect(relationship.save).toHaveBeenCalled();
  });

  it('supersedes the lower-confidence relationship in the same dimension', async () => {
    const winner = { _id: new Types.ObjectId(), predicate: 'prefers_evening', confidence: 80, status: 'active', userId: new Types.ObjectId(), subject: 'user', supersededBy: null, save: jest.fn() } as any;
    const loser = { _id: new Types.ObjectId(), predicate: 'prefers_morning', confidence: 40, status: 'active', userId: winner.userId, subject: winner.subject, supersededBy: null, save: jest.fn() } as any;
    loser.save.mockResolvedValue(loser);
    const model: any = { find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([loser]) }) };
    const service = new KnowledgeService(model);
    await (service as any).resolveConflict(winner);
    expect(loser.supersededBy).toBe(winner._id);
    expect(loser.save).toHaveBeenCalled();
  });
});
