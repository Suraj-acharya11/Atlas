import { apiRequest } from './api-client';
import type { ExecutionRecord, ExecutionStatus } from './types';

export const TERMINAL_EXECUTION_STATUSES: ExecutionStatus[] = ['completed', 'partial', 'abandoned'];

export function isTerminalExecution(status: ExecutionStatus) {
  return TERMINAL_EXECUTION_STATUSES.includes(status);
}

export function elapsedSeconds(startedAt: string, now = Date.now()) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.floor((now - started) / 1000));
}

export function formatElapsedDuration(startedAt: string, now = Date.now()) {
  const total = elapsedSeconds(startedAt, now);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function startExecution(taskId: string, missionId: string) {
  return apiRequest<ExecutionRecord>('/api/v1/execution', {
    method: 'POST',
    body: { taskId, missionId },
  });
}

export function transitionExecution(executionId: string, status: ExecutionStatus, progressPercent?: number) {
  return apiRequest<ExecutionRecord>(`/api/v1/execution/${executionId}/transition`, {
    method: 'POST',
    body: progressPercent === undefined ? { status } : { status, progressPercent },
  });
}
