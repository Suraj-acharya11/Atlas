import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, isNetworkError } from '../../lib/api-client';
import { useProjects, useTasks } from '../../lib/queries';
import { colors, styles } from '../../lib/theme';
import { AppScreen } from '../../components/AppScreen';
import { QueryState } from '../../components/QueryState';
import { DateTimePickerModal, formatHumanDateTime } from '../../components/DateTimePickerModal';
import type { Project, Task } from '../../lib/types';

export default function Tasks() {
  const query = useTasks();
  const projectsQuery = useProjects();
  const queryClient = useQueryClient();

  const allProjects = projectsQuery.data ?? [];
  const activeProjects = allProjects.filter((p) => p.status === 'active');

  // Create Task Form State
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [createDuration, setCreateDuration] = useState<string>('25');
  const [createProjectId, setCreateProjectId] = useState<string | null>(null);
  const [createDeadline, setCreateDeadline] = useState<string | null>(null);
  const [createPickerOpen, setCreatePickerOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected Task / Details & Edit Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [editDuration, setEditDuration] = useState<string>('');
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled'>('todo');
  const [editDeadline, setEditDeadline] = useState<string | null>(null);
  const [editPickerOpen, setEditPickerOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter State
  const [activeFilter, setActiveFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditPriority(task.priority ?? 'medium');
    setEditDuration(task.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : '');
    setEditProjectId(task.projectId ?? null);
    setEditStatus(task.status);
    setEditDeadline(task.deadline ?? null);
    setActionError(null);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setIsEditing(false);
    setActionError(null);
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
      queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
    ]);
  };

  const handleCreateTask = async () => {
    if (createBusy) return;
    setCreateError(null);
    if (!createTitle.trim()) {
      setCreateError('Task title is required.');
      return;
    }
    setCreateBusy(true);
    try {
      const durationNum = createDuration.trim() ? parseInt(createDuration.trim(), 10) : undefined;
      await apiRequest('/api/v1/tasks', {
        method: 'POST',
        body: {
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          priority: createPriority,
          estimatedDurationMinutes: isNaN(durationNum as number) ? undefined : durationNum,
          projectId: createProjectId || null,
          deadline: createDeadline || null,
        },
      });
      setCreateTitle('');
      setCreateDescription('');
      setCreatePriority('medium');
      setCreateDuration('25');
      setCreateProjectId(null);
      setCreateDeadline(null);
      setShowCreate(false);
      await refreshAll();
    } catch (e) {
      setCreateError(
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Unable to save task. Please try again.',
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    if (actionBusy) return;
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    setActionBusy(true);
    try {
      await apiRequest(`/api/v1/tasks/${task._id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      await refreshAll();
      if (selectedTask?._id === task._id) {
        setSelectedTask({ ...selectedTask, status: nextStatus });
        setEditStatus(nextStatus);
      }
    } catch (e) {
      Alert.alert(
        'Status Update Failed',
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Please try again.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedTask || actionBusy) return;
    setActionError(null);
    if (!editTitle.trim()) {
      setActionError('Task title is required.');
      return;
    }
    setActionBusy(true);
    try {
      const durationNum = editDuration.trim() ? parseInt(editDuration.trim(), 10) : null;
      const updated = await apiRequest<Task>(`/api/v1/tasks/${selectedTask._id}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          priority: editPriority,
          estimatedDurationMinutes: isNaN(durationNum as number) ? null : durationNum,
          projectId: editProjectId || null,
          status: editStatus,
          deadline: editDeadline || null,
        },
      });
      setSelectedTask(updated);
      setIsEditing(false);
      await refreshAll();
    } catch (e) {
      setActionError(
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Unable to update task. Please try again.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            try {
              await apiRequest(`/api/v1/tasks/${task._id}`, {
                method: 'DELETE',
              });
              closeTaskModal();
              await refreshAll();
            } catch (e) {
              Alert.alert(
                'Delete Failed',
                isNetworkError(e)
                  ? 'Connection required. This action needs an internet connection.'
                  : e instanceof Error
                  ? e.message
                  : 'Unable to delete task.',
              );
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  };

  const isOverdue = (task: Task) => {
    if (!task.deadline || task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.deadline).getTime() < Date.now();
  };

  return (
    <AppScreen>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={styles.title}>My Tasks</Text>
          <Text style={styles.subtitle}>Stay organized. Get things done.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => setShowCreate(!showCreate)}>
          <Text style={styles.buttonText}>{showCreate ? '✕ Close' : '＋ Add task'}</Text>
        </Pressable>
      </View>

      {/* Create Task Collapsible Card */}
      {showCreate ? (
        <View style={styles.card}>
          <Text style={styles.label}>New Task</Text>
          <TextInput
            value={createTitle}
            onChangeText={setCreateTitle}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12, marginBottom: 4 }]}>Description (Optional)</Text>
          <TextInput
            value={createDescription}
            onChangeText={setCreateDescription}
            placeholder="Key notes, context, or requirements"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={2}
            style={[styles.input, { minHeight: 46 }]}
          />

          <Text style={[styles.label, { marginTop: 12, marginBottom: 4 }]}>Priority</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
              const isSelected = createPriority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setCreatePriority(p)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: isSelected
                      ? p === 'urgent'
                        ? 'rgba(255,80,80,0.25)'
                        : p === 'high'
                        ? 'rgba(255,165,0,0.25)'
                        : colors.violet
                      : colors.surface2,
                    borderWidth: 1,
                    borderColor: isSelected
                      ? p === 'urgent'
                        ? colors.red
                        : p === 'high'
                        ? '#ffa94d'
                        : colors.violetSoft
                      : colors.border,
                    alignItems: 'center',
                  }}>
                  <Text
                    style={{
                      color: isSelected ? '#fff' : colors.muted,
                      fontSize: 11,
                      fontWeight: isSelected ? '700' : '500',
                      textTransform: 'capitalize',
                    }}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 12, marginBottom: 4 }]}>Estimated Duration (Minutes)</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {['15', '25', '45', '60'].map((mins) => {
              const isSelected = createDuration === mins;
              return (
                <Pressable
                  key={mins}
                  onPress={() => setCreateDuration(mins)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: isSelected ? colors.violet : colors.surface2,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.violetSoft : colors.border,
                  }}>
                  <Text style={{ color: isSelected ? '#fff' : colors.muted, fontSize: 11, fontWeight: '700' }}>
                    {mins}m
                  </Text>
                </Pressable>
              );
            })}
            <TextInput
              value={createDuration}
              onChangeText={setCreateDuration}
              placeholder="mins"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, paddingVertical: 4, paddingHorizontal: 8, fontSize: 12, marginTop: 0 }]}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12, marginBottom: 4 }]}>Project (Optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => setCreateProjectId(null)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: createProjectId === null ? colors.violet : colors.surface2,
                  borderWidth: 1,
                  borderColor: createProjectId === null ? colors.violetSoft : colors.border,
                }}>
                <Text
                  style={{
                    color: createProjectId === null ? '#fff' : colors.muted,
                    fontSize: 12,
                    fontWeight: createProjectId === null ? '700' : '500',
                  }}>
                  None (Standalone)
                </Text>
              </Pressable>
              {activeProjects.map((proj) => {
                const isSelected = createProjectId === proj._id;
                return (
                  <Pressable
                    key={proj._id}
                    onPress={() => setCreateProjectId(proj._id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: isSelected ? colors.violet : colors.surface2,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.violetSoft : colors.border,
                    }}>
                    <Text
                      style={{
                        color: isSelected ? '#fff' : colors.muted,
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                      }}>
                      📁 {proj.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={[styles.label, { marginTop: 6, marginBottom: 4 }]}>Deadline</Text>
          <Pressable
            onPress={() => setCreatePickerOpen(true)}
            style={({ pressed }) => [
              styles.input,
              {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 14,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={{ color: createDeadline ? colors.text : colors.muted, fontSize: 14 }}>
              {createDeadline ? `📅 ${formatHumanDateTime(createDeadline)}` : '📅 Set deadline (optional)'}
            </Text>
            {createDeadline ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setCreateDeadline(null);
                }}
                style={{ paddingHorizontal: 6 }}>
                <Text style={{ color: colors.red, fontSize: 12, fontWeight: '700' }}>✕ Clear</Text>
              </Pressable>
            ) : (
              <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>Select ›</Text>
            )}
          </Pressable>

          <DateTimePickerModal
            visible={createPickerOpen}
            value={createDeadline}
            onConfirm={(iso) => setCreateDeadline(iso)}
            onClear={() => setCreateDeadline(null)}
            onClose={() => setCreatePickerOpen(false)}
          />

          {createError ? <Text style={{ color: colors.red, marginTop: 10 }}>{createError}</Text> : null}
          <Pressable
            disabled={createBusy}
            style={[styles.button, { marginTop: 14, opacity: createBusy ? 0.6 : 1 }]}
            onPress={handleCreateTask}>
            <Text style={styles.buttonText}>{createBusy ? 'Saving…' : 'Save task'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Task List and Filter Counters */}
      <QueryState query={query}>
        {(tasks) => {
          const filteredTasks = tasks.filter((t) => {
            if (activeFilter === 'all') return true;
            return t.status === activeFilter;
          });

          return (
            <>
              {/* Filter Tabs */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                {[
                  ['all', 'All', tasks.length],
                  ['todo', 'To do', tasks.filter((t) => t.status === 'todo').length],
                  ['in_progress', 'Active', tasks.filter((t) => t.status === 'in_progress').length],
                  ['completed', 'Done', tasks.filter((t) => t.status === 'completed').length],
                ].map(([key, label, count]) => {
                  const isSelected = activeFilter === key;
                  return (
                    <Pressable
                      key={String(key)}
                      onPress={() => setActiveFilter(key as any)}
                      style={[
                        styles.card,
                        {
                          flex: 1,
                          marginTop: 0,
                          padding: 10,
                          borderColor: isSelected ? colors.violet : colors.border,
                          backgroundColor: isSelected ? colors.surface2 : colors.surface,
                        },
                      ]}>
                      <Text style={{ color: isSelected ? colors.violetSoft : colors.muted, fontSize: 11, fontWeight: isSelected ? '700' : '400' }}>
                        {label}
                      </Text>
                      <Text style={[styles.title, { fontSize: 20, marginTop: 6, color: isSelected ? colors.text : colors.muted }]}>
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.body, { fontWeight: '800', marginTop: 24, marginBottom: 4 }]}>
                Task list ({filteredTasks.length})
              </Text>

              {/* Empty State */}
              {filteredTasks.length === 0 ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                  <Text style={[styles.body, { fontWeight: '700' }]}>No tasks found</Text>
                  <Text style={[styles.muted, { marginTop: 4, textAlign: 'center', maxWidth: 260 }]}>
                    {activeFilter === 'all'
                      ? 'You have no tasks yet. Add one above to kick off your planning.'
                      : `No tasks in the "${activeFilter.replace('_', ' ')}" state.`}
                  </Text>
                </View>
              ) : null}

              {/* Task Cards */}
              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredTasks.map((task) => {
                  const overdue = isOverdue(task);
                  const isCompleted = task.status === 'completed';

                  return (
                    <Pressable
                      key={task._id}
                      onPress={() => openTaskDetails(task)}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          opacity: pressed ? 0.85 : 1,
                          borderColor: overdue ? colors.red : isCompleted ? colors.border : colors.border,
                        },
                      ]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Interactive Checkbox */}
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isCompleted }}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(task);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            borderWidth: 2,
                            borderColor: isCompleted ? colors.green : overdue ? colors.red : colors.violet,
                            backgroundColor: isCompleted ? colors.green : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}>
                          {isCompleted ? (
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text>
                          ) : null}
                        </Pressable>

                        {/* Title and Badge */}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.body,
                              {
                                fontWeight: '700',
                                textDecorationLine: isCompleted ? 'line-through' : 'none',
                                color: isCompleted ? colors.muted : colors.text,
                              },
                            ]}>
                            {task.title}
                          </Text>

                          {task.description ? (
                            <Text
                              style={[styles.muted, { fontSize: 12, marginTop: 2 }]}
                              numberOfLines={1}>
                              {task.description}
                            </Text>
                          ) : null}

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                            {/* Priority badge */}
                            {task.priority ? (
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor:
                                    task.priority === 'urgent'
                                      ? 'rgba(255,80,80,0.18)'
                                      : task.priority === 'high'
                                      ? 'rgba(255,165,0,0.18)'
                                      : colors.surface2,
                                  borderWidth: 1,
                                  borderColor:
                                    task.priority === 'urgent'
                                      ? colors.red
                                      : task.priority === 'high'
                                      ? '#ffa94d'
                                      : colors.border,
                                }}>
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color:
                                      task.priority === 'urgent'
                                        ? colors.red
                                        : task.priority === 'high'
                                        ? '#ffa94d'
                                        : colors.violetSoft,
                                    textTransform: 'capitalize',
                                  }}>
                                  {task.priority === 'urgent' ? '⚡ Urgent' : task.priority === 'high' ? '⚡ High' : task.priority}
                                </Text>
                              </View>
                            ) : null}

                            {/* Estimated Duration badge */}
                            {task.estimatedDurationMinutes ? (
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: colors.surface2,
                                }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted }}>
                                  ⏱ {task.estimatedDurationMinutes}m
                                </Text>
                              </View>
                            ) : null}

                            {/* Status badge */}
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 6,
                                backgroundColor: isCompleted ? 'rgba(86,211,154,0.15)' : colors.surface2,
                              }}>
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '700',
                                  color: isCompleted ? colors.green : colors.violetSoft,
                                  textTransform: 'capitalize',
                                }}>
                                {task.status.replace('_', ' ')}
                              </Text>
                            </View>

                            {/* Deadline badge */}
                            {task.deadline ? (
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: overdue ? 'rgba(255,111,125,0.15)' : colors.surface2,
                                }}>
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: overdue ? colors.red : colors.muted,
                                  }}>
                                  {overdue ? '⚠️ Overdue: ' : '📅 '}
                                  {formatHumanDateTime(task.deadline)}
                                </Text>
                              </View>
                            ) : null}

                              {/* Project badge */}
                              {task.projectId ? (() => {
                                const proj = allProjects.find((p) => p._id === task.projectId);
                                if (!proj) return null;
                                return (
                                  <View
                                    key={proj._id}
                                    style={{
                                      paddingHorizontal: 6,
                                      paddingVertical: 2,
                                      borderRadius: 6,
                                      backgroundColor: colors.surface2,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}>
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        fontWeight: '600',
                                        color: proj.status === 'archived' ? colors.muted : colors.violetSoft,
                                      }}>
                                      📁 {proj.title}{proj.status === 'archived' ? ' (Archived)' : ''}
                                    </Text>
                                  </View>
                                );
                              })() : null}
                            </View>
                          </View>

                        {/* Arrow hint */}
                        <Text style={{ color: colors.muted, fontSize: 18, marginLeft: 8 }}>›</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          );
        }}
      </QueryState>

      {/* Task Details & Edit Modal */}
      <Modal
        visible={selectedTask !== null}
        transparent
        animationType="slide"
        onRequestClose={closeTaskModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[styles.card, { width: '100%', maxWidth: 390, padding: 20, backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.title, { fontSize: 19 }]}>{isEditing ? 'Edit Task' : 'Task Details'}</Text>
              <Pressable onPress={closeTaskModal} style={{ padding: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            {selectedTask ? (
              isEditing ? (
                /* Edit Mode */
                <View>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Task title"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { marginTop: 6, marginBottom: 12 }]}
                  />

                  <Text style={styles.label}>Description (Optional)</Text>
                  <TextInput
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Context or notes"
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={2}
                    style={[styles.input, { marginTop: 6, marginBottom: 12, minHeight: 46 }]}
                  />

                  <Text style={styles.label}>Priority</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 12 }}>
                    {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                      const isSelected = editPriority === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setEditPriority(p)}
                          style={{
                            flex: 1,
                            paddingVertical: 7,
                            borderRadius: 8,
                            backgroundColor: isSelected
                              ? p === 'urgent'
                                ? 'rgba(255,80,80,0.25)'
                                : p === 'high'
                                ? 'rgba(255,165,0,0.25)'
                                : colors.violet
                              : colors.surface2,
                            borderWidth: 1,
                            borderColor: isSelected
                              ? p === 'urgent'
                                ? colors.red
                                : p === 'high'
                                ? '#ffa94d'
                                : colors.violetSoft
                              : colors.border,
                            alignItems: 'center',
                          }}>
                          <Text
                            style={{
                              color: isSelected ? '#fff' : colors.muted,
                              fontSize: 11,
                              fontWeight: isSelected ? '700' : '500',
                              textTransform: 'capitalize',
                            }}>
                            {p}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Estimated Duration (Minutes)</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 12 }}>
                    {['15', '25', '45', '60'].map((mins) => {
                      const isSelected = editDuration === mins;
                      return (
                        <Pressable
                          key={mins}
                          onPress={() => setEditDuration(mins)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: isSelected ? colors.violet : colors.surface2,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.violetSoft : colors.border,
                          }}>
                          <Text style={{ color: isSelected ? '#fff' : colors.muted, fontSize: 11, fontWeight: '700' }}>
                            {mins}m
                          </Text>
                        </Pressable>
                      );
                    })}
                    <TextInput
                      value={editDuration}
                      onChangeText={setEditDuration}
                      placeholder="mins"
                      placeholderTextColor={colors.muted}
                      keyboardType="numeric"
                      style={[styles.input, { flex: 1, paddingVertical: 4, paddingHorizontal: 8, fontSize: 12, marginTop: 0 }]}
                    />
                  </View>

                  <Text style={styles.label}>Project (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        onPress={() => setEditProjectId(null)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: editProjectId === null ? colors.violet : colors.surface2,
                          borderWidth: 1,
                          borderColor: editProjectId === null ? colors.violetSoft : colors.border,
                        }}>
                        <Text
                          style={{
                            color: editProjectId === null ? '#fff' : colors.muted,
                            fontSize: 12,
                            fontWeight: editProjectId === null ? '700' : '500',
                          }}>
                          None (Standalone)
                        </Text>
                      </Pressable>
                      {activeProjects.map((proj) => {
                        const isSelected = editProjectId === proj._id;
                        return (
                          <Pressable
                            key={proj._id}
                            onPress={() => setEditProjectId(proj._id)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: isSelected ? colors.violet : colors.surface2,
                              borderWidth: 1,
                              borderColor: isSelected ? colors.violetSoft : colors.border,
                            }}>
                            <Text
                              style={{
                                color: isSelected ? '#fff' : colors.muted,
                                fontSize: 12,
                                fontWeight: isSelected ? '700' : '500',
                              }}>
                              📁 {proj.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <Text style={styles.label}>Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 14 }}>
                    {(['todo', 'in_progress', 'completed', 'cancelled'] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => setEditStatus(st)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: editStatus === st ? colors.violet : colors.surface2,
                          borderWidth: 1,
                          borderColor: editStatus === st ? colors.violetSoft : colors.border,
                        }}>
                        <Text
                          style={{
                            color: editStatus === st ? '#fff' : colors.muted,
                            fontSize: 12,
                            fontWeight: '700',
                            textTransform: 'capitalize',
                          }}>
                          {st.replace('_', ' ')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>Deadline</Text>
                  <Pressable
                    onPress={() => setEditPickerOpen(true)}
                    style={({ pressed }) => [
                      styles.input,
                      {
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 14,
                        marginTop: 6,
                        marginBottom: 16,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <Text style={{ color: editDeadline ? colors.text : colors.muted, fontSize: 14 }}>
                      {editDeadline ? `📅 ${formatHumanDateTime(editDeadline)}` : '📅 Set deadline (optional)'}
                    </Text>
                    {editDeadline ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setEditDeadline(null);
                        }}
                        style={{ paddingHorizontal: 6 }}>
                        <Text style={{ color: colors.red, fontSize: 12, fontWeight: '700' }}>✕ Clear</Text>
                      </Pressable>
                    ) : (
                      <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>Select ›</Text>
                    )}
                  </Pressable>

                  <DateTimePickerModal
                    visible={editPickerOpen}
                    value={editDeadline}
                    onConfirm={(iso) => setEditDeadline(iso)}
                    onClear={() => setEditDeadline(null)}
                    onClose={() => setEditPickerOpen(false)}
                  />

                  {actionError ? <Text style={{ color: colors.red, marginBottom: 12 }}>{actionError}</Text> : null}

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => setIsEditing(false)}
                      disabled={actionBusy}
                      style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
                      <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveEdit}
                      disabled={actionBusy}
                      style={[styles.button, { flex: 1, opacity: actionBusy ? 0.6 : 1 }]}>
                      <Text style={styles.buttonText}>{actionBusy ? 'Saving…' : 'Save Changes'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* View Mode */
                <View>
                  <Text style={[styles.title, { fontSize: 21, marginBottom: 4 }]}>{selectedTask.title}</Text>

                  {selectedTask.description ? (
                    <Text style={[styles.body, { color: colors.muted, fontSize: 13, marginBottom: 10 }]}>
                      {selectedTask.description}
                    </Text>
                  ) : null}

                  <View style={{ marginVertical: 8, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={styles.muted}>Priority</Text>
                      <Text style={{
                        color: selectedTask.priority === 'urgent' ? colors.red : selectedTask.priority === 'high' ? '#ffa94d' : colors.violetSoft,
                        fontWeight: '700',
                        textTransform: 'capitalize',
                      }}>
                        {selectedTask.priority === 'urgent' ? '⚡ Urgent' : selectedTask.priority === 'high' ? '⚡ High' : (selectedTask.priority || 'Medium')}
                      </Text>
                    </View>

                    {selectedTask.estimatedDurationMinutes ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.muted}>Estimated Duration</Text>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>
                          ⏱ {selectedTask.estimatedDurationMinutes} minutes
                        </Text>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={styles.muted}>Status</Text>
                      <Text style={{ color: selectedTask.status === 'completed' ? colors.green : colors.violetSoft, fontWeight: '700', textTransform: 'capitalize' }}>
                        {selectedTask.status.replace('_', ' ')}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={styles.muted}>Project</Text>
                      {selectedTask.projectId ? (() => {
                        const proj = allProjects.find((p) => p._id === selectedTask.projectId);
                        return (
                          <Text style={{ color: colors.violetSoft, fontWeight: '600' }}>
                            📁 {proj ? proj.title : selectedTask.projectId}{proj?.status === 'archived' ? ' (Archived)' : ''}
                          </Text>
                        );
                      })() : (
                        <Text style={{ color: colors.muted, fontStyle: 'italic' }}>None (Standalone)</Text>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={styles.muted}>Deadline</Text>
                      <Text style={{ color: isOverdue(selectedTask) ? colors.red : colors.text, fontWeight: '600' }}>
                        {selectedTask.deadline ? formatHumanDateTime(selectedTask.deadline) : 'No deadline set'}
                      </Text>
                    </View>

                    {selectedTask.createdAt ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.muted}>Created</Text>
                        <Text style={[styles.muted, { fontSize: 12 }]}>
                          {formatHumanDateTime(selectedTask.createdAt)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    {/* Mark Complete / Incomplete */}
                    <Pressable
                      onPress={() => handleToggleComplete(selectedTask)}
                      disabled={actionBusy}
                      style={[
                        styles.button,
                        {
                          flex: 1,
                          backgroundColor: selectedTask.status === 'completed' ? colors.surface2 : colors.green,
                          borderWidth: selectedTask.status === 'completed' ? 1 : 0,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Text style={{ color: selectedTask.status === 'completed' ? colors.muted : '#fff', fontWeight: '800' }}>
                        {selectedTask.status === 'completed' ? 'Reopen' : '✓ Mark Complete'}
                      </Text>
                    </Pressable>

                    {/* Edit */}
                    <Pressable
                      onPress={() => setIsEditing(true)}
                      style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet }]}>
                      <Text style={{ color: colors.violetSoft, fontWeight: '800' }}>Edit</Text>
                    </Pressable>
                  </View>

                  {/* Delete Task */}
                  <Pressable
                    onPress={() => handleDeleteTask(selectedTask)}
                    disabled={actionBusy}
                    style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}>
                    <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>Delete Task</Text>
                  </Pressable>
                </View>
              )
            ) : null}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}
