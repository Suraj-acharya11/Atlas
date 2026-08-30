import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

type QdrantPoint = {
  id: string;
  vector: number[];
  payload: { userId: string; sourceCollection: string; sourceId: string };
};

export type QdrantSearchHit = { id: string | number; score: number; payload?: Record<string, unknown> };

type QdrantResponse<T> = { result: T; status?: string; time?: number };

@Injectable()
export class QdrantClient {
  private readonly readyCollections = new Set<string>();

  constructor(private readonly baseUrl: string) {}

  async upsert(collection: string, point: QdrantPoint): Promise<void> {
    await this.ensureCollection(collection, point.vector.length);
    await this.request(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
      method: 'PUT',
      // Mongo ObjectIds are not valid Qdrant point IDs. Keep the authoritative
      // sourceId in payload and use a stable UUID-shaped ID for Qdrant itself.
      body: JSON.stringify({ points: [{ ...point, id: qdrantPointId(point.id) }] }),
    });
  }

  async search(collection: string, vector: number[], userId: string, limit: number): Promise<QdrantSearchHit[]> {
    await this.ensureCollection(collection, vector.length);
    const response = await this.request<QdrantResponse<QdrantSearchHit[]>>(
      `/collections/${encodeURIComponent(collection)}/points/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          vector,
          limit,
          with_payload: true,
          filter: { must: [{ key: 'userId', match: { value: userId } }] },
        }),
      },
    );
    return response.result;
  }

  private async ensureCollection(collection: string, vectorSize: number): Promise<void> {
    if (this.readyCollections.has(collection)) return;
    const path = `/collections/${encodeURIComponent(collection)}`;
    const existing = await fetch(`${this.baseUrl}${path}`);
    if (existing.status === 404) {
      await this.request(path, {
        method: 'PUT',
        body: JSON.stringify({ vectors: { size: vectorSize, distance: 'Cosine' } }),
      });
    } else if (!existing.ok) {
      throw new Error(`Qdrant collection check failed (${existing.status})`);
    }

    const indexResponse = await fetch(`${this.baseUrl}${path}/index`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field_name: 'userId', field_schema: 'keyword' }),
    });
    if (!indexResponse.ok && indexResponse.status !== 409) {
      throw new Error(`Qdrant userId index creation failed (${indexResponse.status})`);
    }
    this.readyCollections.add(collection);
  }

  private async request<T = QdrantResponse<unknown>>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`Qdrant request failed (${response.status})`);
    return response.json() as Promise<T>;
  }
}

function qdrantPointId(sourceId: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)) return sourceId;
  const hex = createHash('sha256').update(sourceId).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}
