export const RETRIEVAL_SOURCES = {
  documents: 'documents',
  knowledge: 'knowledge_relationships',
} as const;

export type RetrievalSourceCollection = (typeof RETRIEVAL_SOURCES)[keyof typeof RETRIEVAL_SOURCES];

export type RetrievalReference = {
  userId: string;
  sourceCollection: RetrievalSourceCollection;
  sourceId: string;
};

export type RetrievalResult<T = Record<string, unknown>> = {
  score: number;
  sourceCollection: RetrievalSourceCollection;
  sourceId: string;
  record: T;
};

export function collectionForSource(sourceCollection: RetrievalSourceCollection): string {
  return sourceCollection === RETRIEVAL_SOURCES.documents ? 'documents_v1' : 'knowledge_v1';
}
