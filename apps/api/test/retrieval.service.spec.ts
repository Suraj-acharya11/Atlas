import { BadRequestException } from '@nestjs/common';
import { RetrievalService } from '../src/retrieval/retrieval.service';

const userId = '507f1f77bcf86cd799439011';
const knowledgeId = '507f1f77bcf86cd799439012';

describe('Phase 8 RetrievalService', () => {
  const embedding = { embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]) };
  const knowledge = { findById: jest.fn() };
  const mongo = { collection: jest.fn().mockReturnValue({ findOne: jest.fn() }) };
  const qdrant = { upsert: jest.fn(), search: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    qdrant.upsert.mockResolvedValue(undefined);
    qdrant.search.mockImplementation(async (collection: string) => collection === 'knowledge_v1'
      ? [{ id: 'ignored', score: 0.92, payload: { userId, sourceCollection: 'knowledge_relationships', sourceId: knowledgeId } }]
      : []);
    knowledge.findById.mockResolvedValue({ _id: knowledgeId, subject: 'focus', predicate: 'needs', object: 'quiet' });
  });

  it('embeds and upserts only a minimal knowledge reference', async () => {
    const service = new RetrievalService(embedding as any, knowledge as any, mongo as any, qdrant as any);
    await service.upsert(userId, 'knowledge_relationships', knowledgeId, 'Focus needs quiet mornings');
    expect(embedding.embed).toHaveBeenCalledWith('Focus needs quiet mornings');
    expect(qdrant.upsert).toHaveBeenCalledWith('knowledge_v1', {
      id: knowledgeId,
      vector: [0.1, 0.2, 0.3],
      payload: { userId, sourceCollection: 'knowledge_relationships', sourceId: knowledgeId },
    });
    expect(JSON.stringify(qdrant.upsert.mock.calls[0])).not.toContain('Focus needs quiet mornings');
  });

  it('resolves search hits through Mongo-owned services and drops unresolved points', async () => {
    const service = new RetrievalService(embedding as any, knowledge as any, mongo as any, qdrant as any);
    await expect(service.search(userId, 'why does focus need quiet?', 5)).resolves.toEqual([{
      score: 0.92,
      sourceCollection: 'knowledge_relationships',
      sourceId: knowledgeId,
      record: { _id: knowledgeId, subject: 'focus', predicate: 'needs', object: 'quiet' },
    }]);
    expect(knowledge.findById).toHaveBeenCalledWith(userId, knowledgeId);
    expect(qdrant.search).toHaveBeenCalledWith('knowledge_v1', [0.1, 0.2, 0.3], userId, 5);
    expect(qdrant.search).toHaveBeenCalledWith('documents_v1', [0.1, 0.2, 0.3], userId, 5);
  });

  it('rejects raw events and other non-indexable sources at the service boundary', async () => {
    const service = new RetrievalService(embedding as any, knowledge as any, mongo as any, qdrant as any);
    await expect(service.upsert(userId, 'events', '507f1f77bcf86cd799439013', 'raw event')).rejects.toBeInstanceOf(BadRequestException);
    expect(embedding.embed).not.toHaveBeenCalled();
    expect(qdrant.upsert).not.toHaveBeenCalled();
  });
});
