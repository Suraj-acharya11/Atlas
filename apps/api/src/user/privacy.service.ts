import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { DecisionService } from '../decision/decision.service';
import { PlanningService } from '../planning/planning.service';
import { ImportSummary, ImportUserDataDto } from './dto/import-user-data.dto';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class PrivacyService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Optional() private readonly decisions?: DecisionService,
    @Optional() private readonly planning?: PlanningService,
  ) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const id = new Types.ObjectId(userId);
    const find = (collection: string) => this.connection.collection(collection).find({ userId: id }).toArray();
    const usersCollection = this.connection.collection('users');
    const userPromise = usersCollection?.findOne
      ? usersCollection.findOne({ _id: id })
      : Promise.resolve(null);
    const [user, goals, projects, tasks, knowledge, events, missions, weeklyPlans] = await Promise.all([
      userPromise,
      find('goals'),
      find('projects'),
      find('tasks'),
      find('knowledge_relationships'),
      find('events'),
      find('missions'),
      find('weekly_plans'),
    ]);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: user ? {
        timezone: user.timezone || 'UTC',
        displayName: user.displayName || null,
        bio: user.bio || null,
        preferences: user.preferences || {},
      } : null,
      goals,
      projects,
      tasks,
      knowledge,
      events,
      plans: { missions, weeklyPlans },
    };
  }

  async importUserData(userId: string, input: ImportUserDataDto): Promise<ImportSummary> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid authenticated user ID.');
    }
    const userObjId = new Types.ObjectId(userId);

    const summary: ImportSummary = {
      imported: { goals: 0, projects: 0, tasks: 0, knowledge: 0 },
      skippedDuplicates: { goals: 0, projects: 0, tasks: 0, knowledge: 0 },
      message: '',
    };

    const goalIdMap = new Map<string, Types.ObjectId>();
    const projectIdMap = new Map<string, Types.ObjectId>();

    // Phase 1: Goals
    const rawGoals = Array.isArray(input.goals) ? input.goals : [];
    for (const item of rawGoals) {
      const cleanTitle = (item.title || item.name || '').trim();
      if (!cleanTitle) continue;

      const existing = await this.connection.collection('goals').findOne({
        userId: userObjId,
        title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') },
      });

      const originalGoalId = item._id ?? item.id;
      if (existing) {
        if (originalGoalId) goalIdMap.set(String(originalGoalId), existing._id as Types.ObjectId);
        summary.skippedDuplicates.goals++;
      } else {
        const newGoalId = new Types.ObjectId();
        if (originalGoalId) goalIdMap.set(String(originalGoalId), newGoalId);
        await this.connection.collection('goals').insertOne({
          _id: newGoalId,
          userId: userObjId,
          title: cleanTitle,
          description: (item.description || '').trim(),
          category: item.category || 'general',
          priority: item.priority || 'medium',
          status: item.status || 'active',
          ...(item.successCriteria?.length ? { successCriteria: item.successCriteria } : {}),
          ...(item.strategy?.length ? { strategy: item.strategy } : {}),
          ...(item.currentFocus?.length ? { currentFocus: item.currentFocus } : {}),
          ...(item.areas?.length ? { areas: item.areas } : {}),
          ...(item.vision ? { vision: item.vision } : {}),
          ...(item.architecture?.length ? { architecture: item.architecture } : {}),
          ...(item.focus?.length ? { focus: item.focus } : {}),
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
        });
        summary.imported.goals++;
      }
    }

    // Phase 2: Projects
    const rawProjects = Array.isArray(input.projects) ? input.projects : [];
    for (const item of rawProjects) {
      const cleanTitle = (item.title || item.name || '').trim();
      if (!cleanTitle) continue;

      const remappedGoalIds = (item.goalIds || (item.goalId ? [item.goalId] : []))
        .map((gid) => goalIdMap.get(String(gid)) ?? (Types.ObjectId.isValid(gid) ? new Types.ObjectId(gid) : null))
        .filter((id): id is Types.ObjectId => id !== null);

      const existing = await this.connection.collection('projects').findOne({
        userId: userObjId,
        title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') },
      });

      const originalProjId = item._id ?? item.id;
      if (existing) {
        if (originalProjId) projectIdMap.set(String(originalProjId), existing._id as Types.ObjectId);
        summary.skippedDuplicates.projects++;
      } else {
        const newProjectId = new Types.ObjectId();
        if (originalProjId) projectIdMap.set(String(originalProjId), newProjectId);
        await this.connection.collection('projects').insertOne({
          _id: newProjectId,
          userId: userObjId,
          title: cleanTitle,
          goalIds: remappedGoalIds,
          status: item.status || 'active',
          description: (item.description || '').trim(),
          type: item.type || null,
          technologies: item.technologies || [],
          archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        summary.imported.projects++;
      }
    }

    // Phase 3: Tasks
    const rawTasks = Array.isArray(input.tasks) ? input.tasks : [];
    for (const item of rawTasks) {
      const cleanTitle = (item.title || '').trim();
      if (!cleanTitle) continue;

      let remappedProjectId: Types.ObjectId | null = null;
      const rawProjId = item.projectId || (Array.isArray(item.projectIds) ? item.projectIds[0] : null);
      if (rawProjId) {
        remappedProjectId =
          projectIdMap.get(String(rawProjId)) ??
          (Types.ObjectId.isValid(rawProjId) ? new Types.ObjectId(rawProjId) : null);
      }
      // If task has no projectId but has goalIds, find a project linked to or matching that goal
      if (!remappedProjectId && Array.isArray(item.goalIds) && item.goalIds.length > 0) {
        for (const gid of item.goalIds) {
          for (const [pId, pObjId] of projectIdMap.entries()) {
            if (pId.toLowerCase().includes(String(gid).replace('goal-', '').toLowerCase())) {
              remappedProjectId = pObjId;
              break;
            }
          }
          if (remappedProjectId) break;
        }
      }

      const remappedTaskGoalIds = (item.goalIds || (item.goalId ? [item.goalId] : []))
        .map((gid) => goalIdMap.get(String(gid)) ?? (Types.ObjectId.isValid(gid) ? new Types.ObjectId(gid) : null))
        .filter((id): id is Types.ObjectId => id !== null);

      const taskStatus = item.status || 'todo';
      const existing = await this.connection.collection('tasks').findOne({
        userId: userObjId,
        title: cleanTitle,
        status: taskStatus,
        projectId: remappedProjectId,
      });

      if (existing) {
        summary.skippedDuplicates.tasks++;
      } else {
        const newTaskId = new Types.ObjectId();
        let deadlineDate: Date | null = null;
        if (item.deadline) {
          const parsed = new Date(item.deadline);
          if (!isNaN(parsed.getTime())) {
            deadlineDate = parsed;
          }
        }

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const taskPriority = validPriorities.includes(String(item.priority)) ? item.priority : 'medium';
        const taskDuration = typeof item.estimatedDurationMinutes === 'number' && item.estimatedDurationMinutes > 0
          ? item.estimatedDurationMinutes
          : null;

        await this.connection.collection('tasks').insertOne({
          _id: newTaskId,
          userId: userObjId,
          projectId: remappedProjectId,
          title: cleanTitle,
          description: (item.description || '').trim(),
          priority: taskPriority,
          estimatedDurationMinutes: taskDuration,
          status: taskStatus,
          deadline: deadlineDate,
          ...(remappedTaskGoalIds.length ? { goalIds: remappedTaskGoalIds } : {}),
          ...(item.course ? { course: item.course } : {}),
          ...(item.courseCode ? { courseCode: item.courseCode } : {}),
          ...(item.semester ? { semester: item.semester } : {}),
          ...(item.type ? { taskType: item.type } : {}),
          ...(item.subtasks?.length ? { subtasks: item.subtasks } : {}),
          ...(item.requirements?.length ? { requirements: item.requirements } : {}),
          ...(item.testQuestions?.length ? { testQuestions: item.testQuestions } : {}),
          ...(item.currentTopics?.length ? { currentTopics: item.currentTopics } : {}),
          ...(item.nextTopics?.length ? { nextTopics: item.nextTopics } : {}),
          ...(item.practiceMethod?.length ? { practiceMethod: item.practiceMethod } : {}),
          ...(item.technology?.length ? { technology: item.technology } : {}),
          ...(item.recurrence ? { recurrence: item.recurrence } : {}),
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        summary.imported.tasks++;
      }
    }

    // Phase 4: Habits
    const rawHabits = Array.isArray(input.habits) ? input.habits : [];
    for (const habit of rawHabits) {
      const cleanTitle = (habit.title || habit.name || '').trim();
      if (!cleanTitle) continue;
      const remappedGoalId = habit.goalId
        ? goalIdMap.get(String(habit.goalId)) ?? (Types.ObjectId.isValid(habit.goalId) ? new Types.ObjectId(habit.goalId) : null)
        : null;

      const existing = await this.connection.collection('habits').findOne({
        userId: userObjId,
        title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') },
      });

      if (existing) {
        summary.skippedDuplicates.habits = (summary.skippedDuplicates.habits || 0) + 1;
      } else {
        await this.connection.collection('habits').insertOne({
          _id: new Types.ObjectId(),
          userId: userObjId,
          title: cleanTitle,
          frequency: habit.frequency || 'daily',
          durationMinutes: habit.durationMinutes || 30,
          goalId: remappedGoalId,
          category: habit.category || null,
          createdAt: new Date(),
        });
        summary.imported.habits = (summary.imported.habits || 0) + 1;
      }
    }

    // Phase 5: Knowledge
    const rawKnowledge = Array.isArray(input.knowledge) ? input.knowledge : [];
    for (const item of rawKnowledge) {
      const subject = (item.subject || item.title || 'user').trim();
      const predicate = (item.predicate || item.type || 'context').trim();
      const object = (item.object || item.content || item.title || '').trim();
      if (!subject || !predicate || !object) continue;

      const existing = await this.connection.collection('knowledge_relationships').findOne({
        userId: userObjId,
        subject,
        predicate,
        object,
      });

      if (existing) {
        summary.skippedDuplicates.knowledge++;
      } else {
        let conf = 80;
        if (typeof item.confidence === 'number') {
          conf = item.confidence > 0 && item.confidence <= 1 ? Math.round(item.confidence * 100) : Math.round(item.confidence);
        } else if (item.confidence === 'high') conf = 90;
        else if (item.confidence === 'medium') conf = 70;
        else if (item.confidence === 'low') conf = 50;
        conf = Math.max(0, Math.min(100, Math.round(conf)));

        await this.connection.collection('knowledge_relationships').insertOne({
          userId: userObjId,
          subject,
          predicate,
          object,
          category: item.category || 'context',
          confidence: conf,
          status: item.status || 'active',
          supportingEventIds: [],
          evidenceCount: 1,
          title: item.title || null,
          content: item.content || null,
          source: item.source || null,
          type: item.type || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          lastUpdatedAt: item.lastUpdatedAt ? new Date(item.lastUpdatedAt) : new Date(),
          supersededBy: null,
        });
        summary.imported.knowledge++;
      }
    }

    // Phase 6: Events & Plans
    // Architectural Note: Historical events and precomputed mission/weekly plans are intentionally
    // omitted from imported documents because events are immutable historical audit records for this node,
    // and daily plans are reactively generated by the Planning Engine based on imported goals and tasks.

    // Optional Profile & Context Updates
    const profileData = (input.profile && typeof input.profile === 'object') ? input.profile : ((input.user && typeof input.user === 'object') ? input.user : {});
    const topPreferences = (input.preferences && typeof input.preferences === 'object') ? input.preferences : null;
    const profileUpdates: Record<string, any> = {};

    const rawTz = profileData.timezone || (input.user as any)?.timezone;
    if (rawTz && typeof rawTz === 'string') {
      profileUpdates.timezone = rawTz.trim();
    }
    const rawName = profileData.displayName || profileData.name || (input.user as any)?.displayName || (input.user as any)?.name;
    if (rawName && typeof rawName === 'string') {
      profileUpdates.displayName = rawName.trim();
    }
    const rawBio = profileData.bio || (input.user as any)?.bio || profileData.longTermDirection;
    if (rawBio && typeof rawBio === 'string') {
      profileUpdates.bio = rawBio.trim();
    }

    const prefObj = profileData.preferences || topPreferences || (input.user as any)?.preferences || {};
    const mergedPreferences = {
      ...prefObj,
      ...(profileData.role ? { role: profileData.role } : {}),
      ...(profileData.academicYear ? { academicYear: profileData.academicYear } : {}),
      ...(profileData.interests ? { interests: profileData.interests } : {}),
      ...(profileData.longTermDirection ? { longTermDirection: profileData.longTermDirection } : {}),
      ...(input.skills ? { skills: input.skills } : {}),
      ...(input.dailyPlanningContext ? { dailyPlanningContext: input.dailyPlanningContext } : {}),
    };
    profileUpdates.preferences = mergedPreferences;

    await this.connection.collection('users').updateOne(
      { _id: userObjId },
      { $set: profileUpdates },
    );

    // Proactively refresh decision and today's timetable when entities were imported
    if (summary.imported.tasks > 0 || summary.imported.goals > 0 || summary.imported.projects > 0) {
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        await this.connection.collection('missions').deleteMany({
          userId: userObjId,
          date: todayKey,
          status: 'active',
        });
        if (this.decisions) {
          await this.decisions.generate(userId).catch(() => null);
        }
        if (this.planning) {
          await this.planning.generateDailyMission(userId).catch(() => null);
        }
      } catch {
        // Non-blocking: planning/decision refresh failure should not abort successful import
      }
    }

    const extras: string[] = [];
    if (summary.imported.habits) extras.push(`${summary.imported.habits} habits`);
    if (summary.imported.events) extras.push(`${summary.imported.events} events`);
    const extrasStr = extras.length ? `, ${extras.join(', ')}` : '';
    summary.message = `Imported ${summary.imported.goals} goals, ${summary.imported.projects} projects, ${summary.imported.tasks} tasks, and ${summary.imported.knowledge} knowledge items${extrasStr}.`;
    return summary;
  }
}
