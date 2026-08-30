import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './ai.tokens';
import { EmbeddingProvider } from './ai.types';

@Injectable()
export class EmbeddingService {
  constructor(@Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider) {}
  embed(text: string): Promise<number[]> { return this.provider.embed(text); }
}
