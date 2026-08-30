export type MissionTrigger = { type: string; payload?: Record<string, unknown> };

export function shouldRegenerate(_currentMission: unknown, triggerEvent: MissionTrigger): boolean {
  switch (triggerEvent.type) {
    case 'MOOD_UPDATED':
    case 'ENERGY_UPDATED':
    case 'HIGH_PRIORITY_TASK_ADDED':
    case 'TASK_DEADLINE_CHANGED':
    case 'USER_UNAVAILABLE':
    case 'CALENDAR_COMMITMENT_CHANGED':
    case 'MISSION_COMPLETED_EARLY':
      return true;
    default:
      return false;
  }
}
