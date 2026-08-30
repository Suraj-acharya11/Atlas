import { AiService } from '../src/ai/ai.service';
import { EmbeddingService } from '../src/ai/embedding.service';

describe('AI boundaries', () => {
  it('exposes analysis and embedding seams without domain write dependencies', () => {
    expect(Object.getOwnPropertyNames(AiService.prototype)).not.toEqual(expect.arrayContaining(['createTask', 'createDecision', 'writeKnowledge', 'createMission']));
    expect(Object.getOwnPropertyNames(EmbeddingService.prototype)).toContain('embed');
  });
});
