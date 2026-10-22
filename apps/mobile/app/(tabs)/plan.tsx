import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, isNetworkError } from '../../lib/api-client';
import { useGoals, useProjects } from '../../lib/queries';
import { colors, styles } from '../../lib/theme';
import { AppScreen } from '../../components/AppScreen';
import { QueryState } from '../../components/QueryState';
import { formatHumanDateTime } from '../../components/DateTimePickerModal';
import type { Goal, Project } from '../../lib/types';

export default function Plan() {
  const goalsQuery = useGoals();
  const projectsQuery = useProjects();
  const queryClient = useQueryClient();

  // Top Section Selector: 'goals' | 'projects'
  const [activeSection, setActiveSection] = useState<'goals' | 'projects'>('goals');

  // Create Goal Form State
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected Goal / Details & Edit Modal State
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'archived'>('active');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Goal Filter State
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  // Projects State
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createProjectTitle, setCreateProjectTitle] = useState('');
  const [createProjectGoalIds, setCreateProjectGoalIds] = useState<string[]>([]);
  const [createProjectBusy, setCreateProjectBusy] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectTitle, setEditProjectTitle] = useState('');
  const [editProjectGoalIds, setEditProjectGoalIds] = useState<string[]>([]);
  const [editProjectStatus, setEditProjectStatus] = useState<'active' | 'completed' | 'archived'>('active');
  const [projectActionBusy, setProjectActionBusy] = useState(false);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  const openGoalDetails = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsEditing(false);
    setEditTitle(goal.title);
    setEditDescription(goal.description ?? '');
    setEditStatus(goal.status);
    setActionError(null);
  };

  const closeGoalModal = () => {
    setSelectedGoal(null);
    setIsEditing(false);
    setActionError(null);
  };

  const openProjectDetails = (project: Project) => {
    setSelectedProject(project);
    setIsEditingProject(false);
    setEditProjectTitle(project.title);
    setEditProjectGoalIds(project.goalIds ?? []);
    setEditProjectStatus(project.status);
    setProjectActionError(null);
  };

  const closeProjectModal = () => {
    setSelectedProject(null);
    setIsEditingProject(false);
    setProjectActionError(null);
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
      queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
    ]);
  };

  const handleCreateGoal = async () => {
    if (createBusy) return;
    setCreateError(null);
    if (!createTitle.trim()) {
      setCreateError('Goal title is required.');
      return;
    }
    setCreateBusy(true);
    try {
      await apiRequest('/api/v1/goals', {
        method: 'POST',
        body: {
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
        },
      });
      setCreateTitle('');
      setCreateDescription('');
      setShowCreate(false);
      await refreshAll();
    } catch (e) {
      setCreateError(
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Unable to save goal. Please try again.',
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const handleToggleComplete = async (goal: Goal) => {
    if (actionBusy) return;
    const nextStatus = goal.status === 'completed' ? 'active' : 'completed';
    setActionBusy(true);
    try {
      await apiRequest(`/api/v1/goals/${goal._id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      await refreshAll();
      if (selectedGoal?._id === goal._id) {
        setSelectedGoal({ ...selectedGoal, status: nextStatus });
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
    if (!selectedGoal || actionBusy) return;
    setActionError(null);
    if (!editTitle.trim()) {
      setActionError('Goal title is required.');
      return;
    }
    setActionBusy(true);
    try {
      const updated = await apiRequest<Goal>(`/api/v1/goals/${selectedGoal._id}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          description: editDescription.trim() || '',
          status: editStatus,
        },
      });
      setSelectedGoal(updated);
      setIsEditing(false);
      await refreshAll();
    } catch (e) {
      setActionError(
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Unable to update goal. Please try again.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleArchiveGoal = (goal: Goal) => {
    Alert.alert(
      'Archive Goal',
      `Are you sure you want to archive "${goal.title}"? It will no longer be considered in daily planning or recommendations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            try {
              await apiRequest(`/api/v1/goals/${goal._id}`, {
                method: 'DELETE',
              });
              closeGoalModal();
              await refreshAll();
            } catch (e) {
              Alert.alert(
                'Archive Failed',
                isNetworkError(e)
                  ? 'Connection required. This action needs an internet connection.'
                  : e instanceof Error
                  ? e.message
                  : 'Unable to archive goal.',
              );
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  };

  // Project Handlers
  const handleCreateProject = async () => {
    if (createProjectBusy) return;
    setCreateProjectError(null);
    if (!createProjectTitle.trim()) {
      setCreateProjectError('Project title is required.');
      return;
    }
    setCreateProjectBusy(true);
    try {
      await apiRequest('/api/v1/projects', {
        method: 'POST',
        body: {
          title: createProjectTitle.trim(),
          goalIds: createProjectGoalIds,
        },
      });
      setCreateProjectTitle('');
      setCreateProjectGoalIds([]);
      setShowCreateProject(false);
      await refreshAll();
    } catch (e) {
      setCreateProjectError(
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Unable to save project. Please try again.',
      );
    } finally {
      setCreateProjectBusy(false);
    }
  };

  const handleToggleCompleteProject = async (project: Project) => {
    if (projectActionBusy) return;
    const nextStatus = project.status === 'completed' ? 'active' : 'completed';
    setProjectActionBusy(true);
    try {
      await apiRequest(`/api/v1/projects/${project._id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      await refreshAll();
      if (selectedProject?._id === project._id) {
        setSelectedProject({ ...selectedProject, status: nextStatus });
        setEditProjectStatus(nextStatus);
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
      setProjectActionBusy(false);
    }
  };

  const handleSaveEditProject = async () => {
    if (!selectedProject || projectActionBusy) return;
    setProjectActionError(null);
    if (!editProjectTitle.trim()) {
      setProjectActionError('Project title is required.');
      return;
    }
    setProjectActionBusy(true);
    try {
      const updated = await apiRequest<Project>(`/api/v1/projects/${selectedProject._id}`, {
        method: 'PATCH',
        body: {
          title: editProjectTitle.trim(),
          goalIds: editProjectGoalIds,
          status: editProjectStatus,
        },
      });
      setSelectedProject(updated);
      setIsEditingProject(false);
      await refreshAll();
    } catch (e) {
      setProjectActionError(
        isNetworkError(e)
          ? 'Connection required. This action needs an internet connection.'
          : e instanceof Error
          ? e.message
          : 'Unable to update project. Please try again.',
      );
    } finally {
      setProjectActionBusy(false);
    }
  };

  const handleArchiveProject = (project: Project) => {
    Alert.alert(
      'Archive Project',
      `Are you sure you want to archive "${project.title}"? Associated tasks will remain, but the project will be archived.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setProjectActionBusy(true);
            try {
              await apiRequest(`/api/v1/projects/${project._id}`, {
                method: 'DELETE',
              });
              closeProjectModal();
              await refreshAll();
            } catch (e) {
              Alert.alert(
                'Archive Failed',
                isNetworkError(e)
                  ? 'Connection required. This action needs an internet connection.'
                  : e instanceof Error
                  ? e.message
                  : 'Unable to archive project.',
              );
            } finally {
              setProjectActionBusy(false);
            }
          },
        },
      ],
    );
  };

  const allGoals = goalsQuery.data ?? [];

  return (
    <AppScreen>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, paddingRight: 6 }}>
          <Text style={styles.title}>My Plan</Text>
          <Text style={styles.subtitle}>Organize your goals, projects, and roadmaps.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={[styles.button, { paddingHorizontal: 12, paddingVertical: 10 }]}
          onPress={() => {
            if (activeSection === 'goals') {
              setShowCreate(!showCreate);
            } else {
              setShowCreateProject(!showCreateProject);
            }
          }}>
          <Text style={styles.buttonText}>
            {activeSection === 'goals'
              ? showCreate
                ? '✕ Close'
                : '＋ New Goal'
              : showCreateProject
              ? '✕ Close'
              : '＋ New Project'}
          </Text>
        </Pressable>
      </View>


      {/* Section Switcher: Goals vs Projects */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Pressable
          onPress={() => setActiveSection('goals')}
          style={{
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 10,
            backgroundColor: activeSection === 'goals' ? colors.violet : colors.surface2,
            borderWidth: 1,
            borderColor: activeSection === 'goals' ? colors.violetSoft : colors.border,
          }}>
          <Text
            style={{
              color: activeSection === 'goals' ? '#fff' : colors.muted,
              fontWeight: '700',
              fontSize: 14,
            }}>
            🎯 Goals
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveSection('projects')}
          style={{
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 10,
            backgroundColor: activeSection === 'projects' ? colors.violet : colors.surface2,
            borderWidth: 1,
            borderColor: activeSection === 'projects' ? colors.violetSoft : colors.border,
          }}>
          <Text
            style={{
              color: activeSection === 'projects' ? '#fff' : colors.muted,
              fontWeight: '700',
              fontSize: 14,
            }}>
            📁 Projects
          </Text>
        </Pressable>
      </View>

      {/* SECTION 1: GOALS */}
      {activeSection === 'goals' ? (
        <>
          {/* Create Goal Collapsible Card */}
          {showCreate ? (
            <View style={styles.card}>
              <Text style={styles.label}>New Goal</Text>
              <TextInput
                value={createTitle}
                onChangeText={setCreateTitle}
                placeholder="Goal title (e.g. Master Machine Learning)"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={createDescription}
                onChangeText={setCreateDescription}
                placeholder="What does success look like?"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={2}
                style={[styles.input, { minHeight: 60 }]}
              />
              {createError ? <Text style={{ color: colors.red, marginTop: 10 }}>{createError}</Text> : null}
              <Pressable
                disabled={createBusy}
                style={[styles.button, { marginTop: 14, opacity: createBusy ? 0.6 : 1 }]}
                onPress={handleCreateGoal}>
                <Text style={styles.buttonText}>{createBusy ? 'Saving…' : 'Save goal'}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Goals Query State & Filter Counters */}
          <QueryState query={goalsQuery}>
            {(goals) => {
              const filteredGoals = goals.filter((g) => {
                if (activeFilter === 'all') return true;
                return g.status === activeFilter;
              });

              return (
                <>
                  {/* Filter Tabs */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                    {[
                      ['all', 'All', goals.length],
                      ['active', 'Active', goals.filter((g) => g.status === 'active').length],
                      ['completed', 'Done', goals.filter((g) => g.status === 'completed').length],
                      ['archived', 'Archived', goals.filter((g) => g.status === 'archived').length],
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
                          <Text
                            style={{
                              color: isSelected ? colors.violetSoft : colors.muted,
                              fontSize: 11,
                              fontWeight: isSelected ? '700' : '400',
                            }}>
                            {label}
                          </Text>
                          <Text
                            style={[
                              styles.title,
                              {
                                fontSize: 20,
                                marginTop: 6,
                                color: isSelected ? colors.text : colors.muted,
                              },
                            ]}>
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.body, { fontWeight: '800', marginTop: 24, marginBottom: 4 }]}>
                    Goals list ({filteredGoals.length})
                  </Text>

                  {/* Empty State */}
                  {filteredGoals.length === 0 ? (
                    <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                      <Text style={{ fontSize: 32, marginBottom: 8 }}>🎯</Text>
                      <Text style={[styles.body, { fontWeight: '700' }]}>No goals found</Text>
                      <Text style={[styles.muted, { marginTop: 4, textAlign: 'center', maxWidth: 260 }]}>
                        {activeFilter === 'all'
                          ? 'You have no goals set up. Add your first goal above to drive decision recommendations.'
                          : `No goals in the "${activeFilter}" state.`}
                      </Text>
                    </View>
                  ) : null}

                  {/* Goals List */}
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {filteredGoals.map((goal) => {
                      const isCompleted = goal.status === 'completed';
                      const isArchived = goal.status === 'archived';

                      return (
                        <Pressable
                          key={goal._id}
                          onPress={() => openGoalDetails(goal)}
                          style={({ pressed }) => [
                            styles.card,
                            {
                              opacity: pressed ? 0.85 : 1,
                              borderColor: isCompleted ? colors.border : colors.border,
                            },
                          ]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Interactive Status Indicator / Toggle */}
                            <Pressable
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: isCompleted }}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleToggleComplete(goal);
                              }}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                borderWidth: 2,
                                borderColor: isCompleted ? colors.green : isArchived ? colors.muted : colors.violet,
                                backgroundColor: isCompleted ? colors.green : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                              }}>
                              {isCompleted ? (
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text>
                              ) : isArchived ? (
                                <Text style={{ color: colors.muted, fontSize: 12 }}>✕</Text>
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
                                    color: isCompleted || isArchived ? colors.muted : colors.text,
                                  },
                                ]}>
                                {goal.title}
                              </Text>

                              {goal.description ? (
                                <Text
                                  numberOfLines={2}
                                  style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>
                                  {goal.description}
                                </Text>
                              ) : null}

                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                                {/* Status badge */}
                                <View
                                  style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    backgroundColor: isCompleted
                                      ? 'rgba(86,211,154,0.15)'
                                      : isArchived
                                      ? 'rgba(167,161,186,0.15)'
                                      : colors.surface2,
                                  }}>
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: isCompleted
                                        ? colors.green
                                        : isArchived
                                        ? colors.muted
                                        : colors.violetSoft,
                                      textTransform: 'capitalize',
                                    }}>
                                    {goal.status}
                                  </Text>
                                </View>

                                {/* Created Date */}
                                {goal.createdAt ? (
                                  <Text style={[styles.muted, { fontSize: 11 }]}>
                                    Set {formatHumanDateTime(goal.createdAt)}
                                  </Text>
                                ) : null}
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
        </>
      ) : (
        /* SECTION 2: PROJECTS */
        <>
          {/* Create Project Collapsible Card */}
          {showCreateProject ? (
            <View style={styles.card}>
              <Text style={styles.label}>New Project</Text>
              <TextInput
                value={createProjectTitle}
                onChangeText={setCreateProjectTitle}
                placeholder="Project title (e.g. Mobile App Redesign)"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <Text style={[styles.label, { marginTop: 14, marginBottom: 4 }]}>
                Link to Goals (Optional)
              </Text>
              <Text style={[styles.muted, { fontSize: 12, marginBottom: 8 }]}>
                Select one or more active goals this project drives forward:
              </Text>

              {allGoals.filter((g) => g.status === 'active').length === 0 ? (
                <Text style={[styles.muted, { fontSize: 12, fontStyle: 'italic' }]}>
                  No active goals available. Create a goal to align this project.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {allGoals
                    .filter((g) => g.status === 'active')
                    .map((goal) => {
                      const isLinked = createProjectGoalIds.includes(goal._id);
                      return (
                        <Pressable
                          key={goal._id}
                          onPress={() => {
                            if (isLinked) {
                              setCreateProjectGoalIds(createProjectGoalIds.filter((id) => id !== goal._id));
                            } else {
                              setCreateProjectGoalIds([...createProjectGoalIds, goal._id]);
                            }
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: isLinked ? colors.violet : colors.surface2,
                            borderWidth: 1,
                            borderColor: isLinked ? colors.violetSoft : colors.border,
                          }}>
                          <Text
                            style={{
                              color: isLinked ? '#fff' : colors.muted,
                              fontSize: 12,
                              fontWeight: isLinked ? '700' : '500',
                            }}>
                            {isLinked ? '✓ ' : '+ '}
                            {goal.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              )}

              {createProjectError ? <Text style={{ color: colors.red, marginTop: 10 }}>{createProjectError}</Text> : null}
              <Pressable
                disabled={createProjectBusy}
                style={[styles.button, { marginTop: 14, opacity: createProjectBusy ? 0.6 : 1 }]}
                onPress={handleCreateProject}>
                <Text style={styles.buttonText}>{createProjectBusy ? 'Saving…' : 'Save project'}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Projects Query State & Filter Counters */}
          <QueryState query={projectsQuery}>
            {(projects) => {
              const filteredProjects = projects.filter((p) => {
                if (projectFilter === 'all') return true;
                return p.status === projectFilter;
              });

              return (
                <>
                  {/* Filter Tabs */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                    {[
                      ['all', 'All', projects.length],
                      ['active', 'Active', projects.filter((p) => p.status === 'active').length],
                      ['completed', 'Done', projects.filter((p) => p.status === 'completed').length],
                      ['archived', 'Archived', projects.filter((p) => p.status === 'archived').length],
                    ].map(([key, label, count]) => {
                      const isSelected = projectFilter === key;
                      return (
                        <Pressable
                          key={String(key)}
                          onPress={() => setProjectFilter(key as any)}
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
                          <Text
                            style={{
                              color: isSelected ? colors.violetSoft : colors.muted,
                              fontSize: 11,
                              fontWeight: isSelected ? '700' : '400',
                            }}>
                            {label}
                          </Text>
                          <Text
                            style={[
                              styles.title,
                              {
                                fontSize: 20,
                                marginTop: 6,
                                color: isSelected ? colors.text : colors.muted,
                              },
                            ]}>
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.body, { fontWeight: '800', marginTop: 24, marginBottom: 4 }]}>
                    Projects list ({filteredProjects.length})
                  </Text>

                  {/* Empty State */}
                  {filteredProjects.length === 0 ? (
                    <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                      <Text style={{ fontSize: 32, marginBottom: 8 }}>📁</Text>
                      <Text style={[styles.body, { fontWeight: '700' }]}>No projects found</Text>
                      <Text style={[styles.muted, { marginTop: 4, textAlign: 'center', maxWidth: 260 }]}>
                        {projectFilter === 'all'
                          ? 'You have no projects set up. Add your first project above to organize related tasks and connect them to goals.'
                          : `No projects in the "${projectFilter}" state.`}
                      </Text>
                    </View>
                  ) : null}

                  {/* Projects List */}
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {filteredProjects.map((project) => {
                      const isCompleted = project.status === 'completed';
                      const isArchived = project.status === 'archived';
                      const linkedGoals = (project.goalIds ?? [])
                        .map((gid) => allGoals.find((g) => g._id === gid))
                        .filter(Boolean) as Goal[];

                      return (
                        <Pressable
                          key={project._id}
                          onPress={() => openProjectDetails(project)}
                          style={({ pressed }) => [
                            styles.card,
                            {
                              opacity: pressed ? 0.85 : 1,
                              borderColor: isCompleted ? colors.border : colors.border,
                            },
                          ]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Interactive Status Indicator / Toggle */}
                            <Pressable
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: isCompleted }}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleToggleCompleteProject(project);
                              }}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                borderWidth: 2,
                                borderColor: isCompleted ? colors.green : isArchived ? colors.muted : colors.violet,
                                backgroundColor: isCompleted ? colors.green : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                              }}>
                              {isCompleted ? (
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text>
                              ) : isArchived ? (
                                <Text style={{ color: colors.muted, fontSize: 12 }}>✕</Text>
                              ) : null}
                            </Pressable>

                            {/* Title, Goals and Badge */}
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.body,
                                  {
                                    fontWeight: '700',
                                    textDecorationLine: isCompleted ? 'line-through' : 'none',
                                    color: isCompleted || isArchived ? colors.muted : colors.text,
                                  },
                                ]}>
                                {project.title}
                              </Text>

                              {/* Linked Goals Badges */}
                              {linkedGoals.length > 0 ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {linkedGoals.map((g) => (
                                    <View
                                      key={g._id}
                                      style={{
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: colors.surface2,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                      }}>
                                      <Text style={{ fontSize: 10, color: colors.violetSoft }}>
                                        🎯 {g.title}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}

                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                                {/* Status badge */}
                                <View
                                  style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    backgroundColor: isCompleted
                                      ? 'rgba(86,211,154,0.15)'
                                      : isArchived
                                      ? 'rgba(167,161,186,0.15)'
                                      : colors.surface2,
                                  }}>
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: isCompleted
                                        ? colors.green
                                        : isArchived
                                        ? colors.muted
                                        : colors.violetSoft,
                                      textTransform: 'capitalize',
                                    }}>
                                    {project.status}
                                  </Text>
                                </View>

                                {/* Goals count */}
                                <Text style={[styles.muted, { fontSize: 11 }]}>
                                  {project.goalIds?.length ?? 0} {project.goalIds?.length === 1 ? 'goal' : 'goals'} linked
                                </Text>
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
        </>
      )}

      {/* Goal Details & Edit Modal */}
      <Modal
        visible={selectedGoal !== null}
        transparent
        animationType="slide"
        onRequestClose={closeGoalModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[styles.card, { width: '100%', maxWidth: 390, padding: 20, backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.title, { fontSize: 19 }]}>{isEditing ? 'Edit Goal' : 'Goal Details'}</Text>
              <Pressable onPress={closeGoalModal} style={{ padding: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            {selectedGoal ? (
              isEditing ? (
                /* Edit Mode */
                <View>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Goal title"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { marginTop: 6, marginBottom: 14 }]}
                  />

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="What does success look like?"
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                    style={[styles.input, { marginTop: 6, marginBottom: 14, minHeight: 70 }]}
                  />

                  <Text style={styles.label}>Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 16 }}>
                    {(['active', 'completed', 'archived'] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => setEditStatus(st)}
                        style={{
                          paddingHorizontal: 12,
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
                          {st}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

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
                  <Text style={[styles.title, { fontSize: 21, marginBottom: 6 }]}>{selectedGoal.title}</Text>

                  <View style={{ marginVertical: 10, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={styles.muted}>Status</Text>
                      <Text style={{ color: selectedGoal.status === 'completed' ? colors.green : colors.violetSoft, fontWeight: '700', textTransform: 'capitalize' }}>
                        {selectedGoal.status}
                      </Text>
                    </View>

                    <Text style={styles.muted}>Description</Text>
                    <Text style={[styles.body, { marginTop: 4, marginBottom: 8 }]}>
                      {selectedGoal.description || 'No description provided.'}
                    </Text>

                    {selectedGoal.createdAt ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={styles.muted}>Created</Text>
                        <Text style={[styles.muted, { fontSize: 12 }]}>
                          {formatHumanDateTime(selectedGoal.createdAt)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    {/* Mark Complete / Reopen */}
                    <Pressable
                      onPress={() => handleToggleComplete(selectedGoal)}
                      disabled={actionBusy}
                      style={[
                        styles.button,
                        {
                          flex: 1,
                          backgroundColor: selectedGoal.status === 'completed' ? colors.surface2 : colors.green,
                          borderWidth: selectedGoal.status === 'completed' ? 1 : 0,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Text style={{ color: selectedGoal.status === 'completed' ? colors.muted : '#fff', fontWeight: '800' }}>
                        {selectedGoal.status === 'completed' ? 'Reopen' : '✓ Mark Complete'}
                      </Text>
                    </Pressable>

                    {/* Edit */}
                    <Pressable
                      onPress={() => setIsEditing(true)}
                      style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet }]}>
                      <Text style={{ color: colors.violetSoft, fontWeight: '800' }}>Edit</Text>
                    </Pressable>
                  </View>

                  {/* Archive Goal */}
                  {selectedGoal.status !== 'archived' ? (
                    <Pressable
                      onPress={() => handleArchiveGoal(selectedGoal)}
                      disabled={actionBusy}
                      style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}>
                      <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>Archive Goal</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Project Details & Edit Modal */}
      <Modal
        visible={selectedProject !== null}
        transparent
        animationType="slide"
        onRequestClose={closeProjectModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[styles.card, { width: '100%', maxWidth: 390, padding: 20, backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.title, { fontSize: 19 }]}>{isEditingProject ? 'Edit Project' : 'Project Details'}</Text>
              <Pressable onPress={closeProjectModal} style={{ padding: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            {selectedProject ? (
              isEditingProject ? (
                <View>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    value={editProjectTitle}
                    onChangeText={setEditProjectTitle}
                    placeholder="Project title"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { marginTop: 6, marginBottom: 14 }]}
                  />

                  <Text style={styles.label}>Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 16 }}>
                    {(['active', 'completed', 'archived'] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => setEditProjectStatus(st)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: editProjectStatus === st ? colors.violet : colors.surface2,
                          borderWidth: 1,
                          borderColor: editProjectStatus === st ? colors.violetSoft : colors.border,
                        }}>
                        <Text
                          style={{
                            color: editProjectStatus === st ? '#fff' : colors.muted,
                            fontSize: 12,
                            fontWeight: '700',
                            textTransform: 'capitalize',
                          }}>
                          {st}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>Linked Goals</Text>
                  <Text style={[styles.muted, { fontSize: 12, marginBottom: 8 }]}>
                    Toggle goals linked to this project:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {allGoals.map((goal) => {
                      const isLinked = editProjectGoalIds.includes(goal._id);
                      return (
                        <Pressable
                          key={goal._id}
                          onPress={() => {
                            if (isLinked) {
                              setEditProjectGoalIds(editProjectGoalIds.filter((id) => id !== goal._id));
                            } else {
                              setEditProjectGoalIds([...editProjectGoalIds, goal._id]);
                            }
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: isLinked ? colors.violet : colors.surface2,
                            borderWidth: 1,
                            borderColor: isLinked ? colors.violetSoft : colors.border,
                          }}>
                          <Text
                            style={{
                              color: isLinked ? '#fff' : colors.muted,
                              fontSize: 12,
                              fontWeight: isLinked ? '700' : '500',
                            }}>
                            {isLinked ? '✓ ' : '+ '}
                            {goal.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {projectActionError ? <Text style={{ color: colors.red, marginBottom: 12 }}>{projectActionError}</Text> : null}

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => setIsEditingProject(false)}
                      disabled={projectActionBusy}
                      style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
                      <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveEditProject}
                      disabled={projectActionBusy}
                      style={[styles.button, { flex: 1, opacity: projectActionBusy ? 0.6 : 1 }]}>
                      <Text style={styles.buttonText}>{projectActionBusy ? 'Saving…' : 'Save Changes'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={[styles.title, { fontSize: 21, marginBottom: 6 }]}>{selectedProject.title}</Text>

                  <View style={{ marginVertical: 10, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={styles.muted}>Status</Text>
                      <Text style={{ color: selectedProject.status === 'completed' ? colors.green : colors.violetSoft, fontWeight: '700', textTransform: 'capitalize' }}>
                        {selectedProject.status}
                      </Text>
                    </View>

                    <Text style={styles.muted}>Linked Goals ({selectedProject.goalIds?.length ?? 0})</Text>
                    <View style={{ marginTop: 6, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {(selectedProject.goalIds ?? []).length === 0 ? (
                        <Text style={[styles.muted, { fontSize: 13, fontStyle: 'italic' }]}>
                          No goals linked to this project.
                        </Text>
                      ) : (
                        (selectedProject.goalIds ?? []).map((gid) => {
                          const goal = allGoals.find((g) => g._id === gid);
                          return (
                            <View
                              key={gid}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                backgroundColor: colors.surface2,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}>
                              <Text style={{ fontSize: 12, color: colors.violetSoft }}>
                                🎯 {goal ? goal.title : gid}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>

                    {selectedProject.createdAt ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={styles.muted}>Created</Text>
                        <Text style={[styles.muted, { fontSize: 12 }]}>
                          {formatHumanDateTime(selectedProject.createdAt)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <Pressable
                      onPress={() => handleToggleCompleteProject(selectedProject)}
                      disabled={projectActionBusy}
                      style={[
                        styles.button,
                        {
                          flex: 1,
                          backgroundColor: selectedProject.status === 'completed' ? colors.surface2 : colors.green,
                          borderWidth: selectedProject.status === 'completed' ? 1 : 0,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Text style={{ color: selectedProject.status === 'completed' ? colors.muted : '#fff', fontWeight: '800' }}>
                        {selectedProject.status === 'completed' ? 'Reopen' : '✓ Mark Complete'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setIsEditingProject(true)}
                      style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.violet }]}>
                      <Text style={{ color: colors.violetSoft, fontWeight: '800' }}>Edit</Text>
                    </Pressable>
                  </View>

                  {selectedProject.status !== 'archived' ? (
                    <Pressable
                      onPress={() => handleArchiveProject(selectedProject)}
                      disabled={projectActionBusy}
                      style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}>
                      <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>Archive Project</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            ) : null}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}
