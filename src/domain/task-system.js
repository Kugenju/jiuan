(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createTaskState() {
  return {
    active: [],
    weeklyProgress: {
      craftCompleted: 0,
      craftTotal: 0,
    },
    completedMarks: [],
    lastStory: null,
  };
}

function createTaskRuntimeState() {
  return {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
  };
}

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function ensureTaskState(rootState) {
  const base = rootState.tasks && typeof rootState.tasks === "object" ? rootState.tasks : {};
  const weeklyProgress =
    base.weeklyProgress && typeof base.weeklyProgress === "object" ? base.weeklyProgress : {};
  rootState.tasks = {
    ...base,
    active: Array.isArray(base.active) ? base.active : [],
    weeklyProgress: {
      craftCompleted: normalizeNumber(weeklyProgress.craftCompleted, 0),
      craftTotal: normalizeNumber(weeklyProgress.craftTotal, 0),
    },
    completedMarks: Array.isArray(base.completedMarks) ? base.completedMarks : [],
    lastStory: Object.prototype.hasOwnProperty.call(base, "lastStory") ? base.lastStory : null,
  };
}

function syncWeeklyTaskProgress(rootState, context) {
  ensureTaskState(rootState);
  const getActivity = typeof context?.getActivity === "function" ? context.getActivity : null;
  if (!getActivity) {
    rootState.tasks.weeklyProgress.craftTotal = 0;
    rootState.tasks.weeklyProgress.craftCompleted = 0;
    return;
  }
  const total = (rootState.weeklyTimetable || []).flat().reduce((count, activityId) => {
    if (!activityId) {
      return count;
    }
    const activity = getActivity(activityId);
    return count + (activity?.kind === "course" && activity.skill === "craft" ? 1 : 0);
  }, 0);
  rootState.tasks.weeklyProgress.craftTotal = total;
  if (rootState.tasks.weeklyProgress.craftCompleted > total) {
    rootState.tasks.weeklyProgress.craftCompleted = total;
  }
}

function buildTimedTaskInstance(taskDef, rootState) {
  const durationDays = Math.max(1, normalizeNumber(taskDef.durationDays, 1));
  return {
    id: `week-${rootState.week}-${taskDef.id}`,
    type: taskDef.id,
    activityId: taskDef.activityId,
    status: "active",
    unlockDay: rootState.day,
    expiresOnDay: rootState.day + durationDays - 1,
    attemptCount: 0,
    rewardClaimed: false,
  };
}

function handleResolvedCourseTaskProgress(rootState, activity, context) {
  ensureTaskState(rootState);
  if (activity?.kind !== "course" || activity.skill !== "craft") {
    return null;
  }
  rootState.tasks.weeklyProgress.craftCompleted += 1;
  const taskDef = context.taskDefs?.artifact_refining;
  if (!taskDef) {
    return null;
  }
  const alreadyExists = rootState.tasks.active.some((task) => task.type === taskDef.id && task.status === "active");
  if (
    rootState.tasks.weeklyProgress.craftTotal > 0 &&
    rootState.tasks.weeklyProgress.craftCompleted === rootState.tasks.weeklyProgress.craftTotal &&
    !alreadyExists
  ) {
    const task = buildTimedTaskInstance(taskDef, rootState);
    rootState.tasks.active.push(task);
    if (typeof context.copy?.taskUnlocked === "function") {
      rootState.currentStory = context.copy.taskUnlocked("炼器任务", task.expiresOnDay);
      rootState.tasks.lastStory = structuredClone(rootState.currentStory);
    }
    return task;
  }
  return null;
}

function expireTimedTasksForDay(rootState, currentDay, context) {
  ensureTaskState(rootState);
  rootState.tasks.active.forEach((task) => {
    if (task.status === "active" && currentDay > task.expiresOnDay) {
      task.status = "expired";
      if (typeof context.copy?.taskExpired === "function") {
        rootState.currentStory = context.copy.taskExpired("炼器任务");
        rootState.tasks.lastStory = structuredClone(rootState.currentStory);
      }
    }
  });
}

function getSchedulableTaskActivityIds(rootState) {
  const activeTasks = rootState.tasks?.active || [];
  return new Set(activeTasks.filter((task) => task.status === "active").map((task) => task.activityId));
}

Object.assign(window.GAME_RUNTIME, {
  createTaskState,
  createTaskRuntimeState,
  syncWeeklyTaskProgress,
  handleResolvedCourseTaskProgress,
  expireTimedTasksForDay,
  getSchedulableTaskActivityIds,
});
})();
