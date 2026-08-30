export const MATERIAL_CHANGE_TYPES = {
  nextBestActionChanged: 'next_best_action_changed',
  deadlineMovedCloser: 'deadline_moved_closer',
  taskOverdue: 'task_overdue',
  planImpossible: 'plan_impossible',
  replanningChangedSchedule: 'replanning_changed_schedule',
  minorUpdate: 'minor_update',
  knowledgeOnly: 'knowledge_only',
} as const;

export type MaterialChangeType = (typeof MATERIAL_CHANGE_TYPES)[keyof typeof MATERIAL_CHANGE_TYPES];
export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type MaterialChangeDetected = {
  userId: string;
  type: MaterialChangeType;
  whatChanged: string;
  recommendation: string;
  reason: string;
  lastValidOutputPreserved?: boolean;
};

export type NotificationContent = Pick<MaterialChangeDetected, 'whatChanged' | 'recommendation' | 'reason'>;

export type NotificationJob = { signal: MaterialChangeDetected };
