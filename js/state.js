/**
 * Cadence — Application State, Storage & Daily Capacity Resolver
 * Preserves all user tasks/data under 'cadence_planner_state_v5'.
 */

function createDefaultState() {
  const today = getTodayStr();
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const threeDaysAgo = addDays(today, -3);
  const fourDaysAgo = addDays(today, -4);
  const fiveDaysAgo = addDays(today, -5);

  const projects = [
    { id: 'proj_work_school', name: 'Work / School', color: '#0F766E' },
  ];

  const tasks = [
    {
      id: 'task_overdue_1',
      title: 'Algorithms Problem Set #4 (Graph Flows)',
      projectId: 'proj_work_school',
      priority: 'P1',
      estimatedHours: 2.0,
      maxHours: 2.5,
      remainingHours: 1.25,
      loggedHours: 1.25,
      deadline: yesterday,
      bufferDays: 1,
      minSessionMins: 30,
      maxSessionMins: 60,
      notes: 'Ford-Fulkerson & min-cut proof questions',
      completed: false,
      createdAt: fourDaysAgo,
    },
    {
      id: 'task_1',
      title: 'Distributed Systems Raft Consensus Lab',
      projectId: 'proj_work_school',
      priority: 'P1',
      estimatedHours: 3.25,
      maxHours: 4.0,
      remainingHours: 2.25,
      loggedHours: 1.75,
      deadline: addDays(today, 3),
      bufferDays: 1,
      minSessionMins: 45,
      maxSessionMins: 60,
      notes: 'Leader election & log replication test suite',
      completed: false,
      createdAt: threeDaysAgo,
    },
    {
      id: 'task_2',
      title: 'Q4 API Rate-Limiter Architecture Spec',
      projectId: 'proj_work_school',
      priority: 'P2',
      estimatedHours: 3.0,
      maxHours: 3.5,
      remainingHours: 2.5,
      loggedHours: 1.0,
      deadline: addDays(today, 5),
      bufferDays: 1,
      minSessionMins: 30,
      maxSessionMins: 60,
      notes: 'Draft token-bucket benchmarks and failover section',
      completed: false,
      createdAt: twoDaysAgo,
    },
    {
      id: 'task_3',
      title: 'Linear Algebra Eigenvalues Assignment',
      projectId: 'proj_work_school',
      priority: 'P3',
      estimatedHours: 2.25,
      maxHours: 2.75,
      remainingHours: 2.75,
      loggedHours: 0,
      deadline: addDays(today, 7),
      bufferDays: 2,
      minSessionMins: 45,
      maxSessionMins: 60,
      notes: 'SVD decomposition and spectral theorem problems',
      completed: false,
      createdAt: yesterday,
    },
    {
      id: 'task_4',
      title: 'Literature Review & Annotated Bibliography',
      projectId: 'proj_work_school',
      priority: 'P4',
      estimatedHours: 1.75,
      maxHours: 2.25,
      remainingHours: 2.25,
      loggedHours: 0,
      deadline: addDays(today, 10),
      bufferDays: 2,
      minSessionMins: 30,
      maxSessionMins: 60,
      notes: 'Summarize 5 systems papers',
      completed: false,
      createdAt: today,
    },
    {
      id: 'task_5',
      title: 'Database Indexing Performance Audit',
      projectId: 'proj_work_school',
      priority: 'P1',
      estimatedHours: 1.75,
      maxHours: 2.0,
      remainingHours: 0,
      loggedHours: 2.0,
      deadline: today,
      bufferDays: 1,
      minSessionMins: 45,
      maxSessionMins: 60,
      notes: 'Completed on schedule',
      completed: true,
      createdAt: fiveDaysAgo,
    },
  ];

  const chunks = [
    {
      id: 'chk_hist_1',
      taskId: 'task_5',
      date: fiveDaysAgo,
      durationHours: 1.25,
      loggedHours: 1.25,
      status: 'completed',
      chunkIndex: 1,
      totalChunks: 2,
      completedAt: `${fiveDaysAgo}T14:00:00.000Z`,
    },
    {
      id: 'chk_hist_2',
      taskId: 'task_overdue_1',
      date: fourDaysAgo,
      durationHours: 1.25,
      loggedHours: 1.25,
      status: 'completed',
      chunkIndex: 1,
      totalChunks: 2,
      completedAt: `${fourDaysAgo}T16:00:00.000Z`,
    },
    {
      id: 'chk_hist_3',
      taskId: 'task_1',
      date: threeDaysAgo,
      durationHours: 1.75,
      loggedHours: 1.75,
      status: 'completed',
      chunkIndex: 1,
      totalChunks: 4,
      completedAt: `${threeDaysAgo}T15:00:00.000Z`,
    },
    {
      id: 'chk_hist_4',
      taskId: 'task_2',
      date: twoDaysAgo,
      durationHours: 1.25,
      loggedHours: 1.0,
      status: 'completed',
      chunkIndex: 1,
      totalChunks: 4,
      completedAt: `${twoDaysAgo}T11:30:00.000Z`,
    },
    {
      id: 'chk_hist_5',
      taskId: 'task_5',
      date: today,
      durationHours: 0.75,
      loggedHours: 0.75,
      status: 'completed',
      chunkIndex: 2,
      totalChunks: 2,
      completedAt: `${today}T09:30:00.000Z`,
    },
    {
      id: 'chk_unreported_overdue_1',
      taskId: 'task_overdue_1',
      date: yesterday,
      durationHours: 1.25,
      loggedHours: 0,
      status: 'unreported',
      chunkIndex: 2,
      totalChunks: 2,
    },
    {
      id: 'chk_unreported_past_2',
      taskId: 'task_1',
      date: yesterday,
      durationHours: 0.75,
      loggedHours: 0,
      status: 'unreported',
      chunkIndex: 2,
      totalChunks: 4,
    },
  ];

  const habits = [
    {
      id: 'hab_1',
      title: 'Review Lecture & Sprint Notes',
      frequency: 'daily',
      intervalCount: 1,
      hasDuration: true,
      durationMins: 30,
      consumesCapacity: true,
      projectId: 'proj_work_school',
      priority: 'P2',
      completedPeriods: { [today]: true, [yesterday]: true },
    },
    {
      id: 'hab_2',
      title: 'Inbox & Deadline Triage',
      frequency: 'daily',
      intervalCount: 1,
      hasDuration: false,
      durationMins: null,
      consumesCapacity: false,
      projectId: 'proj_work_school',
      priority: 'P3',
      completedPeriods: {},
    },
    {
      id: 'hab_3',
      title: 'Weekly Study & Backlog Planning',
      frequency: 'weekly',
      intervalCount: 1,
      daysOfWeek: [parseDateLocal(today).getDay()],
      hasDuration: true,
      durationMins: 30,
      consumesCapacity: true,
      projectId: 'proj_work_school',
      priority: 'P2',
      completedPeriods: {},
    },
    {
      id: 'hab_4',
      title: 'Submit Weekly Timesheet / Attendance',
      frequency: 'weekly',
      intervalCount: 1,
      daysOfWeek: [parseDateLocal(today).getDay()],
      hasDuration: false,
      durationMins: null,
      consumesCapacity: false,
      projectId: 'proj_work_school',
      priority: 'P2',
      completedPeriods: {},
    },
    {
      id: 'hab_5',
      title: 'Back Up Local Project Repos',
      frequency: 'timeless',
      intervalCount: 1,
      hasDuration: false,
      durationMins: null,
      consumesCapacity: false,
      projectId: 'proj_work_school',
      priority: 'P3',
      completedPeriods: {},
    },
  ];

  const logs = [
    {
      id: 'log_hist_14',
      taskId: 'task_5',
      chunkId: 'chk_seed_14',
      date: addDays(today, -14),
      loggedHours: 4.5,
      plannedHours: 4.5,
      priority: 'P1',
      timestamp: `${addDays(today, -14)}T17:00:00.000Z`,
    },
    {
      id: 'log_hist_12',
      taskId: 'task_1',
      chunkId: 'chk_seed_12',
      date: addDays(today, -12),
      loggedHours: 2.25,
      plannedHours: 2.5,
      priority: 'P1',
      timestamp: `${addDays(today, -12)}T16:00:00.000Z`,
    },
    {
      id: 'log_hist_10',
      taskId: 'task_2',
      chunkId: 'chk_seed_10',
      date: addDays(today, -10),
      loggedHours: 3.5,
      plannedHours: 3.5,
      priority: 'P2',
      timestamp: `${addDays(today, -10)}T15:30:00.000Z`,
    },
    {
      id: 'log_hist_8',
      taskId: 'task_3',
      chunkId: 'chk_seed_8',
      date: addDays(today, -8),
      loggedHours: 1.0,
      plannedHours: 1.5,
      priority: 'P3',
      timestamp: `${addDays(today, -8)}T13:00:00.000Z`,
    },
    {
      id: 'log_hist_7',
      taskId: 'task_1',
      chunkId: 'chk_seed_7',
      date: addDays(today, -7),
      loggedHours: 4.75,
      plannedHours: 4.5,
      priority: 'P1',
      timestamp: `${addDays(today, -7)}T18:00:00.000Z`,
    },
    {
      id: 'log_1',
      taskId: 'task_5',
      chunkId: 'chk_hist_1',
      date: fiveDaysAgo,
      loggedHours: 1.25,
      plannedHours: 1.25,
      priority: 'P1',
      timestamp: `${fiveDaysAgo}T14:00:00.000Z`,
    },
    {
      id: 'log_2',
      taskId: 'task_overdue_1',
      chunkId: 'chk_hist_2',
      date: fourDaysAgo,
      loggedHours: 1.25,
      plannedHours: 1.25,
      priority: 'P1',
      timestamp: `${fourDaysAgo}T16:00:00.000Z`,
    },
    {
      id: 'log_3',
      taskId: 'task_1',
      chunkId: 'chk_hist_3',
      date: threeDaysAgo,
      loggedHours: 1.75,
      plannedHours: 1.75,
      priority: 'P1',
      timestamp: `${threeDaysAgo}T15:00:00.000Z`,
    },
    {
      id: 'log_4',
      taskId: 'task_2',
      chunkId: 'chk_hist_4',
      date: twoDaysAgo,
      loggedHours: 1.0,
      plannedHours: 1.25,
      priority: 'P2',
      timestamp: `${twoDaysAgo}T11:30:00.000Z`,
    },
    {
      id: 'log_5',
      taskId: 'task_5',
      chunkId: 'chk_hist_5',
      date: today,
      loggedHours: 0.75,
      plannedHours: 0.75,
      priority: 'P1',
      timestamp: `${today}T09:30:00.000Z`,
    },
  ];

  return {
    theme: 'light',
    activeView: 'today',
    selectedProjectFilter: 'ALL',
    activeHabitTab: 'checklist',
    forecastWeeks: 2,
    distributionStrategy: 'asap',
    focusPeriod: {
      startDate: today,
      endDate: addDays(today, 6),
      focusIntensityPct: 0,
    },
    capacity: {
      defaultBufferDays: 1,
      mode: 'weekly',
      weekly: {
        0: 5.0,
        1: 4.5,
        2: 4.5,
        3: 4.5,
        4: 4.5,
        5: 4.0,
        6: 5.5,
      },
      weekdayWeekend: {
        weekday: 4.5,
        weekend: 5.5,
      },
      monthlyRule: {
        days: [1, 15],
        hours: 3.0,
      },
      overrides: {},
    },
    projects,
    tasks,
    chunks,
    habits,
    logs,
  };
}

// ==================== APPLICATION STATE & STORAGE ====================

function isDefaultUneditedProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return true;
  if (projects.length === 1 && projects[0].name === 'Work / School' && projects[0].color === '#0F766E') {
    return true;
  }
  return false;
}

function findSavedUserProjects() {
  try {
    const rawBackup = localStorage.getItem(SECTIONS_BACKUP_KEY);
    if (rawBackup) {
      const parsedBackup = JSON.parse(rawBackup);
      if (Array.isArray(parsedBackup) && parsedBackup.length > 0 && !isDefaultUneditedProjects(parsedBackup)) {
        return parsedBackup;
      }
    }
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0 && !isDefaultUneditedProjects(parsed.projects)) {
        return parsed.projects;
      }
    }
  } catch (err) {
    console.warn('Error scanning saved user sections:', err);
  }
  return null;
}

let state = loadState();

function loadState() {
  try {
    let loaded = null;
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tasks && parsed.capacity) {
        loaded = parsed;
        break;
      }
    }

    if (loaded) {
      if (!loaded.focusPeriod) {
        loaded.focusPeriod = {
          startDate: getTodayStr(),
          endDate: addDays(getTodayStr(), 6),
          focusIntensityPct: 0,
        };
      } else {
        loaded.focusPeriod.focusIntensityPct = Math.max(
          0,
          Math.min(100, Number(loaded.focusPeriod.focusIntensityPct) || 0)
        );
      }

      const savedUserProjects = findSavedUserProjects();
      if (savedUserProjects && isDefaultUneditedProjects(loaded.projects)) {
        loaded.projects = savedUserProjects;
      }

      if (Array.isArray(loaded.tasks)) {
        for (const t of loaded.tasks) {
          if (t.estimatedHours === undefined) {
            t.estimatedHours = Number(t.minEstimateHours) || 2.0;
          }
          if (t.maxHours === undefined) {
            if (t.maxEstimateHours !== undefined) {
              t.maxHours = Math.max(t.estimatedHours, Number(t.maxEstimateHours));
            } else if (t.taskBufferHours !== undefined) {
              t.maxHours = roundTwo(Number(t.estimatedHours) + Number(t.taskBufferHours));
            } else {
              t.maxHours = roundTwo(Number(t.estimatedHours) * 1.25);
            }
          }
          if (t.dependsOnTaskId === undefined) {
            t.dependsOnTaskId = null;
          }
        }
      }

      if (!Array.isArray(loaded.habits)) {
        loaded.habits = [];
      }
      if (!['checklist', 'timed', 'all'].includes(loaded.activeHabitTab)) {
        loaded.activeHabitTab = 'checklist';
      }
      const defaultProjId = loaded.projects?.[0]?.id || 'proj_work_school';
      for (const h of loaded.habits) {
        if (!h.completedPeriods) h.completedPeriods = {};
        if (!h.skippedDates || typeof h.skippedDates !== 'object') h.skippedDates = {};
        if (!h.intervalCount || h.intervalCount < 1) h.intervalCount = 1;
        if (!h.projectId) h.projectId = defaultProjId;
        if (!h.priority) h.priority = 'P2';
        if (typeof h.hasDuration !== 'boolean') {
          h.hasDuration = Boolean(h.consumesCapacity && h.frequency !== 'timeless');
        }
        h.consumesCapacity = Boolean(h.hasDuration && h.frequency !== 'timeless');
        if (h.hasDuration && (!h.durationMins || h.durationMins < 5)) {
          h.durationMins = 30;
        }
        if (h.frequency === 'weekly' && !Array.isArray(h.daysOfWeek)) {
          h.daysOfWeek = [parseDateLocal(getTodayStr()).getDay()];
        }
        if (h.frequency === 'monthly' && !h.dayOfMonth) {
          h.dayOfMonth = 1;
        }
        if (!h.anchorDate) {
          h.anchorDate = getTodayStr();
        }
      }

      return loaded;
    }
  } catch (err) {
    console.warn('Failed to parse saved state, falling back to default:', err);
  }
  const def = createDefaultState();
  const savedUserProjects = findSavedUserProjects();
  if (savedUserProjects) {
    def.projects = savedUserProjects;
  }
  return def;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state && Array.isArray(state.projects) && state.projects.length > 0) {
      localStorage.setItem(SECTIONS_BACKUP_KEY, JSON.stringify(state.projects));
    }
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

// ==================== CAPACITY & PROJECT HELPERS ====================

function getProjectById(projectId) {
  return (
    state.projects.find((p) => p.id === projectId) ||
    state.projects[0] || {
      id: 'proj_work_school',
      name: 'Work / School',
      color: '#0F766E',
    }
  );
}

function getDailyCapacityInfo(dateStr) {
  const cap = state.capacity;
  const dt = parseDateLocal(dateStr);
  const dow = dt.getDay();
  const dom = dt.getDate();

  let baseTotal = cap.weekly?.[dow] ?? 4.5;
  let source = 'Weekly Pattern';

  if (cap.mode === 'monthly' && cap.monthlyRule && Array.isArray(cap.monthlyRule.days)) {
    if (cap.monthlyRule.days.includes(dom)) {
      baseTotal = Number(cap.monthlyRule.hours ?? 3.0);
      source = `Monthly Rule (Day ${dom})`;
    }
  } else if (cap.mode === 'weekday_weekend') {
    const isWeekend = dow === 0 || dow === 6;
    baseTotal = isWeekend
      ? Number(cap.weekdayWeekend?.weekend ?? 5.5)
      : Number(cap.weekdayWeekend?.weekday ?? 4.5);
    source = isWeekend ? 'Weekend Pattern' : 'Weekday Pattern';
  }

  const ov = cap.overrides?.[dateStr];
  const isOverridden =
    ov !== undefined &&
    (ov.totalHours !== undefined || typeof ov === 'number');

  let totalHours = baseTotal;

  if (isOverridden) {
    if (typeof ov === 'number') {
      totalHours = ov;
    } else if (ov.totalHours !== undefined) {
      totalHours = Number(ov.totalHours);
    }
    source = 'Visualizer Override';
  }

  const cleanHours = roundTwo(Math.max(0, totalHours));

  return {
    totalHours: cleanHours,
    netWorkHours: cleanHours,
    source,
    isOverridden,
  };
}

function setDayOverride(dateStr, newTotalHours) {
  if (!state.capacity.overrides) state.capacity.overrides = {};
  const current = getDailyCapacityInfo(dateStr);
  state.capacity.overrides[dateStr] = {
    totalHours: newTotalHours !== null && newTotalHours !== undefined ? Math.max(0, Number(newTotalHours)) : current.totalHours,
  };
}

function clearDayOverride(dateStr) {
  if (state.capacity.overrides && state.capacity.overrides[dateStr] !== undefined) {
    delete state.capacity.overrides[dateStr];
  }
}
