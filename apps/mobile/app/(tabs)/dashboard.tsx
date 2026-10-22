import { AppState } from 'react-native';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppScreen } from '../../components/AppScreen';
import { QueryState } from '../../components/QueryState';
import { LoadingState } from '../../components/ui';
import { formatElapsedDuration, isTerminalExecution, startExecution, transitionExecution } from '../../lib/execution';
import { useDecision, useGoals, useMission, useReflections, useTasks } from '../../lib/queries';
import { useAuth } from '../../lib/auth-context';
import { colors, styles } from '../../lib/theme';
import type { Decision, ExecutionRecord, ExecutionStatus, Mission, Reflection, Task } from '../../lib/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

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
      <Text style={styles.label}>Next up</Text>
      <Text style={[styles.title, { fontSize: 20, marginTop: 8 }]}>{task?.title ?? decision.priorityList?.[0]?.title ?? 'Your next action is being prepared'}</Text>
      <Text style={[styles.muted, { marginTop: 5 }]}>{decision.topExplanation ?? 'Recommended based on your current priorities and deadlines.'}</Text>
      {execution ? (
        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.surface2 }}>
          <Text style={styles.label}>{active ? 'Active focus session' : `Session ${execution.status}`}</Text>
          <Text style={[styles.title, { fontSize: 28, marginTop: 6 }]}>{formatElapsedDuration(execution.startedAt, now)}</Text>
          <Text style={styles.muted}>{active ? 'Elapsed from the server start time' : `${execution.actualDurationMinutes} minutes recorded by ATLAS`}</Text>
          {!active && isTerminalExecution(execution.status) ? (
            <Pressable
              style={[styles.button, { marginTop: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.violet }]}
              onPress={() => router.replace('/(tabs)/reflection')}>
              <Text style={[styles.buttonText, { color: colors.violetSoft }]}>Review Reflection Signals →</Text>
            </Pressable>
          ) : null}
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
          <Pressable disabled={busy || !task} style={[styles.button, { flex: 1, opacity: busy || !task ? 0.6 : 1 }]} onPress={start}><Text style={styles.buttonText}>{busy ? 'Starting…' : '▶  Start'}</Text></Pressable>
        )}
        <Pressable style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet }]} onPress={() => decision._id && router.push(`/decision/${decision._id}/explain`)}><Text style={[styles.buttonText, { color: colors.violetSoft }]}>Why this?</Text></Pressable>
      </View>
      {mutationError ? <Text style={{ color: '#ff8f9c', marginTop: 12 }}>{mutationError}</Text> : null}
    </View>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const goals = useGoals(); const tasks = useTasks(); const mission = useMission(); const decision = useDecision(); const reflections = useReflections();
  const combined = { ...decision, isLoading: decision.isLoading || tasks.isLoading, isError: decision.isError || tasks.isError, error: decision.error ?? tasks.error, data: (decision.data && tasks.data ? decision.data : undefined) as Decision | undefined, dataUpdatedAt: Math.min(decision.dataUpdatedAt, tasks.dataUpdatedAt), refetch: async () => { await Promise.all([decision.refetch(), tasks.refetch()]); return decision as any; } };

  const displayName = user?.displayName ?? (user?.preferences?.displayName as string) ?? user?.email?.split('@')[0] ?? null;
  const greeting = getGreeting();
  const greetingText = displayName ? `${greeting}, ${displayName} 👋` : `${greeting} 👋`;

  const activeTasks = tasks.data?.filter((t) => t.status !== 'completed' && t.status !== 'cancelled') ?? [];
  const todayTasks = activeTasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });
  const completedToday = tasks.data?.filter((t) => t.status === 'completed') ?? [];

  return (
    <AppScreen>
      <Text style={styles.title}>{greetingText}</Text>
      <Text style={styles.subtitle}>
        Focus <Text style={{ color: colors.violet }}>•</Text> Plan <Text style={{ color: colors.violet }}>•</Text> Execute <Text style={{ color: colors.violet }}>•</Text> Reflect
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
        {[
          ['Tasks Today', todayTasks.length > 0 ? String(todayTasks.length) : '—'],
          ['Active', activeTasks.length > 0 ? String(activeTasks.length) : '—'],
          ['Done', completedToday.length > 0 ? String(completedToday.length) : '—'],
          ['Goals', goals.data?.length ? String(goals.data.filter((g) => g.status === 'active').length) : '—'],
        ].map(([label, value]) => (
          <View key={label} style={[styles.card, { flex: 1, marginTop: 0, padding: 10 }]}>
            <Text style={{ color: colors.violetSoft, fontSize: 11 }}>{label}</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Today's Plan Preview linking to /timetable */}
      <QueryState query={mission}>
        {(m) => (
          <View style={[styles.card, { backgroundColor: '#1d1536', borderColor: colors.violet }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>Today’s Plan</Text>
              <Pressable onPress={() => router.push('/timetable')}>
                <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>Full Timetable ›</Text>
              </Pressable>
            </View>
            <Text style={[styles.title, { fontSize: 19, marginTop: 8 }]}>
              {m.objective || m.blocks?.[0]?.title || 'Today’s Mission is ready'}
            </Text>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              {m.blocks?.length ? `${m.blocks.length} scheduled time blocks • ${m.date}` : 'Generated by Planning Engine'}
            </Text>

            {m.blocks && m.blocks.length > 0 ? (
              <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 6 }}>
                {m.blocks.slice(0, 4).map((block, idx) => (
                  <View key={block.id || idx} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.violetSoft, fontWeight: '700', fontSize: 13, width: 62 }}>
                      {block.startsAt || '—'}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      — {block.title}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              style={{
                marginTop: 12,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: colors.surface2,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onPress={() => router.push('/timetable')}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                {m.blocks?.[0] ? `Next: ${m.blocks[0].title}` : 'View all scheduled blocks'}
              </Text>
              <Text style={{ color: colors.violetSoft, fontSize: 13, fontWeight: '700' }}>Full Timetable ➔</Text>
            </Pressable>
          </View>
        )}
      </QueryState>

      {/* Recommended Focus Action */}
      {mission.data ? (
        decision.data ? (
          <QueryState<Decision> query={combined}>
            {(d) => <FocusAction decision={d} mission={mission.data!} tasks={tasks.data!} />}
          </QueryState>
        ) : !decision.isLoading && !tasks.isLoading ? (
          <View style={styles.card}>
            <Text style={styles.label}>Next best action</Text>
            <Text style={[styles.title, { fontSize: 18, marginTop: 8 }]}>No active recommendation yet</Text>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              ATLAS prepares recommendations as you add tasks and generate your timetable.
            </Text>
          </View>
        ) : (
          <LoadingState />
        )
      ) : null}

      {/* Goals Preview */}
      <View style={styles.card}>
        <Text style={styles.label}>Your goals</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>
          {goals.data?.length ?? '—'} active goals in your plan
        </Text>
        <Pressable style={{ marginTop: 12 }} onPress={() => router.push('/(tabs)/plan')}>
          <Text style={{ color: colors.violetSoft, fontWeight: '700' }}>View your plan →</Text>
        </Pressable>
      </View>

      {/* Daily Reflection Preview */}
      <View style={[styles.card, { backgroundColor: '#1c162e', borderColor: '#45326d' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.label}>Daily Reflection</Text>
          <Pressable onPress={() => router.push('/(tabs)/reflection')}>
            <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>View Signals ›</Text>
          </Pressable>
        </View>
        <Text style={[styles.title, { fontSize: 18, marginTop: 8 }]}>
          {reflections.data?.length
            ? `${reflections.data.length} learning signal${reflections.data.length === 1 ? '' : 's'} recorded`
            : 'Reflection follows execution'}
        </Text>
        <Text style={[styles.muted, { marginTop: 4 }]}>
          {reflections.data?.[0]
            ? `Latest adherence: ${reflections.data[0].planAdherence} • ${new Date(reflections.data[0].createdAt).toLocaleDateString()}`
            : 'Complete focus sessions to feed learning signals back into ATLAS.'}
        </Text>
        <Pressable
          style={{
            marginTop: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: colors.surface2,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onPress={() => router.push('/(tabs)/reflection')}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Review Reflection Insights</Text>
          <Text style={{ color: colors.violetSoft, fontSize: 13, fontWeight: '700' }}>➔</Text>
        </Pressable>
      </View>

      {/* Notification Setup */}
      <View style={styles.card}>
        <Text style={styles.label}>Notifications</Text>
        <Text style={[styles.muted, { marginTop: 8 }]}>
          HIGH and CRITICAL changes are delivered through Expo push notifications.
        </Text>
        <Pressable style={[styles.button, { marginTop: 12 }]} onPress={() => router.push('/account')}>
          <Text style={styles.buttonText}>Configure notifications in Account</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}
