import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api-client';
import type { Decision, Goal, Mission, Project, Reflection, Task } from './types';

export function useGoals(){return useQuery({queryKey:['goals'],queryFn:()=>apiRequest<Goal[]>('/api/v1/goals')});}
export function useProjects(){return useQuery({queryKey:['projects'],queryFn:()=>apiRequest<Project[]>('/api/v1/projects')});}
export function useTasks(){return useQuery({queryKey:['tasks'],queryFn:()=>apiRequest<Task[]>('/api/v1/tasks')});}
export function useMission(){return useQuery({queryKey:['mission','today'],queryFn:()=>apiRequest<Mission>('/api/v1/planning/missions/today',{method:'POST',body:{}})});}
export function useDecision(){return useQuery({queryKey:['decision','current'],queryFn:()=>apiRequest<Decision | null>('/api/v1/decisions/latest')});}
export function useReflections(){return useQuery({queryKey:['reflections'],queryFn:()=>apiRequest<Reflection[]>('/api/v1/reflection/signals')});}
export function useProfile(){return useQuery({queryKey:['profile'],queryFn:()=>apiRequest<{_id:string;email:string;timezone:string;preferences?:Record<string,any>;displayName?:string;bio?:string}>('/api/v1/users/me'),staleTime:60_000});}
