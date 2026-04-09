(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createTaskState() {
  return {
    active: [],
    weeklyProgress: {
      craftCompleted: 0,
      craftTotal: 0,
      daoCompleted: 0,
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
    debate: null,
  };
}

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

const TASK_DISPLAY_NAMES = Object.freeze({
  artifact_refining: "炼器任务",
  dao_debate: "道法论辩",
});

function getTaskDisplayName(taskType) {
  return TASK_DISPLAY_NAMES[taskType] || "委托任务";
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
      daoCompleted: normalizeNumber(weeklyProgress.daoCompleted, 0),
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
  const availableAfterDays = Math.max(0, normalizeNumber(taskDef.availableAfterDays, 0));
  const hiddenUnlockFlags = Array.isArray(taskDef.hiddenUnlockFlags) ? taskDef.hiddenUnlockFlags : [];
  const storyFlags = rootState.storyFlags && typeof rootState.storyFlags === "object" ? rootState.storyFlags : {};
  return {
    id: `week-${rootState.week}-${taskDef.id}`,
    type: taskDef.id,
    activityId: taskDef.activityId,
    status: "active",
    unlockDay: rootState.day,
    availableFromDay: rootState.day + availableAfterDays,
    expiresOnDay: rootState.day + durationDays - 1,
    unlockFlags: hiddenUnlockFlags.filter((flagName) => storyFlags[flagName]),
    attemptCount: 0,
    rewardClaimed: false,
  };
}

function handleResolvedCourseTaskProgress(rootState, activity, context) {
  ensureTaskState(rootState);
  if (activity?.kind !== "course") {
    return null;
  }

  if (activity.skill === "craft") {
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
        rootState.currentStory = context.copy.taskUnlocked(getTaskDisplayName(taskDef.id), task.expiresOnDay);
        rootState.tasks.lastStory = structuredClone(rootState.currentStory);
      }
      return task;
    }
    return null;
  }

  if (activity.skill === "dao") {
    rootState.tasks.weeklyProgress.daoCompleted += 1;
    const taskDef = context.taskDefs?.dao_debate;
    if (!taskDef) {
      return null;
    }
    const unlockThreshold = Math.max(1, normalizeNumber(taskDef.unlockThreshold, 1));
    const alreadyExists = rootState.tasks.active.some((task) => task.type === taskDef.id && task.status === "active");
    if (rootState.tasks.weeklyProgress.daoCompleted >= unlockThreshold && !alreadyExists) {
      const task = buildTimedTaskInstance(taskDef, rootState);
      rootState.tasks.active.push(task);
      if (typeof context.copy?.taskUnlocked === "function") {
        rootState.currentStory = context.copy.taskUnlocked(getTaskDisplayName(taskDef.id), task.expiresOnDay);
        rootState.tasks.lastStory = structuredClone(rootState.currentStory);
      }
      return task;
    }
  }
  return null;
}

function expireTimedTasksForDay(rootState, currentDay, context) {
  ensureTaskState(rootState);
  rootState.tasks.active.forEach((task) => {
    if (task.status === "active" && currentDay > task.expiresOnDay) {
      task.status = "expired";
      if (typeof context.copy?.taskExpired === "function") {
        rootState.currentStory = context.copy.taskExpired(getTaskDisplayName(task.type));
        rootState.tasks.lastStory = structuredClone(rootState.currentStory);
      }
    }
  });
}

function getSchedulableTaskActivityIds(rootState, currentDay = rootState?.day) {
  const activeTasks = rootState.tasks?.active || [];
  const normalizedCurrentDay = normalizeNumber(currentDay, normalizeNumber(rootState?.day, 0));
  return new Set(
    activeTasks
      .filter((task) => {
        if (!task || task.status !== "active") {
          return false;
        }
        const availableFromDay = normalizeNumber(task.availableFromDay, normalizeNumber(task.unlockDay, 0));
        return normalizedCurrentDay >= availableFromDay;
      })
      .map((task) => task.activityId)
  );
}

function getActiveTaskForRuntime(rootState) {
  const runtime = rootState.taskRuntime || {};
  const activeTasks = rootState.tasks?.active || [];
  if (runtime.activeTaskId) {
    const matched = activeTasks.find((task) => task.id === runtime.activeTaskId);
    if (matched) {
      return matched;
    }
  }
  if (runtime.mode) {
    return activeTasks.find((task) => task.activityId === runtime.mode && task.status === "active") || null;
  }
  return null;
}

function applyRefiningTaskRound(rootState, roundResult, context = {}) {
  ensureTaskState(rootState);
  const settleRefiningSession = window.GAME_RUNTIME?.settleRefiningSession;
  const runtime = rootState.taskRuntime && typeof rootState.taskRuntime === "object" ? rootState.taskRuntime : null;
  if (!runtime || typeof settleRefiningSession !== "function" || !runtime.refining || !context.taskDef) {
    return {
      status: "invalid",
      session: runtime?.refining || null,
      finalResult: roundResult || null,
    };
  }

  const outcome = settleRefiningSession(runtime.refining, roundResult, context.taskDef, context.rng);
  runtime.refining = outcome.session;
  runtime.result = roundResult || null;

  if (outcome.status === "continue") {
    return {
      status: "continue",
      session: outcome.session,
      finalResult: null,
    };
  }

  const task = getActiveTaskForRuntime(rootState);
  if (task) {
    task.attemptCount = normalizeNumber(task.attemptCount, 0) + 1;
  }

  return {
    status: outcome.status,
    session: outcome.session,
    finalResult: {
      ...(roundResult || {}),
      complete: true,
      score: outcome.session.totalScore,
      success: outcome.status === "success",
    },
  };
}

Object.assign(window.GAME_RUNTIME, {
  createTaskState,
  createTaskRuntimeState,
  syncWeeklyTaskProgress,
  handleResolvedCourseTaskProgress,
  expireTimedTasksForDay,
  getSchedulableTaskActivityIds,
  applyRefiningTaskRound,
});
})();
