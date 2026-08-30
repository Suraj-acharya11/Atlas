import { AppState } from 'react-native';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppScreen } from '../../components/AppScreen';
import { QueryState } from '../../components/QueryState';
import { formatElapsedDuration, isTerminalExecution, startExecution, transitionExecution } from '../../lib/execution';
import { useDecision, useGoals, useMission, useTasks } from '../../lib/queries';
import { colors, styles } from '../../lib/theme';
import type { Decision, ExecutionRecord, ExecutionStatus, Mission, Task } from '../../lib/types';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}

async function refreshAfterExecution(queryClient: ReturnType<typeof useQueryClient>, status: ExecutionStatus) {
  const queries = [
    queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
    queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
    queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  ];
  if (isTerminalExecution(status)) queries.push(queryClient.invalidateQueries({ queryKey: ['reflections'] }));
  await Promise.all(queries);
}

export function FocusAction({ decision, mission, tasks }: { decision: Decision; mission: Mission; tasks: Task[] }) {
  const queryClient = useQueryClient();
  const [execution, setExecution] = useState<ExecutionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const task = tasks.find((item) => item._id === decision.topCandidateId);
  const active = execution !== null && !isTerminalExecution(execution.status);

  useEffect(() => {
    if (!execution || isTerminalExecution(execution.status)) return undefined;
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [execution?.startedAt, execution?.status]);

  const start = async () => {
    if (!task || busy || active || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setMutationError(null);
    try {
      const result = await startExecution(task._id, mission._id);
      setExecution(result);
      setNow(Date.now());
      await refreshAfterExecution(queryClient, result.status);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  const transition = async (status: ExecutionStatus) => {
    if (!execution || !active || busy || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setMutationError(null);
    try {
      const result = await transitionExecution(execution._id, status);
      setExecution(result);
      await refreshAfterExecution(queryClient, result.status);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Next best action</Text>
      <Text style={[styles.title, { fontSize: 20, marginTop: 8 }]}>{task?.title ?? decision.priorityList?.[0]?.title ?? 'Your next action is being prepared'}</Text>
      <Text style={[styles.muted, { marginTop: 5 }]}>{decision.topExplanation ?? 'This recommendation comes from the ATLAS Decision Engine.'}</Text>
      {execution ? (
        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.surface2 }}>
          <Text style={styles.label}>{active ? 'Active focus session' : `Session ${execution.status}`}</Text>
          <Text style={[styles.title, { fontSize: 28, marginTop: 6 }]}>{formatElapsedDuration(execution.startedAt, now)}</Text>
          <Text style={styles.muted}>{active ? 'Elapsed from the server start time' : `${execution.actualDurationMinutes} minutes recorded by ATLAS`}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {active ? (
          <>
            {(execution.status === 'started' || execution.status === 'resumed') ? <Pressable disabled={busy} style={[styles.button, { opacity: busy ? 0.6 : 1 }]} onPress={() => transition('paused')}><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Pause'}</Text></Pressable> : null}
            {execution.status === 'paused' ? <Pressable disabled={busy} style={[styles.button, { opacity: busy ? 0.6 : 1 }]} onPress={() => transition('resumed')}><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Resume'}</Text></Pressable> : null}
            {(execution.status === 'started' || execution.status === 'resumed') ? <Pressable disabled={busy} style={[styles.button, { opacity: busy ? 0.6 : 1 }]} onPress={() => transition('completed')}><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Complete focus session'}</Text></Pressable> : null}
            {(execution.status === 'started' || execution.status === 'resumed') ? <Pressable disabled={busy} style={[styles.button, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet, opacity: busy ? 0.6 : 1 }]} onPress={() => transition('partial')}><Text style={[styles.buttonText, { color: colors.violetSoft }]}>Mark partial</Text></Pressable> : null}
            <Pressable disabled={busy} style={[styles.button, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet, opacity: busy ? 0.6 : 1 }]} onPress={() => transition('abandoned')}><Text style={[styles.buttonText, { color: colors.violetSoft }]}>Abandon</Text></Pressable>
          </>
        ) : (
          <Pressable disabled={busy || !task} style={[styles.button, { flex: 1, opacity: busy || !task ? 0.6 : 1 }]} onPress={start}><Text style={styles.buttonText}>{busy ? 'Starting…' : '▶  Start now'}</Text></Pressable>
        )}
        <Pressable style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet }]} onPress={() => decision._id && router.push(`/decision/${decision._id}/explain`)}><Text style={[styles.buttonText, { color: colors.violetSoft }]}>ⓘ Why this?</Text></Pressable>
      </View>
      {mutationError ? <Text style={{ color: '#ff8f9c', marginTop: 12 }}>{mutationError}</Text> : null}
    </View>
  );
}

export default function Dashboard() {
  const goals = useGoals(); const tasks = useTasks(); const mission = useMission(); const decision = useDecision();
  const combined = { ...decision, isLoading: decision.isLoading || tasks.isLoading, isError: decision.isError || tasks.isError, error: decision.error ?? tasks.error, data: decision.data && tasks.data ? decision.data : undefined, dataUpdatedAt: Math.min(decision.dataUpdatedAt, tasks.dataUpdatedAt), refetch: async () => { await Promise.all([decision.refetch(), tasks.refetch()]); return decision as any; } };
  return <AppScreen><Text style={styles.title}>Good morning 👋</Text><Text style={styles.subtitle}>Focus <Text style={{ color: colors.violet }}>•</Text> Plan <Text style={{ color: colors.violet }}>•</Text> Execute <Text style={{ color: colors.violet }}>•</Text> Reflect</Text><View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>{[['Focus', '—'], ['Streak', '—'], ['Total focus', '—'], ['Progress', '—']].map(([label, value]) => <View key={label} style={[styles.card, { flex: 1, marginTop: 0, padding: 10 }]}><Text style={{ color: colors.violetSoft, fontSize: 11 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{value}</Text></View>)}</View><QueryState query={mission}>{(m) => <View style={[styles.card, { backgroundColor: '#2a1b58', borderColor: '#5f3dcc' }]}><Text style={styles.label}>Today’s mission</Text><Text style={[styles.title, { fontSize: 20, marginTop: 8 }]}>{m.blocks?.[0]?.title ?? 'Your mission is ready'}</Text><Text style={[styles.muted, { marginTop: 5 }]}>Work from the plan returned by ATLAS.</Text></View>}</QueryState>{mission.data ? <QueryState query={combined}>{(d) => <FocusAction decision={d} mission={mission.data!} tasks={tasks.data!} />}</QueryState> : null}<View style={styles.card}><Text style={styles.label}>Your goals</Text><Text style={[styles.body, { marginTop: 8 }]}>{goals.data?.length ?? '—'} active goals in your plan</Text><Pressable style={{ marginTop: 12 }} onPress={() => router.push('/(tabs)/plan')}><Text style={{ color: colors.violetSoft, fontWeight: '700' }}>View your plan →</Text></Pressable></View><View style={styles.card}><Text style={styles.label}>Notifications</Text><Text style={[styles.muted, { marginTop: 8 }]}>HIGH and CRITICAL changes are delivered through Expo push notifications.</Text><Pressable style={[styles.button, { marginTop: 12 }]} onPress={() => router.push('/(tabs)/ai-chat')}><Text style={styles.buttonText}>Manage notification setup</Text></Pressable></View></AppScreen>;
}
