import { BadRequestException } from '@nestjs/common';

export const TRANSITIONS = {
  started: ['paused', 'completed', 'partial', 'abandoned'],
  paused: ['resumed', 'abandoned'],
  resumed: ['paused', 'completed', 'partial', 'abandoned'],
  completed: [],
  partial: [],
  abandoned: [],
} as const;

export type ExecutionStatus = keyof typeof TRANSITIONS;

export function assertTransition(current: ExecutionStatus, next: ExecutionStatus): void {
  if (!TRANSITIONS[current].includes(next as never)) throw new BadRequestException(`Illegal execution transition: ${current} → ${next}`);
}
