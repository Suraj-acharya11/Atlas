import { Injectable } from '@nestjs/common';

@Injectable()
export class MlService {
  // V1 deliberately has no trained outcome model. Keep the seam callable for Phase 4.
  async getAdjustment(_candidate: unknown, _context: unknown): Promise<{ adjustment: number; reliable: boolean }> {
    return { adjustment: 0, reliable: false };
  }
  async recordLearningSignal(_signal: unknown): Promise<void> {}
}
