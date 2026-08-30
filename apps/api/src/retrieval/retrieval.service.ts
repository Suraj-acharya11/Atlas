import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { EmbeddingService } from '../ai/embedding.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { QdrantClient, QdrantSearchHit } from './qdrant.client';
import { collectionForSource, RETRIEVAL_SOURCES, RetrievalResult, RetrievalSourceCollection } from './retrieval.types';

export const QDRANT_CLIENT = Symbol('QDRANT_CLIENT');

@Injectable()
export class RetrievalService {
  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly knowledge: KnowledgeService,
    @InjectConnection() private readonly mongo: Connection,
    @Inject(QDRANT_CLIENT) private readonly qdrant: QdrantClient,
  ) {}

  async upsert(userId: string, sourceCollection: string, sourceId: string, text: string, chunkId?: string): Promise<void> {
    const source = this.validateSource(sourceCollection);
    if (!userId || !sourceId || !text.trim()) throw new BadRequestException('userId, sourceId, and text are required');
    const vector = await this.embeddings.embed(text);
    await this.qdrant.upsert(collectionForSource(source), {
      id: chunkId ? `${sourceId}:${chunkId}` : sourceId,
      vector,
      payload: { userId, sourceCollection: source, sourceId },
    });
  }

  async search<T = Record<string, unknown>>(userId: string, queryText: string, topK = 10): Promise<RetrievalResult<T>[]> {
    if (!userId || !queryText.trim()) throw new BadRequestException('userId and queryText are required');
    const limit = Math.max(1, Math.min(Math.trunc(topK), 50));
    const vector = await this.embeddings.embed(queryText);
    const results = await Promise.all([
      this.searchSource<T>(RETRIEVAL_SOURCES.knowledge, userId, vector, limit),
      this.searchSource<T>(RETRIEVAL_SOURCES.documents, userId, vector, limit),
    ]);
    return results.flat().sort((left, right) => right.score - left.score).slice(0, limit);
  }

  private async searchSource<T>(source: RetrievalSourceCollection, userId: string, vector: number[], limit: number): Promise<RetrievalResult<T>[]> {
    const hits = await this.qdrant.search(collectionForSource(source), vector, userId, limit);
    const resolved = await Promise.all(hits.map(async (hit) => {
      const sourceId = this.sourceIdFromHit(hit);
      const record = await this.resolve(source, userId, sourceId);
      return record ? { score: hit.score, sourceCollection: source, sourceId, record: record as T } : null;
    }));
    return resolved.filter((result): result is RetrievalResult<T> => result !== null);
  }

  private async resolve(source: RetrievalSourceCollection, userId: string, sourceId: string): Promise<unknown | null> {
    if (!Types.ObjectId.isValid(sourceId) || !Types.ObjectId.isValid(userId)) return null;
    if (source === RETRIEVAL_SOURCES.knowledge) return this.knowledge.findById(userId, sourceId);
    return this.mongo.collection('documents').findOne({ _id: new Types.ObjectId(sourceId), userId: new Types.ObjectId(userId), status: { $ne: 'deleted' } });
  }

  private sourceIdFromHit(hit: QdrantSearchHit): string {
    const sourceId = hit.payload?.sourceId;
    return typeof sourceId === 'string' ? sourceId : String(hit.id);
  }

  private validateSource(sourceCollection: string): RetrievalSourceCollection {
    if (sourceCollection !== RETRIEVAL_SOURCES.documents && sourceCollection !== RETRIEVAL_SOURCES.knowledge) {
      throw new BadRequestException(`Source collection is not indexable: ${sourceCollection}`);
    }
    return sourceCollection;
  }
}
