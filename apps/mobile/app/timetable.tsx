import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppScreen } from '../components/AppScreen';
import { QueryState } from '../components/QueryState';
import { useMission, useTasks } from '../lib/queries';
import { useAuth } from '../lib/auth-context';
import { apiRequest, isNetworkError } from '../lib/api-client';
import { colors, styles } from '../lib/theme';
import { formatElapsedDuration, isTerminalExecution, startExecution, transitionExecution } from '../lib/execution';
import type { ExecutionRecord, ExecutionStatus, Mission, MissionBlock, Task } from '../lib/types';

const PERIOD_LABELS: Record<string, string> = {
  morning: '🌅 Morning',
  college: '🎓 Core Focus',
  after_college: '🌤 Afternoon',
  evening: '🌆 Evening',
  night: '🌙 Night',
};

export default function TimetableScreen() {
  const missionQuery = useMission();
  const tasksQuery = useTasks();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [regenerating, setRegenerating] = useState(false);
  const [activeSession, setActiveSession] = useState<ExecutionRecord | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSession || isTerminalExecution(activeSession.status)) return undefined;
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
  }, [activeSession?.startedAt, activeSession?.status]);

  const userTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
      queryClient.invalidateQueries({ queryKey: ['reflections'] }),
    ]);
  };

  const handleReplan = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      // First get or create today's mission, then force replan it
      const currentMission = await apiRequest<Mission>('/api/v1/planning/missions/today', {
        method: 'POST',
        body: {},
      });
      // Now force a replan of that mission
      if (currentMission?._id) {
        const replanned = await apiRequest<Mission>(`/api/v1/planning/missions/${currentMission._id}/replan`, {
          method: 'POST',
          body: {
            triggerEvent: { type: 'USER_UNAVAILABLE', payload: { reason: 'User requested manual replan' } },
          },
        });
        if (replanned) {
          queryClient.setQueryData(['mission', 'today'], replanned);
        }
      }
      await refreshAll();
    } catch (e) {
      const msg = isNetworkError(e)
        ? 'Connection required. This action needs an internet connection.'
        : (e instanceof Error ? e.message : 'Unable to recompute plan.');
      Alert.alert('Planning Error', msg);
    } finally {
      setRegenerating(false);
    }
  };

  const handleStartBlockSession = async (block: MissionBlock, mission: Mission) => {
    if (!block.taskId || sessionBusy) return;
    setSessionBusy(true);
    try {
      const record = await startExecution(block.taskId, mission._id);
      setActiveSession(record);
      await refreshAll();
    } catch (e) {
      const msg = isNetworkError(e)
        ? 'Connection required. This action needs an internet connection.'
        : (e instanceof Error ? e.message : 'Unable to start focus session.');
      Alert.alert('Session Error', msg);
    } finally {
      setSessionBusy(false);
    }
  };

  const handleTransitionSession = async (status: ExecutionStatus) => {
    if (!activeSession || sessionBusy) return;
    setSessionBusy(true);
    try {
      const updated = await transitionExecution(activeSession._id, status);
      setActiveSession(isTerminalExecution(updated.status) ? null : updated);
      await refreshAll();
    } catch (e) {
      const msg = isNetworkError(e)
        ? 'Connection required. This action needs an internet connection.'
        : (e instanceof Error ? e.message : 'Unable to update session.');
      Alert.alert('Session Error', msg);
    } finally {
      setSessionBusy(false);
    }
  };

  return (
    <AppScreen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ paddingRight: 15 }}>
          <Text style={{ color: colors.text, fontSize: 30 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Today’s Timetable</Text>
          <Text style={styles.subtitle}>
            Generated by Planning Engine • 🌐 {userTimezone}
          </Text>
        </View>
        <Pressable
          disabled={regenerating}
          onPress={handleReplan}
          style={{
            backgroundColor: colors.surface2,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.violet,
            opacity: regenerating ? 0.6 : 1,
          }}>
          <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>
            {regenerating ? 'Recomputing…' : '↻ Replan'}
          </Text>
        </Pressable>
      </View>

      {/* Active Focus Session Banner (if running) */}
      {activeSession ? (
        <View style={[styles.card, { backgroundColor: '#1f1338', borderColor: colors.violet, marginBottom: 16 }]}>
          <Text style={styles.label}>Active Focus Session</Text>
          <Text style={[styles.title, { fontSize: 22, marginTop: 4 }]}>
            {formatElapsedDuration(activeSession.startedAt, now)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {activeSession.status === 'started' || activeSession.status === 'resumed' ? (
              <Pressable
                disabled={sessionBusy}
                onPress={() => handleTransitionSession('paused')}
                style={[styles.button, { flex: 1, paddingVertical: 8 }]}>
                <Text style={styles.buttonText}>Pause</Text>
              </Pressable>
            ) : null}
            {activeSession.status === 'paused' ? (
              <Pressable
                disabled={sessionBusy}
                onPress={() => handleTransitionSession('resumed')}
                style={[styles.button, { flex: 1, paddingVertical: 8 }]}>
                <Text style={styles.buttonText}>Resume</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={sessionBusy}
              onPress={() => handleTransitionSession('completed')}
              style={[styles.button, { flex: 1, backgroundColor: colors.green, paddingVertical: 8 }]}>
              <Text style={styles.buttonText}>✓ Complete</Text>
            </Pressable>
            <Pressable
              disabled={sessionBusy}
              onPress={() => handleTransitionSession('partial')}
              style={[styles.button, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet, paddingVertical: 8 }]}>
              <Text style={[styles.buttonText, { color: colors.violetSoft, fontSize: 12 }]}>Partial</Text>
            </Pressable>
            <Pressable
              disabled={sessionBusy}
              onPress={() => handleTransitionSession('abandoned')}
              style={[styles.button, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.red, paddingVertical: 8 }]}>
              <Text style={[styles.buttonText, { color: colors.red, fontSize: 12 }]}>Abandon</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Timetable Content */}
      <QueryState query={missionQuery}>
        {(mission) => {
          const blocks = mission.blocks ?? [];
          const tasks = tasksQuery.data ?? [];
          const taskMap = new Map<string, Task>(tasks.map((t) => [t._id, t]));

          if (blocks.length === 0) {
            return (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 36 }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🗓️</Text>
                <Text style={[styles.body, { fontWeight: '700' }]}>No plan for today yet</Text>
                <Text style={[styles.muted, { marginTop: 4, textAlign: 'center', maxWidth: 260 }]}>
                  The Planning Engine can synthesize today’s priorities into a time-blocked mission.
                </Text>
                <Pressable
                  disabled={regenerating}
                  style={[styles.button, { marginTop: 16, opacity: regenerating ? 0.6 : 1 }]}
                  onPress={handleReplan}>
                  <Text style={styles.buttonText}>{regenerating ? 'Generating…' : 'Generate Today’s Plan'}</Text>
                </Pressable>
              </View>
            );
          }

          // Group blocks by period
          const periodOrder = ['morning', 'college', 'after_college', 'evening', 'night'];
          const groupedBlocks: Record<string, MissionBlock[]> = {};
          blocks.forEach((block) => {
            const p = block.period || 'flexible';
            if (!groupedBlocks[p]) groupedBlocks[p] = [];
            groupedBlocks[p].push(block);
          });

          return (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Mission Objective Card */}
              <View style={[styles.card, { backgroundColor: '#18122B', borderColor: '#483475', marginTop: 0 }]}>
                <Text style={styles.label}>Today’s Primary Objective</Text>
                <Text style={[styles.title, { fontSize: 20, marginTop: 6 }]}>
                  {mission.objective || 'Make meaningful progress on today’s priorities'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
                  <Text style={{ color: colors.violetSoft, fontSize: 12 }}>
                    📅 {mission.date}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    • {blocks.length} scheduled blocks
                  </Text>
                  {mission.focusSessions?.length ? (
                    <Text style={{ color: colors.green, fontSize: 12 }}>
                      • {mission.focusSessions.length} focus sessions
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.body, { fontWeight: '800', marginTop: 20, marginBottom: 4 }]}>
                Schedule & Time Blocks
              </Text>

              {/* Chronological Blocks by Period */}
              {periodOrder.map((periodKey) => {
                const periodBlocks = groupedBlocks[periodKey];
                if (!periodBlocks || periodBlocks.length === 0) return null;

                return (
                  <View key={periodKey} style={{ marginTop: 14 }}>
                    <Text style={[styles.label, { color: colors.violetSoft, marginBottom: 6 }]}>
                      {PERIOD_LABELS[periodKey] || periodKey.toUpperCase()}
                    </Text>

                    {periodBlocks
                      .slice()
                      .sort((a, b) => {
                        if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt);
                        if (a.startsAt) return -1;
                        if (b.startsAt) return 1;
                        return 0;
                      })
                      .map((block, idx, sortedArr) => {
                        const associatedTask = block.taskId ? taskMap.get(block.taskId) : null;
                        const isCompleted = associatedTask?.status === 'completed';
                        const isTaskActive = activeSession?.taskId === block.taskId;
                        const isFixed = block.kind === 'fixed';
                        const nextBlock = sortedArr[idx + 1];
                        const hasBuffer = block.endsAt && nextBlock?.startsAt && nextBlock.startsAt > block.endsAt;

                        return (
                          <React.Fragment key={block.id || `${periodKey}-${idx}`}>
                            <View
                              style={[
                                styles.card,
                                {
                                  marginTop: 6,
                                  borderColor: isTaskActive ? colors.violet : isCompleted ? colors.border : colors.border,
                                  backgroundColor: isTaskActive ? '#1c1533' : colors.surface,
                                },
                              ]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {/* Block Kind / Status Indicator */}
                                <View
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 13,
                                    borderWidth: 2,
                                    borderColor: isCompleted
                                      ? colors.green
                                      : isFixed
                                      ? colors.yellow
                                      : colors.violet,
                                    backgroundColor: isCompleted ? colors.green : 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                  }}>
                                  {isCompleted ? (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>
                                  ) : (
                                    <Text
                                      style={{
                                        color: isFixed ? colors.yellow : colors.violetSoft,
                                        fontSize: 10,
                                        fontWeight: '800',
                                      }}>
                                      {isFixed ? '🔒' : '⚡'}
                                    </Text>
                                  )}
                                </View>

                                {/* Block Details */}
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text
                                      style={[
                                        styles.body,
                                        {
                                          fontWeight: '700',
                                          textDecorationLine: isCompleted ? 'line-through' : 'none',
                                          color: isCompleted ? colors.muted : colors.text,
                                        },
                                      ]}>
                                      {block.title}
                                    </Text>
                                    <View
                                      style={{
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: colors.surface2,
                                      }}>
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' }}>
                                        {block.kind}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Time / Associated Task Info */}
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
                                    {block.startsAt && block.endsAt ? (
                                      <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '600' }}>
                                        ⏰ {block.startsAt} – {block.endsAt}
                                      </Text>
                                    ) : (
                                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                                        ⏱ Recommended Block
                                      </Text>
                                    )}

                                    {associatedTask ? (
                                      <Text style={{ color: isCompleted ? colors.green : colors.muted, fontSize: 12 }}>
                                        • Task: {associatedTask.status.replace('_', ' ')}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              {/* Action button if task is linked and not completed */}
                              {block.taskId && !isCompleted ? (
                                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'flex-end' }}>
                                  <Pressable
                                    disabled={sessionBusy}
                                    onPress={() => handleStartBlockSession(block, mission)}
                                    style={{
                                      backgroundColor: colors.surface2,
                                      paddingHorizontal: 12,
                                      paddingVertical: 5,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: colors.violet,
                                    }}>
                                    <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>
                                      {isTaskActive ? '▶ In Progress' : '▶ Start Focus Session'}
                                    </Text>
                                  </Pressable>
                                </View>
                              ) : null}
                            </View>

                            {/* Buffer between consecutive blocks */}
                            {hasBuffer ? (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  paddingVertical: 4,
                                  marginVertical: 2,
                                  gap: 8,
                                }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.35 }} />
                                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>
                                  ☕ Buffer: {block.endsAt} – {nextBlock?.startsAt}
                                </Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.35 }} />
                              </View>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                  </View>
                );
              })}

              <View style={{ height: 40 }} />
            </ScrollView>
          );
        }}
      </QueryState>
    </AppScreen>
  );
}
