import { ExecutionStatus } from './transitions.util';

export type ExecutionStartInput = { taskId: string; missionId: string };
export type ExecutionTransitionInput = { status: ExecutionStatus; progressPercent?: number; at?: string };
