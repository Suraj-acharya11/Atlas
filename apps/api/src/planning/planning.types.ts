import { MissionTrigger } from './regeneration.util';

export type FixedCommitment = { id: string; title: string; period?: string; startsAt?: string; endsAt?: string; kind: 'fixed' };
export type FlexibleBlock = { taskId: string; title: string; period: 'morning' | 'college' | 'after_college' | 'evening' | 'night'; kind: 'flexible' };
export type CarryForwardAction = 'carried' | 'reprioritized' | 'split' | 'dropped';
export type CarryForwardDecision = { taskId: string; action: CarryForwardAction; reason: string };
export type PlanningInput = { fixedCommitments?: FixedCommitment[]; flexiblePeriods?: FlexibleBlock['period'][]; unfinishedTaskIds?: string[]; carryForward?: Record<string, { action: CarryForwardAction; reason: string }> };
export type ReplanRequest = { triggerEvent: MissionTrigger; input?: PlanningInput };
