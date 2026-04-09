const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const topPanel = document.querySelector("#top-panel");
const mainPanel = document.querySelector("#main-panel");
const leftPanel = document.querySelector("#left-panel");
const flowPanel = document.querySelector("#flow-panel");
const logPanel = document.querySelector("#log-panel");
const statusLine = document.querySelector("#status-line");
const statsToggleBtn = document.querySelector("#stats-toggle-btn");
const progressToggleBtn = document.querySelector("#progress-toggle-btn");
const feedbackToggleBtn = document.querySelector("#feedback-toggle-btn");
const timetableToggleBtn = document.querySelector("#timetable-toggle-btn");
const overlayBackdrop = document.querySelector("#overlay-backdrop");
const memoryStage = document.querySelector("#memory-stage");
const infoModal = document.querySelector("#info-modal");

const {
  SLOT_DEFS,
  SLOT_NAMES,
  ACTIVITY_KIND_LABELS,
  SKILL_LABELS,
  SKILL_ZONE_MAP,
  COURSE_CATEGORY_LABELS,
  MEMORY_TYPES,
  MEMORY_FRAGMENT_TYPES,
  MEMORY_BUILD_RULES,
  MEMORY_ZONE_META,
  STAT_LABELS,
  RELATIONSHIP_LABELS,
  RESOURCE_LABELS,
  ARCHETYPES,
  ACTIVITIES,
  WEEKDAY_LABELS,
  COURSE_CATALOG,
  COURSE_SELECTION_BLOCKS,
  SCHEDULE_PRESETS,
  DAY_MODIFIERS,
  RANDOM_EVENTS,
  STORY_BEATS,
  RANK_THRESHOLDS,
  TASK_DEFS,
  REFINING_CARD_TYPES,
  COPY,
  UI_TEXT,
} = window.GAME_DATA;

const {
  createGameState,
  dispatchSessionCommand,
  applyEffectBundleToRoot,
  normalizePlayerState,
  areAllScheduleSlotsFilled,
  getResolvingSlotActivity: getResolvingSlotActivityFromRuntime,
  pushResolvingStoryToState,
  resetResolvingStoryTrailOnState,
  getResolvingSegmentsForSlot,
  showResolvingLeadForSlot,
  appendResolvingSegmentForSlot,
  resolveSlotForFlowState,
  resumeResolvingAfterTaskAttempt,
  startDayFlow,
  advanceResolvingFlowState,
  toggleResolvingAutoplayOnState,
  createRandomEventRuntimeState,
  chooseRandomEventOptionForFlowState,
  confirmRandomEventResultForFlowState,
  findDayModifier,
  storyBeatMatchesState,
  triggerStoryBeatForActivity,
  applyActivityToState,
  buildWeekTransitionState,
  computeRankForState,
  finishRunState,
  buildMemoryPiecesForState,
  resolveMemoryStructureFromFragments,
  getZoneSkillKey,
  resolvePlacementZoneForPiece,
  normalizeMemoryCursorOnLayout,
  resolveMemoryTargetOnLayout,
  isValidNodePlacementForState,
  isValidBridgePlacementForState,
  isValidMemoryPlacement,
  selectMemoryPieceOnState,
  startMemoryDragOnState,
  endMemoryDragOnState,
  moveMemoryCursorOnState,
  cycleMemoryPieceOnState,
  enterMemoryPhaseState,
  placeMemoryPieceInFlow,
  finishNightFlow,
  createRefiningAttemptState,
  createRefiningSessionState,
  revealRefiningCard,
  placeRefiningCardInSlot,
  resolveRefiningAttempt,
  applyRefiningTaskRound,
  createDaoDebateSessionState,
  playDaoDebateCard,
  buildRefiningStageView,
  hitTestRefiningStage,
  buildRefiningTaskPanelState,
  renderRefiningTaskPanelHtml,
  buildDaoDebateTaskPanelState,
  renderDaoDebateTaskPanelHtml,
  handleResolvedCourseTaskProgress: handleResolvedCourseTaskProgressFromRuntime,
  expireTimedTasksForDay: expireTimedTasksForDayFromRuntime,
  getSchedulableTaskActivityIds: getSchedulableTaskActivityIdsFromRuntime,
  createKeyboardHandler,
  buildTextStateExport,
} = window.GAME_RUNTIME;

const RUNTIME_COPY = {
  ...COPY,
  runStartStory: {
    ...COPY.runStartStory,
    title: "太学院开学周",
    body: "先在开周选课阶段敲定这周固定课程，再把每天的自由时段安排好。白天推进课程与生活，晚上把灵块拼进长期记忆。",
  },
  incompleteSchedule: {
    ...COPY.incompleteSchedule,
    title: "日程未满",
    body: "今天的自由时段还没有安排完。固定课程会按课表自动带入，但空出来的时段仍需要你自己补齐。",
  },
};

const REFINING_STAGE_LAYOUT = {
  boardOrigin: { x: 82, y: 212 },
  cardSize: { width: 118, height: 86 },
  cardGap: { x: 18, y: 18 },
  triangleSlots: [
    { x: 648, y: 230, width: 132, height: 82 },
    { x: 566, y: 374, width: 132, height: 82 },
    { x: 730, y: 374, width: 132, height: 82 },
  ],
};
const DAO_DEBATE_REPLY_REVEAL_MS = 420;

const CANVAS_THEME = {
  backgroundTop: "#f3ead8",
  backgroundMid: "#e8ddc6",
  backgroundBottom: "#d9ccb3",
  bannerFill: "rgba(248,242,230,0.84)",
  bannerStroke: "rgba(168,142,112,0.32)",
  bannerTitle: "#2f2418",
  bannerSubtitle: "#73614a",
  panelFill: "rgba(248,242,230,0.78)",
  panelFillStrong: "rgba(248,242,230,0.88)",
  panelStroke: "rgba(168,142,112,0.32)",
  panelText: "#2f2418",
  panelMuted: "#6f604c",
  accentDaiqing: "#456b6d",
  accentDaiqingSoft: "rgba(69,107,109,0.18)",
  accentGold: "#c7a45a",
  accentGoldSoft: "rgba(199,164,90,0.18)",
  accentGoldLine: "rgba(199,164,90,0.42)",
  accentCinnabar: "#b46f5a",
  slotIdleFill: "rgba(248,242,230,0.58)",
  slotDoneFill: "rgba(199,164,90,0.24)",
  slotSelectedFill: "rgba(69,107,109,0.22)",
  progressTrack: "rgba(168,142,112,0.22)",
  progressFill: "#456b6d",
  sceneSilhouette: "rgba(117,101,72,0.12)",
  sceneMist: "rgba(69,107,109,0.08)",
  sunGlow: "rgba(199,164,90,0.18)",
  courtyardMist: "rgba(255,250,241,0.3)",
  screenLine: "rgba(122,98,66,0.2)",
  roofShadow: "rgba(88,67,44,0.2)",
  roofEdge: "rgba(123,94,58,0.44)",
  floorGlow: "rgba(255,247,231,0.46)",
};

function createRng(seed = 20260313) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createTodayState() {
  const emptySkillCounter = Object.fromEntries(Object.keys(SKILL_LABELS).map((key) => [key, 0]));
  return {
    focus: structuredClone(emptySkillCounter),
    tones: { study: 0, life: 0, body: 0, social: 0 },
    kinds: { course: 0, assignment: 0, routine: 0 },
    courseSkills: structuredClone(emptySkillCounter),
    courses: [],
    assignments: [],
    randomEvents: [],
    latestCourseSkill: null,
    actions: [],
  };
}

function createStoryFlags() {
  const flags = { introDone: false };
  STORY_BEATS.forEach((beat) => {
    flags[beat.id] = false;
  });
  return flags;
}

const MEMORY_HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

function classifyMemoryZone(q, r) {
  if (q === 0 && r === 0) {
    return "core";
  }
  if (q >= 0 && r < 0) {
    return "sigil";
  }
  if (q > 0 && r >= 0) {
    return "craft";
  }
  if (q <= 0 && r > 0) {
    return "dao";
  }
  return "math";
}

function buildMemoryHexLayout(radius = 2) {
  const nodes = [];
  const coordToIndex = new Map();

  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      const index = nodes.length;
      nodes.push({
        index,
        q,
        r,
        zone: classifyMemoryZone(q, r),
      });
      coordToIndex.set(`${q},${r}`, index);
    }
  }

  nodes.forEach((node) => {
    node.neighbors = [];
    node.edgeIds = [];
    node.x = Math.sqrt(3) * (node.q + node.r / 2);
    node.y = 1.5 * node.r;
  });

  const edges = [];
  nodes.forEach((node) => {
    MEMORY_HEX_DIRECTIONS.forEach((dir) => {
      const neighbor = coordToIndex.get(`${node.q + dir.q},${node.r + dir.r}`);
      if (neighbor === undefined) {
        return;
      }
      node.neighbors.push(neighbor);
      if (node.index < neighbor) {
        edges.push({ index: edges.length, a: node.index, b: neighbor });
      }
    });
  });

  edges.forEach((edge) => {
    nodes[edge.a].edgeIds.push(edge.index);
    nodes[edge.b].edgeIds.push(edge.index);
  });

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const xSpan = Math.max(1e-6, maxX - minX);
  const ySpan = Math.max(1e-6, maxY - minY);
  const paddingX = 8;
  const paddingY = 8;
  const scale = Math.min((100 - paddingX * 2) / xSpan, (100 - paddingY * 2) / ySpan);
  const offsetX = (100 - xSpan * scale) / 2;
  const offsetY = (100 - ySpan * scale) / 2;

  nodes.forEach((node) => {
    node.ux = offsetX + (node.x - minX) * scale;
    node.uy = offsetY + (node.y - minY) * scale;
  });

  edges.forEach((edge) => {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    edge.mx = (a.ux + b.ux) / 2;
    edge.my = (a.uy + b.uy) / 2;
  });

  return {
    radius,
    nodes,
    edges,
    centerNodeId: coordToIndex.get("0,0") ?? 0,
  };
}

function buildConvexHull(points) {
  const uniquePoints = [];
  const seen = new Set();
  points.forEach((point) => {
    const key = `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    uniquePoints.push({ x: point.x, y: point.y });
  });
  if (uniquePoints.length <= 2) {
    return uniquePoints;
  }

  uniquePoints.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (origin, a, b) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

  const lower = [];
  uniquePoints.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  });

  const upper = [];
  for (let index = uniquePoints.length - 1; index >= 0; index -= 1) {
    const point = uniquePoints[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function buildMemoryZoneAreas(layout) {
  const centerNode = layout.nodes[layout.centerNodeId];
  const zoneIds = ["math", "sigil", "craft", "dao"];
  const polygons = zoneIds
    .map((zone) => {
      const points = layout.nodes
        .filter((node) => node.zone === zone)
        .map((node) => ({ x: node.ux, y: node.uy }));
      points.push({ x: centerNode.ux, y: centerNode.uy });
      const hull = buildConvexHull(points);
      return {
        zone,
        points: hull.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" "),
      };
    })
    .filter((polygon) => polygon.points);

  const anchorId = centerNode.neighbors[0];
  const anchorNode = anchorId === undefined ? null : layout.nodes[anchorId];
  const coreRadius = anchorNode
    ? (Math.hypot(anchorNode.ux - centerNode.ux, anchorNode.uy - centerNode.uy) * 0.46).toFixed(3)
    : "6.200";

  return {
    polygons,
    core: {
      x: centerNode.ux.toFixed(3),
      y: centerNode.uy.toFixed(3),
      r: coreRadius,
    },
  };
}

const MEMORY_HEX_LAYOUT = buildMemoryHexLayout(2);
const MEMORY_ZONE_AREAS = buildMemoryZoneAreas(MEMORY_HEX_LAYOUT);

function createMemoryBoardState() {
  return MEMORY_HEX_LAYOUT.nodes.map((node) => ({
    zone: node.zone,
    unlocked: false,
    unlockedDay: null,
    fragments: [],
    structure: null,
    structureSkill: null,
    day: null,
  }));
}

function createMemoryBridgeState() {
  return MEMORY_HEX_LAYOUT.edges.map(() => null);
}

function createSessionOptions() {
  const initialFreeActivityId =
    ACTIVITIES.find((activity) => activity.kind !== "course" && activity.kind !== "task")?.id ||
    ACTIVITIES.find((activity) => activity.kind !== "course")?.id ||
    ACTIVITIES[0].id;
  return {
    createRng,
    createTodayState,
    createStoryFlags,
    createMemoryBoardState,
    createMemoryBridgeState,
    totalDays: 7,
    totalWeeks: 4,
    slotCount: SLOT_NAMES.length,
    initialArchetypeId: ARCHETYPES[0].id,
    initialActivityId: initialFreeActivityId,
    memoryCenterNodeId: MEMORY_HEX_LAYOUT.centerNodeId,
    copy: RUNTIME_COPY,
  };
}

const sessionOptions = createSessionOptions();
const state = createGameState(sessionOptions);

function getSchedulableTaskActivityIdsForState(rootState = state) {
  if (typeof getSchedulableTaskActivityIdsFromRuntime === "function") {
    return getSchedulableTaskActivityIdsFromRuntime(rootState);
  }
  const activeTasks = rootState.tasks?.active || [];
  return new Set(activeTasks.filter((task) => task.status === "active").map((task) => task.activityId));
}

function isPlanningActivityAssignable(rootState, activity) {
  if (!activity || activity.kind === "course") {
    return false;
  }
  if (activity.kind !== "task") {
    return true;
  }
  return getSchedulableTaskActivityIdsForState(rootState).has(activity.id);
}

function getPlanningActivities(rootState = state) {
  return ACTIVITIES.filter((activity) => isPlanningActivityAssignable(rootState, activity));
}

function getDefaultPlanningActivityId(rootState = state) {
  const planningActivities = getPlanningActivities(rootState);
  return (
    planningActivities.find((activity) => activity.kind !== "task")?.id ||
    planningActivities[0]?.id ||
    ACTIVITIES.find((activity) => activity.kind !== "course" && activity.kind !== "task")?.id ||
    ACTIVITIES.find((activity) => activity.kind !== "course")?.id ||
    ACTIVITIES[0]?.id ||
    null
  );
}

function findTaskDefByActivityId(activityId, taskDefs = TASK_DEFS) {
  return Object.values(taskDefs || {}).find((taskDef) => taskDef.activityId === activityId) || null;
}

function findActiveTaskForActivity(rootState, activityId) {
  return (rootState.tasks?.active || []).find((task) => task.activityId === activityId && task.status === "active") || null;
}

function expireTimedTasksForDayForState(rootState, currentDay, options = {}) {
  if (typeof expireTimedTasksForDayFromRuntime === "function") {
    return expireTimedTasksForDayFromRuntime(rootState, currentDay, options);
  }
  (rootState.tasks?.active || []).forEach((task) => {
    if (task.status === "active" && currentDay > task.expiresOnDay) {
      task.status = "expired";
    }
  });
}

function syncWeeklyTaskProgressForState(rootState, options = {}) {
  const getActivityForState = typeof options.getActivity === "function" ? options.getActivity : getActivity;
  rootState.tasks = rootState.tasks || {
    active: [],
    weeklyProgress: { craftCompleted: 0, craftTotal: 0 },
    completedMarks: [],
    lastStory: null,
  };
  rootState.tasks.weeklyProgress = rootState.tasks.weeklyProgress || { craftCompleted: 0, craftTotal: 0 };
  const craftCompleted = Number(rootState.tasks.weeklyProgress.craftCompleted);
  rootState.tasks.weeklyProgress.craftCompleted = Number.isFinite(craftCompleted) ? craftCompleted : 0;
  rootState.tasks.weeklyProgress.craftTotal = 0;
  if (typeof getActivityForState !== "function") {
    return;
  }

  const craftTotal = (rootState.weeklyTimetable || []).flat().reduce((count, activityId) => {
    const activity = activityId ? getActivityForState(activityId) : null;
    return count + (activity?.kind === "course" && activity.skill === "craft" ? 1 : 0);
  }, 0);

  rootState.tasks.weeklyProgress.craftTotal = craftTotal;
  if (rootState.tasks.weeklyProgress.craftCompleted > craftTotal) {
    rootState.tasks.weeklyProgress.craftCompleted = craftTotal;
  }
}

function beginTaskActivityForSlot(rootState, activity, slotIndex, options = {}) {
  const taskDef = findTaskDefByActivityId(activity.id, options.taskDefs || TASK_DEFS);
  const activeTask = findActiveTaskForActivity(rootState, activity.id);
  if (!taskDef || !activeTask) {
    return { ok: false, reason: "task_not_available" };
  }

  rootState.mode = "task";
  rootState.scene = activity.scene || "task";
  rootState.taskRuntime = {
    activeTaskId: activeTask.id,
    pendingSlotIndex: slotIndex,
    mode: activity.id,
    result: null,
    refining:
      taskDef.id === "artifact_refining" && typeof createRefiningSessionState === "function"
        ? createRefiningSessionState(taskDef, rootState.rng)
        : null,
    debate:
      taskDef.id === "dao_debate" && typeof createDaoDebateSessionState === "function"
        ? createDaoDebateSessionState(taskDef, activeTask, rootState.rng)
        : null,
    debatePresentation: {
      stage: "idle",
      revealTimerId: null,
    },
  };

  return { ok: true, enteredTask: true };
}

function createEmptyTaskRuntimeState() {
  return {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
    debate: null,
    debatePresentation: {
      stage: "idle",
      revealTimerId: null,
    },
  };
}

function getActiveTaskRuntime(rootState = state) {
  const runtime = rootState.taskRuntime;
  if (!runtime || typeof runtime !== "object") {
    return createEmptyTaskRuntimeState();
  }
  return runtime;
}

function getActiveTaskInstance(rootState = state) {
  const runtime = getActiveTaskRuntime(rootState);
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

function getActiveTaskDef(rootState = state) {
  const task = getActiveTaskInstance(rootState);
  if (task?.type && TASK_DEFS[task.type]) {
    return TASK_DEFS[task.type];
  }
  return findTaskDefByActivityId(getActiveTaskRuntime(rootState).mode, TASK_DEFS);
}

function getActiveRefiningSession(rootState = state) {
  const refining = getActiveTaskRuntime(rootState).refining;
  if (!refining) {
    return null;
  }
  if (refining.attempt && Array.isArray(refining.attempt.deck)) {
    return refining;
  }
  if (Array.isArray(refining.deck)) {
    return {
      roundIndex: 1,
      maxRounds: 1,
      totalScore: 0,
      roundResults: [],
      attempt: refining,
    };
  }
  return null;
}

function getActiveRefiningAttempt(rootState = state) {
  return getActiveRefiningSession(rootState)?.attempt || null;
}

function getActiveDaoDebateSession(rootState = state) {
  const debate = getActiveTaskRuntime(rootState).debate;
  return debate && Array.isArray(debate.hand) ? debate : null;
}

function createDaoDebatePresentationState() {
  return {
    stage: "idle",
    revealTimerId: null,
  };
}

function getDaoDebatePresentationState(rootState = state) {
  const runtime = getActiveTaskRuntime(rootState);
  if (!runtime.debatePresentation || typeof runtime.debatePresentation !== "object") {
    runtime.debatePresentation = createDaoDebatePresentationState();
  }
  return runtime.debatePresentation;
}

function clearDaoDebateRevealTimer(rootState = state) {
  const presentation = getDaoDebatePresentationState(rootState);
  if (presentation.revealTimerId) {
    clearTimeout(presentation.revealTimerId);
    presentation.revealTimerId = null;
  }
}

function getActiveTaskActivity(rootState = state) {
  const runtime = getActiveTaskRuntime(rootState);
  return getActivity(runtime.mode) || getActivity(getActiveTaskDef(rootState)?.activityId) || null;
}

function getTaskRemainingDays(rootState = state, task = getActiveTaskInstance(rootState)) {
  if (!task) {
    return 0;
  }
  return Math.max(0, Number(task.expiresOnDay || 0) - Number(rootState.day || 0) + 1);
}

function getTaskMarkLabel(mark) {
  return UI_TEXT.summary?.taskMarkLabels?.[mark] || UI_TEXT.summary?.taskMarkLabels?.default || mark || "任务";
}

function getRefiningCardLabel(cardOrType) {
  const type = typeof cardOrType === "string" ? cardOrType : cardOrType?.type;
  return REFINING_CARD_TYPES?.[type]?.label || type || UI_TEXT.task?.unknownMaterial || "未知材料";
}

function getTaskRequirementText(taskDef = getActiveTaskDef()) {
  const requirements = Object.entries(taskDef?.objective?.materialRequirements || {});
  if (!requirements.length) {
    return "";
  }
  return requirements
    .map(([type, count]) => `${count} × ${getRefiningCardLabel(type)}`)
    .join(" / ");
}

function getSelectedTaskCard(rootState = state) {
  const attempt = getActiveRefiningAttempt(rootState);
  if (!attempt?.selectedCardId) {
    return null;
  }
  return attempt.deck.find((card) => card.id === attempt.selectedCardId) || null;
}

function getTaskStatusText(rootState = state) {
  const taskText = UI_TEXT.task || {};
  const taskDef = getActiveTaskDef(rootState);
  if (taskDef?.id === "dao_debate") {
    const session = getActiveDaoDebateSession(rootState);
    if (!session) {
      return "论辩暂未就绪。";
    }
    const presentation = getDaoDebatePresentationState(rootState);
    if (presentation.stage === "player_only") {
      return "本轮结算中，请稍候。";
    }
    return Array.isArray(session.hand) && session.hand.length
      ? "请选择一张论辩牌回应当前追问。"
      : "本轮论辩牌已出尽，等待结算。";
  }
  const attempt = getActiveRefiningAttempt(rootState);
  if (!attempt) {
    return taskText.pending || "";
  }
  if (attempt.slots.every(Boolean)) {
    return taskText.ready || "";
  }
  const selectedCard = getSelectedTaskCard(rootState);
  if (selectedCard) {
    return typeof taskText.selectedCard === "function"
      ? taskText.selectedCard(getRefiningCardLabel(selectedCard))
      : getRefiningCardLabel(selectedCard);
  }
  return taskText.pending || "";
}

function getTaskActivityName(rootState = state, taskDef = getActiveTaskDef(rootState)) {
  const activityName = getActiveTaskActivity(rootState)?.name;
  if (activityName) {
    return activityName;
  }
  if (taskDef?.id === "dao_debate") {
    return UI_TEXT.task?.daoDebateTitle || "道法论辩";
  }
  return UI_TEXT.task?.title || "炼器委托";
}

function getTaskFlowHintText(rootState = state) {
  const taskDef = getActiveTaskDef(rootState);
  if (taskDef?.id === "dao_debate") {
    return getTaskStatusText(rootState);
  }
  return UI_TEXT.flow.taskHint || getTaskStatusText(rootState);
}

function resetTaskRuntimeForState(rootState = state) {
  clearDaoDebateRevealTimer(rootState);
  rootState.taskRuntime = createEmptyTaskRuntimeState();
}

function getTaskStatusLineText(rootState = state) {
  const taskDef = getActiveTaskDef(rootState);
  const activityName = getTaskActivityName(rootState, taskDef);
  if (taskDef?.id === "dao_debate") {
    return `第 ${rootState.day} 天论辩进行中：${activityName}`;
  }
  return typeof UI_TEXT.statusLine.task === "function"
    ? UI_TEXT.statusLine.task(rootState.day, activityName)
    : activityName;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addLog(title, body) {
  state.log.unshift({ day: state.day, title, body });
  state.log = state.log.slice(0, 18);
}

function pushTimeline(slotIndex, activity, notes) {
  state.timeline.unshift({ day: state.day, slot: getSlotLabel(slotIndex), activity: activity.name, notes });
  state.timeline = state.timeline.slice(0, 12);
}

function getActivity(id) {
  return ACTIVITIES.find((activity) => activity.id === id);
}

function getEditableScheduleStats(schedule = state.schedule, scheduleLocks = state.scheduleLocks) {
  const total = scheduleLocks.filter((locked) => !locked).length;
  const filled = schedule.reduce((count, activityId, index) => count + (!scheduleLocks[index] && activityId ? 1 : 0), 0);
  return { filled, total };
}

function getActivityKindLabel(activity) {
  return ACTIVITY_KIND_LABELS[activity?.kind] || "活动";
}

function getSlotMeta(index) {
  return SLOT_DEFS[index] || null;
}

function getSlotLabel(index) {
  return getSlotMeta(index)?.futureLabel || SLOT_NAMES[index] || getSlotMeta(index)?.label || "时段";
}

function getSlotTimeLabel(index) {
  return getSlotMeta(index)?.timeLabel || "";
}

function getSlotFullLabel(index) {
  const label = getSlotLabel(index);
  const timeLabel = getSlotTimeLabel(index);
  return timeLabel ? `${label} · ${timeLabel}` : label;
}

function getSkillZoneKey(skill) {
  return SKILL_ZONE_MAP[skill] || skill || null;
}

function getCourseCatalogEntry(id) {
  return COURSE_CATALOG.find((course) => course.id === id || course.activityId === id) || null;
}

function getActivityPreferredSlotText(activity) {
  const preferred = Array.isArray(activity?.preferred) ? activity.preferred : [];
  if (!preferred.length) {
    return "任意时段";
  }
  return preferred.map((index) => getSlotLabel(index)).filter(Boolean).join(" / ");
}

function getMemoryPieceMeta(piece) {
  return MEMORY_FRAGMENT_TYPES[piece?.type] || null;
}

function getMemoryPieceLabel(piece) {
  const meta = getMemoryPieceMeta(piece);
  if (!meta) {
    return piece?.type || "记忆碎片";
  }
  if (piece?.type === "focus" && piece.skill) {
    return `${meta.label} · ${SKILL_LABELS[piece.skill]}`;
  }
  return meta.label;
}

function getMemoryPieceDesc(piece) {
  const meta = getMemoryPieceMeta(piece);
  if (!meta) {
    return "";
  }
  if (piece?.type === "focus" && piece.skill) {
    return `${meta.desc} 当前携带方向：${SKILL_LABELS[piece.skill]}。`;
  }
  return meta.desc;
}

function getMemoryNodePrediction(nodeState) {
  return resolveMemoryStructureFromFragments(nodeState.fragments || [], MEMORY_FRAGMENT_TYPES, MEMORY_BUILD_RULES);
}

function getMemoryBuiltCount() {
  return state.memory.placementsToday.filter((item) => Boolean(item.builtStructure)).length;
}

function getMemoryPieceZone(piece) {
  return resolvePlacementZoneForPiece(piece, MEMORY_FRAGMENT_TYPES, getMainFocusSkill);
}

function getMemoryPieceZoneLabel(piece) {
  const zoneKey = getMemoryPieceZone(piece);
  return zoneKey ? MEMORY_ZONE_META[zoneKey]?.label || "" : "";
}

function getMemoryPieceColor(piece) {
  const zoneKey = getMemoryPieceZone(piece);
  if (zoneKey && MEMORY_ZONE_META[zoneKey]?.color) {
    return MEMORY_ZONE_META[zoneKey].color;
  }
  return getMemoryPieceMeta(piece)?.accent || "#89bbff";
}

function getMemoryPieceTooltip(piece) {
  const zoneLabel = getMemoryPieceZoneLabel(piece);
  const zoneLine = zoneLabel ? `可放置分区：${zoneLabel} / 灵台核心` : "";
  return [getMemoryPieceLabel(piece), getMemoryPieceDesc(piece), zoneLine].filter(Boolean).join("\n");
}

function hashTextSeed(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildMemoryShardLayout(pieces) {
  const count = pieces.length;
  if (!count) {
    return [];
  }

  const columns = count <= 2 ? count : 3;
  const rows = count <= 2 ? 1 : Math.ceil(count / columns);
  const cellWidth = 100 / columns;
  const cellHeight = 100 / rows;
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        left: (column + 0.5) * cellWidth,
        top: (row + 0.5) * cellHeight,
      });
    }
  }

  const availableCells = cells.slice();
  return pieces.map((piece, index) => {
    const hash = hashTextSeed(`${piece.id}:${piece.type}:${index}:${count}`);
    const slotIndex = availableCells.length ? hash % availableCells.length : 0;
    const base = availableCells.splice(slotIndex, 1)[0] || cells[index % cells.length];
    const jitterLimitX = columns >= 4 ? 2.8 : 4.2;
    const jitterLimitY = rows >= 4 ? 2.4 : 3.6;
    const xJitter = ((hash >>> 3) % 1000) / 1000 * jitterLimitX * 2 - jitterLimitX;
    const yJitter = ((hash >>> 11) % 1000) / 1000 * jitterLimitY * 2 - jitterLimitY;
    const rotate = ((hash >>> 19) % 22) - 11;
    const scale = (getMemoryPieceMeta(piece)?.scale || 1) * (0.95 + (((hash >>> 24) % 8) / 100));
    return {
      left: Number(Math.max(12, Math.min(88, base.left + xJitter)).toFixed(2)),
      top: Number(Math.max(14, Math.min(86, base.top + yJitter)).toFixed(2)),
      rotate,
      scale: Number(scale.toFixed(2)),
      zIndex: 2 + index,
    };
  });
}

function renderMemoryShardField() {
  const layout = buildMemoryShardLayout(state.memory.pieces);
  return state.memory.pieces
    .map((piece, index) => {
      const meta = getMemoryPieceMeta(piece);
      const scatter = layout[index];
      const skillBadge = piece.type === "focus" && piece.skill ? `<span class="memory-shard-badge">${SKILL_LABELS[piece.skill]}</span>` : "";
      return `
        <button
          class="memory-shard ${piece.id === state.memory.selectedPiece ? "active" : ""} ${piece.id === state.memory.dragPieceId ? "dragging" : ""} ${piece.used ? "disabled" : ""}"
          type="button"
          data-piece="${piece.id}"
          data-type="${piece.type}"
          draggable="${piece.used ? "false" : "true"}"
          ${piece.used ? "disabled" : ""}
          style="left:${scatter.left}%;top:${scatter.top}%;transform:translate(-50%, -50%) rotate(${scatter.rotate}deg) scale(${scatter.scale});--shard-color:${getMemoryPieceColor(piece)};--shard-shape:${meta?.shape || "polygon(24% 6%, 76% 6%, 100% 50%, 76% 94%, 24% 94%, 0% 50%)"};z-index:${piece.id === state.memory.selectedPiece || piece.id === state.memory.dragPieceId ? 30 + index : scatter.zIndex};"
          title="${getMemoryPieceTooltip(piece)}"
          aria-label="${getMemoryPieceLabel(piece)}"
        >
          <span class="memory-shard-shape" aria-hidden="true"></span>
          ${skillBadge}
        </button>
      `;
    })
    .join("");
}

function getPlanningScheduleFilledText(filled, total) {
  if (total <= 0) {
    return "今天没有可自由安排的时段。";
  }
  return `自由时段已填写 ${filled} / ${total} 个。`;
}

function getPlanningScheduleHintText(filled, total) {
  if (total <= 0) {
    return "今天只有固定课程，可以直接执行当天。";
  }
  return filled === total ? "今天的自由时段已经排满，可以直接执行当天。" : "先把今天的自由时段补满，再进入白天结算。";
}

function getFlowHotkeysText() {
  if (state.mode === "task") {
    return "Arrow keys switch task controls / Space or Enter activates / F fullscreen";
  }
  return `快捷键：1-${SLOT_NAMES.length} 选时段，空格填入活动；白天推进按空格/Enter，P 切自动播放；F 全屏。`;
}

function getResolvingProgressText(done) {
  return `已完成 ${done} / ${SLOT_NAMES.length} 个时段。`;
}

function getPlanningProgressText(filled, total) {
  if (total <= 0) {
    return "今日无自由时段";
  }
  return `已安排 ${filled} / ${total} 个自由时段。`;
}

function getWeekdayLabel(day) {
  return WEEKDAY_LABELS[day - 1] || `第 ${day} 天`;
}

function getCourseBlockTimingText(block) {
  const dayLabels = (block.days || []).map((day) => getWeekdayLabel(day)).join(" / ");
  return `${getSlotFullLabel(block.slotIndex)} · ${dayLabels}`;
}

function getCourseBlockCategoryLabel(block) {
  return COURSE_CATEGORY_LABELS[block?.category] || block?.groupLabel || "课程";
}

function getCourseSkillColor(activity) {
  if (!activity?.skill) {
    return "#89bbff";
  }
  const zoneKey = getSkillZoneKey(activity.skill);
  return MEMORY_ZONE_META[zoneKey]?.color || "#89bbff";
}

function isPlanningSlotLocked(index) {
  return Boolean(state.scheduleLocks[index]);
}

function renderWeeklyTimetable() {
  const rows = SLOT_NAMES.map((slotName, slotIndex) => {
    const cells = state.weeklyTimetable
      .map((daySchedule, dayIndex) => {
        const activity = getActivity(daySchedule?.[slotIndex]);
        return `
          <div class="week-cell ${dayIndex + 1 === state.day ? "current-day" : ""} ${activity ? "fixed" : "free"}">
            ${activity ? `<strong>${activity.name}</strong>` : `<small>自由</small>`}
          </div>
        `;
      })
      .join("");

    return `
      <div class="week-slot-label">
        <strong>${slotName}</strong>
      </div>
      ${cells}
    `;
  }).join("");

  return `
    <div class="weekly-timetable-shell">
      <div class="panel-title">
        <h3>本周固定课表</h3>
        <span class="badge">${getWeekdayLabel(state.day)}</span>
      </div>
      <div class="weekly-timetable-scroll">
        <div class="weekly-timetable-grid">
          <div class="week-corner">时段</div>
          ${Array.from({ length: state.totalDays }, (_, index) => `<div class="week-day-head ${index + 1 === state.day ? "current-day" : ""}">${getWeekdayLabel(index + 1)}</div>`).join("")}
          ${rows}
        </div>
      </div>
    </div>
  `;
}

function pickCourseSelection(blockId, courseId) {
  runSessionCommand({ type: "course/select", blockId, courseId });
  syncUi();
}

function confirmCourseSelection() {
  runSessionCommand({ type: "course/confirm" });
  syncUi();
}

function getArchetype(id) {
  return ARCHETYPES.find((item) => item.id === id);
}

function getMainFocusSkill() {
  const [skill, count] =
    Object.entries(state.today.focus).sort(
      (a, b) => b[1] - a[1] || state.skills[b[0]] - state.skills[a[0]] || a[0].localeCompare(b[0])
    )[0] || [];
  return count > 0 ? skill : null;
}

function runSessionCommand(command) {
  return dispatchSessionCommand(state, command, {
    ...sessionOptions,
    initialActivityId: getDefaultPlanningActivityId(state),
    courseSelectionBlocks: COURSE_SELECTION_BLOCKS,
    schedulePresets: SCHEDULE_PRESETS,
    defaultArchetypeId: ARCHETYPES[0].id,
    taskDefs: TASK_DEFS,
    copy: RUNTIME_COPY,
    uiText: UI_TEXT,
    getArchetype,
    getActivity,
    syncWeeklyTaskProgress: syncWeeklyTaskProgressForState,
    isActivityAssignable: isPlanningActivityAssignable,
    addLog,
    sessionOptions,
  });
}

function createDayFlowContext() {
  return {
    slotNames: SLOT_NAMES,
    skillLabels: SKILL_LABELS,
    uiText: UI_TEXT,
    copy: RUNTIME_COPY,
    storyBeats: STORY_BEATS,
    dayModifiers: DAY_MODIFIERS,
    randomEvents: RANDOM_EVENTS,
    fallbackActivityId: getDefaultPlanningActivityId(state),
    taskDefs: TASK_DEFS,
    getActivity,
    beginTaskActivityForSlot,
    handleResolvedCourseTaskProgress: handleResolvedCourseTaskProgressFromRuntime,
    getMainFocusSkill,
    addLog,
    pushTimeline,
    enterMemoryPhase,
    createTodayState,
    areAllScheduleSlotsFilled,
  };
}

function createNightFlowContext(pieceId = state.memory.selectedPiece) {
  return {
    layout: MEMORY_HEX_LAYOUT,
    memoryTypes: MEMORY_TYPES,
    memoryFragmentTypes: MEMORY_FRAGMENT_TYPES,
    memoryBuildRules: MEMORY_BUILD_RULES,
    skillLabels: SKILL_LABELS,
    uiText: UI_TEXT,
    copy: RUNTIME_COPY,
    slotCount: SLOT_NAMES.length,
    defaultFreeActivityId: getDefaultPlanningActivityId(state),
    getDefaultPlanningActivityId,
    pieceId,
    getMainFocusSkill,
    addLog,
    expireTimedTasksForDay: expireTimedTasksForDayForState,
    finishWeek,
    finishRun,
  };
}

function createSummaryContext() {
  return {
    copy: RUNTIME_COPY,
    skillLabels: SKILL_LABELS,
    rankThresholds: RANK_THRESHOLDS,
    addLog,
  };
}

function createStateExportContext() {
  return {
    layout: MEMORY_HEX_LAYOUT,
    slotNames: SLOT_NAMES,
    uiText: UI_TEXT,
    getActivity,
    getResolvingSegments,
    normalizeMemoryCursor,
    isValidPlacement,
  };
}

function getSummaryWeek() {
  return Number(state.summary?.week || state.week || 1);
}

function getSummaryTotalWeeks() {
  return Number(state.summary?.totalWeeks || state.totalWeeks || 1);
}

function chooseArchetype(id) {
  runSessionCommand({ type: "archetype/select", archetypeId: id });
  syncUi();
}

function changeArchetype(delta) {
  const currentIndex = ARCHETYPES.findIndex((item) => item.id === state.selectedArchetype);
  const nextIndex = (currentIndex + delta + ARCHETYPES.length) % ARCHETYPES.length;
  chooseArchetype(ARCHETYPES[nextIndex].id);
}

function applyArchetypeIfNeeded() {
  runSessionCommand({ type: "archetype/apply" });
}

function normalizeState() {
  normalizePlayerState(state);
}

function applyEffectBundle(bundle) {
  applyEffectBundleToRoot(state, bundle);
}

function startRun() {
  runSessionCommand({ type: "run/start" });
  syncUi();
}

function fillPreset(presetId) {
  const changed = runSessionCommand({ type: "schedule/apply-preset", presetId });
  syncUi();
  return Boolean(changed);
}

function getRecommendedSchedulePresets(rootState = state) {
  const presetIdsByArchetype = {
    scholar: ["balanced", "body_expand"],
    mechanist: ["craft_rush", "balanced"],
    blade: ["body_expand", "balanced"],
  };
  const preferredIds = presetIdsByArchetype[rootState.selectedArchetype] || [];
  const picked = preferredIds
    .map((id) => SCHEDULE_PRESETS.find((preset) => preset.id === id))
    .filter(Boolean);
  if (picked.length) {
    return picked;
  }
  return SCHEDULE_PRESETS.slice(0, 2);
}

function pickRecommendedFallbackActivityId(slotIndex, rootState = state) {
  const byArchetype = {
    scholar: ["homework", "walk_city", "wash"],
    mechanist: ["part_time", "homework", "wash"],
    blade: ["training", "walk_city", "homework"],
  };
  const bySlot = [
    ["wash", "training", "homework"],
    ["homework", "training", "part_time"],
    ["cafeteria", "homework", "walk_city"],
    ["homework", "part_time", "training"],
    ["walk_city", "training", "part_time"],
    ["homework", "wash", "walk_city"],
  ];
  const candidates = [
    ...(bySlot[slotIndex] || []),
    ...(byArchetype[rootState.selectedArchetype] || []),
    getDefaultPlanningActivityId(rootState),
  ];

  for (const activityId of candidates) {
    if (!activityId) {
      continue;
    }
    const activity = getActivity(activityId);
    if (isPlanningActivityAssignable(rootState, activity)) {
      return activityId;
    }
  }
  return null;
}

function fillEmptyRecommendedSlots(rootState = state) {
  if (rootState.mode !== "planning") {
    return false;
  }
  const originalSlot = rootState.selectedSlot;
  const originalActivity = rootState.selectedActivity;
  let changed = false;

  for (let index = 0; index < rootState.schedule.length; index += 1) {
    if (rootState.scheduleLocks[index] || rootState.schedule[index]) {
      continue;
    }
    const fallbackActivityId = pickRecommendedFallbackActivityId(index, rootState);
    if (!fallbackActivityId) {
      continue;
    }
    runSessionCommand({ type: "schedule/set-slot", index });
    changed = runSessionCommand({ type: "schedule/assign-activity", activityId: fallbackActivityId }) || changed;
  }

  runSessionCommand({ type: "schedule/set-slot", index: originalSlot });
  if (isPlanningActivityAssignable(rootState, getActivity(originalActivity))) {
    rootState.selectedActivity = originalActivity;
  }
  return Boolean(changed);
}

function applyQuickPreset(presetId) {
  const applied = runSessionCommand({ type: "schedule/apply-preset", presetId });
  const filled = fillEmptyRecommendedSlots();
  syncUi();
  return Boolean(applied || filled);
}

function applyRecommendedPreset() {
  const first = getRecommendedSchedulePresets()[0];
  if (!first) {
    return false;
  }
  return applyQuickPreset(first.id);
}

function canCopyPreviousDaySchedule(rootState = state) {
  if (rootState.mode !== "planning" || rootState.day <= 1) {
    return false;
  }
  return Array.isArray(rootState.dayScheduleHistory?.[rootState.day - 1]);
}

function copyPreviousDaySchedule() {
  const copied = runSessionCommand({ type: "schedule/copy-previous-day", day: state.day - 1 });
  syncUi();
  return Boolean(copied);
}

function clearSchedule() {
  runSessionCommand({ type: "schedule/clear" });
  syncUi();
}

function setSlot(index) {
  runSessionCommand({ type: "schedule/set-slot", index });
  syncUi();
}

function assignActivity(activityId) {
  runSessionCommand({ type: "schedule/assign-activity", activityId });
  syncUi();
}

function cycleSelectedActivity(delta) {
  const planningActivities = getPlanningActivities();
  if (state.scheduleLocks[state.selectedSlot] || !planningActivities.length) {
    return;
  }
  const currentIndex = Math.max(
    0,
    planningActivities.findIndex((activity) => activity.id === state.selectedActivity)
  );
  const nextIndex = (currentIndex + delta + planningActivities.length) % planningActivities.length;
  state.selectedActivity = planningActivities[nextIndex].id;
  syncUi();
}

function allSlotsFilled() {
  return areAllScheduleSlotsFilled(state.schedule);
}

function buildDayModifier() {
  return findDayModifier(DAY_MODIFIERS, state);
}

function startDay() {
  startDayFlow(state, createDayFlowContext());
  syncUi();
}

function getResolvingSlotActivity(slotIndex) {
  return getResolvingSlotActivityFromRuntime(state, slotIndex, getActivity, ACTIVITIES[0].id);
}

function pushResolvingStory(title, body, speaker) {
  pushResolvingStoryToState(state, { title, body, speaker });
}

function resetResolvingStoryTrail() {
  resetResolvingStoryTrailOnState(state);
}

function showResolvingLead(slotIndex) {
  showResolvingLeadForSlot(state, slotIndex, createDayFlowContext());
}

function getResolvingSegments(slotIndex) {
  return getResolvingSegmentsForSlot(state, slotIndex, createDayFlowContext());
}

function appendResolvingSegment(slotIndex) {
  return appendResolvingSegmentForSlot(state, slotIndex, createDayFlowContext());
}

function resolveSlotForFlow(slotIndex) {
  resolveSlotForFlowState(state, slotIndex, createDayFlowContext());
}

function advanceResolvingFlow() {
  advanceResolvingFlowState(state, createDayFlowContext());
  syncUi();
}

function toggleResolvingAutoplay(force) {
  toggleResolvingAutoplayOnState(state, force);
  syncUi();
}

function getRandomEventRuntime() {
  if (!state.randomEventRuntime || typeof state.randomEventRuntime !== "object") {
    state.randomEventRuntime =
      typeof createRandomEventRuntimeState === "function"
        ? createRandomEventRuntimeState()
        : { stage: "idle" };
  }
  return state.randomEventRuntime;
}

function isRandomEventActive() {
  const stage = state.randomEventRuntime?.stage;
  return state.mode === "resolving" && stage && stage !== "idle";
}

function focusRandomEventChoice(delta = 1) {
  const runtime = getRandomEventRuntime();
  if (runtime.stage !== "prompt") {
    return false;
  }
  const choices = Array.isArray(runtime.pendingEvent?.choices) ? runtime.pendingEvent.choices : [];
  if (!choices.length) {
    return false;
  }
  const currentIndex = Number.isInteger(runtime.focusedChoiceIndex) ? runtime.focusedChoiceIndex : 0;
  const nextIndex = (currentIndex + delta + choices.length) % choices.length;
  runtime.focusedChoiceIndex = nextIndex;
  syncUi();
  const buttons = infoModal.querySelectorAll("[data-random-event-choice]");
  const target = buttons[nextIndex];
  if (target) {
    target.focus();
  }
  return true;
}

function activateRandomEventChoice() {
  const runtime = getRandomEventRuntime();
  if (runtime.stage !== "prompt") {
    return false;
  }
  const choices = Array.isArray(runtime.pendingEvent?.choices) ? runtime.pendingEvent.choices : [];
  if (!choices.length) {
    return false;
  }
  const currentIndex = Number.isInteger(runtime.focusedChoiceIndex) ? runtime.focusedChoiceIndex : 0;
  const choiceId = choices[currentIndex]?.id;
  if (!choiceId) {
    return false;
  }
  const result = chooseRandomEventOptionForFlowState(state, choiceId, createDayFlowContext());
  if (result?.ok) {
    syncUi();
  }
  return Boolean(result?.ok);
}

function confirmRandomEventResult() {
  const runtime = getRandomEventRuntime();
  if (runtime.stage !== "result") {
    return false;
  }
  const result = confirmRandomEventResultForFlowState(state, createDayFlowContext());
  if (result?.ok) {
    syncUi();
  }
  return Boolean(result?.ok);
}

function update(dt) {
  state.scenePulse += dt;
  if (isRandomEventActive()) {
    return;
  }
  if (state.mode !== "resolving" || !state.resolvingFlow.autoplay) {
    return;
  }
  state.resolvingFlow.autoplayTimer += dt;
  if (state.resolvingFlow.autoplayTimer >= state.resolvingFlow.autoplayDelay) {
    advanceResolvingFlow();
  }
}

function applyActivity(activity, slotIndex) {
  return applyActivityToState(state, activity, slotIndex, {
    copy: RUNTIME_COPY,
    storyBeats: STORY_BEATS,
    slotNames: SLOT_NAMES,
    skillLabels: SKILL_LABELS,
    getMainFocusSkill,
    addLog,
  });
}

function storyBeatMatches(beat, activity) {
  return storyBeatMatchesState(state, beat, activity);
}

function triggerStoryBeats(activity, notes) {
  triggerStoryBeatForActivity(state, activity, notes, STORY_BEATS);
}

function buildMemoryPieces() {
  return buildMemoryPiecesForState(state, createNightFlowContext());
}

function normalizeMemoryCursor(cursor = state.memory.cursor) {
  return normalizeMemoryCursorOnLayout(MEMORY_HEX_LAYOUT, cursor);
}

function resolveMemoryTarget(target) {
  return resolveMemoryTargetOnLayout(MEMORY_HEX_LAYOUT, target);
}

function isValidNodePlacement(piece, nodeId) {
  return isValidNodePlacementForState(state, MEMORY_FRAGMENT_TYPES, MEMORY_BUILD_RULES, piece, nodeId, getMainFocusSkill);
}

function isValidBridgePlacement(edgeId) {
  return isValidBridgePlacementForState(state, MEMORY_HEX_LAYOUT, edgeId);
}

function isValidPlacement(piece, target) {
  return isValidMemoryPlacement(
    state,
    MEMORY_HEX_LAYOUT,
    MEMORY_FRAGMENT_TYPES,
    MEMORY_BUILD_RULES,
    piece,
    target,
    getMainFocusSkill
  );
}

function selectMemoryPiece(pieceId) {
  if (selectMemoryPieceOnState(state, pieceId)) {
    syncUi();
  }
}

function startMemoryDrag(pieceId) {
  startMemoryDragOnState(state, pieceId);
}

function endMemoryDrag() {
  if (endMemoryDragOnState(state)) {
    syncUi();
  }
}

function moveMemoryCursor(dx, dy) {
  if (moveMemoryCursorOnState(state, MEMORY_HEX_LAYOUT, dx, dy)) {
    syncUi();
  }
}

function cycleMemoryPiece(delta) {
  if (cycleMemoryPieceOnState(state, delta)) {
    syncUi();
  }
}

function enterMemoryPhase() {
  enterMemoryPhaseState(state, createNightFlowContext());
  syncUi();
}

function placeMemoryPiece(target, pieceId = state.memory.selectedPiece) {
  const result = placeMemoryPieceInFlow(state, target, createNightFlowContext(pieceId));
  if (!result.ok && result.reason === "invalid_piece_or_target") {
    return;
  }
  syncUi();
}

function endNight() {
  finishNightFlow(state, createNightFlowContext());
  syncUi();
}

function computeRank() {
  return computeRankForState(state, RANK_THRESHOLDS);
}

function finishWeek() {
  const transition = buildWeekTransitionState(state);
  const routeStressBefore = structuredClone(state.routeStress || { study: 0, work: 0, training: 0 });

  state.weekTracker = {
    week: transition.week,
    totalWeeks: transition.totalWeeks,
    canContinue: transition.canContinue,
    dominantRoute: transition.dominantRoute,
    routeStressBefore,
    routeStressAfter: structuredClone(transition.routeStress),
    weekActions: transition.weekActions.slice(),
  };
  state.strategyHistory.push(structuredClone(transition.weeklyReport));
  state.routeStress = structuredClone(transition.routeStress);
  finishRunState(state, createSummaryContext());
  if (!state.summary?.canContinue) {
    state.finalSummary = structuredClone(state.summary);
  }
  syncUi();
}

function finishRun() {
  finishWeek();
}

function continueWeek() {
  const ok = runSessionCommand({ type: "run/continue-week" });
  syncUi();
  return ok;
}

function restartGame() {
  runSessionCommand({ type: "run/restart" });
  syncUi();
}

function revealOrSelectTaskCard(cardId) {
  if (state.mode !== "task") {
    return false;
  }
  const attempt = getActiveRefiningAttempt(state);
  if (!attempt) {
    return false;
  }
  const card = attempt.deck.find((item) => item.id === cardId);
  if (!card || card.used) {
    return false;
  }
  if (!card.revealed) {
    const revealed = revealRefiningCard(attempt, cardId);
    if (revealed) {
      attempt.selectedCardId = null;
      syncUi();
    }
    return revealed;
  }
  attempt.selectedCardId = attempt.selectedCardId === cardId ? null : cardId;
  syncUi();
  return true;
}

function placeSelectedTaskCard(slotIndex) {
  if (state.mode !== "task") {
    return false;
  }
  const attempt = getActiveRefiningAttempt(state);
  if (!attempt?.selectedCardId) {
    return false;
  }
  const placed = placeRefiningCardInSlot(attempt, attempt.selectedCardId, slotIndex);
  if (!placed) {
    return false;
  }
  attempt.selectedCardId = null;
  syncUi();
  return true;
}

function finishTaskAttempt(result) {
  const runtime = getActiveTaskRuntime(state);
  const task = getActiveTaskInstance(state);
  const taskDef = getActiveTaskDef(state);
  const activity = getActiveTaskActivity(state);
  if (!task || !taskDef || !activity) {
    resetTaskRuntimeForState(state);
    state.mode = "resolving";
    state.scene = "resolving";
    syncUi();
    return false;
  }

  const roundOutcome =
    typeof applyRefiningTaskRound === "function"
      ? applyRefiningTaskRound(state, result, { taskDef, rng: state.rng })
      : { status: result.success ? "success" : "failure", finalResult: result, session: runtime.refining };

  runtime.refining = roundOutcome.session;

  if (roundOutcome.status === "continue") {
    runtime.result = result;
    state.tasks.lastStory = {
      title: `${activity.name} · 第 ${Math.max(1, Number(roundOutcome.session?.roundIndex || 1) - 1)} 轮完成`,
      body: `本轮 ${result.score} 分，累计 ${roundOutcome.session?.totalScore || 0} 分，进入下一轮。`,
      speaker: "mentor",
    };
    syncUi();
    return true;
  }

  const finalResult = roundOutcome.finalResult || result;
  if (finalResult.success) {
    applyEffectBundle(taskDef.rewards);
    normalizeState();
    const summaryMark = taskDef.rewards?.summaryMark;
    if (summaryMark && !state.tasks.completedMarks.includes(summaryMark)) {
      state.tasks.completedMarks.push(summaryMark);
    }
    task.status = "completed";
    task.rewardClaimed = true;
  }

  const detail = RUNTIME_COPY.taskAttemptResult(taskDef.id, {
    taskName: activity.name,
    success: finalResult.success,
    score: finalResult.score,
    recipeKey: finalResult.recipeKey,
    objectiveName: taskDef.objective?.name,
    remainingDays: getTaskRemainingDays(state, task),
  });
  const slotIndex = Number.isInteger(runtime.pendingSlotIndex)
    ? runtime.pendingSlotIndex
    : Math.min(state.resolvingFlow.slotIndex, SLOT_NAMES.length - 1);

  pushTimeline(slotIndex, activity, detail.body);
  addLog(detail.title, detail.body);
  state.tasks.lastStory = structuredClone(detail);
  resumeResolvingAfterTaskAttempt(state, detail, {
    slotNames: SLOT_NAMES,
    uiText: UI_TEXT,
    resetTaskRuntime: resetTaskRuntimeForState,
  });
  syncUi();
  return true;
}

function resolveDaoDebateTaskAttemptAfterReveal(resolvedSession) {
  const task = getActiveTaskInstance(state);
  const taskDef = getActiveTaskDef(state);
  const activity = getActiveTaskActivity(state);
  if (!task || !taskDef || !resolvedSession?.result) {
    return false;
  }

  task.attemptCount = Number(task.attemptCount || 0) + 1;
  if (resolvedSession.result.status === "success") {
    applyEffectBundle(taskDef.rewards);
    normalizeState();
    const summaryMark = taskDef.rewards?.summaryMark;
    if (summaryMark && !state.tasks.completedMarks.includes(summaryMark)) {
      state.tasks.completedMarks.push(summaryMark);
    }
    task.status = "completed";
    task.rewardClaimed = true;
  }

  const detail = RUNTIME_COPY.taskAttemptResult(taskDef.id, {
    taskName: activity?.name || UI_TEXT.task?.daoDebateTitle || "道法论辩",
    success: resolvedSession.result.status === "success",
    conviction: resolvedSession.result.conviction,
    exposure: resolvedSession.result.exposure,
    remainingDays: getTaskRemainingDays(state, task),
  });

  const slotIndex = Number.isInteger(state.taskRuntime?.pendingSlotIndex)
    ? state.taskRuntime.pendingSlotIndex
    : Math.min(state.resolvingFlow?.slotIndex || 0, SLOT_NAMES.length - 1);

  pushTimeline(slotIndex, activity || { name: detail.title }, detail.body);
  addLog(detail.title, detail.body);
  state.tasks.lastStory = structuredClone(detail);
  resumeResolvingAfterTaskAttempt(state, detail, {
    slotNames: SLOT_NAMES,
    uiText: UI_TEXT,
    resetTaskRuntime: resetTaskRuntimeForState,
  });
  syncUi();
  return true;
}

function scheduleDaoDebateReplyReveal(resolvedSession) {
  const presentation = getDaoDebatePresentationState(state);
  clearDaoDebateRevealTimer(state);
  presentation.revealTimerId = setTimeout(() => {
    const runtime = getActiveTaskRuntime(state);
    if (state.mode !== "task" || runtime.mode !== "dao_debate_task") {
      return;
    }
    const nextPresentation = getDaoDebatePresentationState(state);
    nextPresentation.revealTimerId = null;
    nextPresentation.stage = "full";
    if (resolvedSession?.result) {
      resolveDaoDebateTaskAttemptAfterReveal(resolvedSession);
      return;
    }
    syncUi();
  }, DAO_DEBATE_REPLY_REVEAL_MS);
}

function playDaoDebateCardFromUi(cardId) {
  if (state.mode !== "task") {
    return false;
  }
  const taskDef = getActiveTaskDef(state);
  const session = getActiveDaoDebateSession(state);
  if (!taskDef || !session || typeof playDaoDebateCard !== "function") {
    return false;
  }

  const presentation = getDaoDebatePresentationState(state);
  if (presentation.stage === "player_only") {
    return false;
  }

  const nextSession = playDaoDebateCard(session, cardId, taskDef);
  if (nextSession === session) {
    return false;
  }
  state.taskRuntime.debate = nextSession;
  presentation.stage = "player_only";
  scheduleDaoDebateReplyReveal(nextSession);
  syncUi();
  return true;
}

function confirmTaskAttempt() {
  if (state.mode !== "task") {
    return false;
  }
  const attempt = getActiveRefiningAttempt(state);
  const taskDef = getActiveTaskDef(state);
  if (!attempt || !taskDef) {
    return false;
  }
  const result = resolveRefiningAttempt(attempt, taskDef);
  if (!result?.complete) {
    syncUi();
    return false;
  }
  return finishTaskAttempt(result);
}

function getTaskControlElements() {
  return Array.from(mainPanel.querySelectorAll("[data-task-control]")).filter((element) => !element.disabled);
}

function focusTaskControl(delta = 1) {
  if (state.mode !== "task") {
    return false;
  }
  const controls = getTaskControlElements();
  if (!controls.length) {
    return false;
  }
  const activeIndex = controls.indexOf(document.activeElement);
  if (activeIndex < 0) {
    controls[delta < 0 ? controls.length - 1 : 0].focus();
    return true;
  }
  const nextIndex = (activeIndex + delta + controls.length) % controls.length;
  controls[nextIndex].focus();
  return true;
}

function activateTaskControl() {
  if (state.mode !== "task") {
    return false;
  }
  const controls = getTaskControlElements();
  if (!controls.length) {
    return false;
  }
  const target = controls.includes(document.activeElement) ? document.activeElement : controls[0];
  target.focus();
  target.click();
  return true;
}

function render() {
  drawBackground();
  drawScene();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, CANVAS_THEME.backgroundTop);
  gradient.addColorStop(0.45, CANVAS_THEME.backgroundMid);
  gradient.addColorStop(1, CANVAS_THEME.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 44; i += 1) {
    const x = (i * 71 + Math.sin(state.scenePulse * 0.6 + i) * 18 + 40) % canvas.width;
    const y = (i * 29 + Math.cos(state.scenePulse * 0.4 + i) * 22 + 50) % canvas.height;
    ctx.fillStyle = `rgba(117,101,72,${0.03 + ((i % 7) * 0.006)})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScene() {
  if (state.mode === "menu") {
    drawMenuScene();
    return;
  }
  if (state.mode === "course_selection") {
    drawCourseSelectionScene();
    return;
  }
  if (state.mode === "memory") {
    drawMemoryScene();
    return;
  }
  if (state.mode === "summary") {
    drawSummaryScene();
    return;
  }
  if (state.mode === "task") {
    drawTaskScene();
    return;
  }
  if (state.mode === "resolving") {
    drawResolvingScene();
    return;
  }
  drawPlanningScene();
}

function drawMenuScene() {
  drawAcademyBackdrop("#efe6d8", "#ddd0b8");
  drawBanner(UI_TEXT.canvas.menuTitle, UI_TEXT.canvas.menuSubtitle);
  drawFloatingCards(UI_TEXT.canvas.menuCards, 258);
}

function drawPlanningScene() {
  drawAcademyBackdrop("#f1eadc", "#ddd0b8");
  drawBanner(UI_TEXT.canvas.planningTitle(state.day), UI_TEXT.canvas.planningSubtitle);
  drawTimelineStrip();
  drawStatConstellation();
}

function drawCourseSelectionScene() {
  drawAcademyBackdrop("#f0e7d9", "#ddd0b8");
  drawBanner("开周选课", "先在整周课表里锁定固定课程，再进入每天的自由安排。");

  const originX = 84;
  const originY = 168;
  const labelWidth = 98;
  const cellWidth = 102;
  const cellHeight = 46;

  ctx.save();
  ctx.fillStyle = CANVAS_THEME.panelFill;
  ctx.fillRect(originX, originY, labelWidth + cellWidth * state.totalDays, cellHeight * (SLOT_NAMES.length + 1));

  ctx.fillStyle = CANVAS_THEME.panelMuted;
  ctx.font = "15px 'Microsoft YaHei'";
  ctx.fillText("时段", originX + 28, originY + 30);
  for (let day = 1; day <= state.totalDays; day += 1) {
    const x = originX + labelWidth + (day - 1) * cellWidth;
    ctx.fillStyle = day === state.day ? CANVAS_THEME.accentGold : CANVAS_THEME.panelText;
    ctx.fillText(getWeekdayLabel(day), x + 26, originY + 30);
  }

  SLOT_NAMES.forEach((slotName, slotIndex) => {
    const y = originY + cellHeight * (slotIndex + 1);
    ctx.fillStyle = CANVAS_THEME.panelFillStrong;
    ctx.fillRect(originX, y, labelWidth, cellHeight - 2);
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.fillText(slotName, originX + 24, y + 28);

    for (let day = 1; day <= state.totalDays; day += 1) {
      const activity = getActivity(state.weeklyTimetable[day - 1]?.[slotIndex]);
      const x = originX + labelWidth + (day - 1) * cellWidth;
      ctx.fillStyle = activity ? `${getCourseSkillColor(activity)}22` : CANVAS_THEME.slotIdleFill;
      ctx.fillRect(x, y, cellWidth - 4, cellHeight - 4);
      ctx.strokeStyle = activity ? `${getCourseSkillColor(activity)}aa` : CANVAS_THEME.panelStroke;
      ctx.strokeRect(x, y, cellWidth - 4, cellHeight - 4);
      ctx.fillStyle = activity ? CANVAS_THEME.panelText : CANVAS_THEME.panelMuted;
      ctx.font = activity ? "13px 'Microsoft YaHei'" : "12px 'Microsoft YaHei'";
      const text = activity ? activity.name.replace("上", "").replace("去", "") : "待选";
      ctx.fillText(text, x + 10, y + 27, cellWidth - 20);
    }
  });
  ctx.restore();
}

function drawResolvingScene() {
  const currentIndex = Math.min(state.resolvingFlow.slotIndex, SLOT_NAMES.length - 1);
  const current = getActivity(state.schedule[currentIndex]) || ACTIVITIES[0];
  const palettes = {
    lecture: ["#eef0e7", "#ddd4c2"],
    seminar: ["#efe7dd", "#ddd1c4"],
    workshop: ["#efe0d4", "#dbc9bc"],
    desk: ["#eee7da", "#d6cebf"],
    cafeteria: ["#f1e3d2", "#dcc6a6"],
    dorm: ["#ece7dc", "#d2cabb"],
    training: ["#e5ece5", "#ccd3c6"],
    arcade: ["#ebe4dc", "#d6cbbe"],
    city: ["#e8ece8", "#d0d4cb"],
    job: ["#eee2d2", "#dac8b2"],
  };
  const palette = palettes[current.scene] || ["#efe6d8", "#ddd0b8"];
  drawAcademyBackdrop(palette[0], palette[1]);
  drawBanner(UI_TEXT.canvas.resolvingTitle(state.day, current.name), UI_TEXT.canvas.resolvingSubtitle);

  const centerX = canvas.width * 0.3;
  const centerY = canvas.height * 0.62;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.fillStyle = CANVAS_THEME.panelFill;
  ctx.beginPath();
  ctx.arc(0, 0, 86 + Math.sin(state.scenePulse * 2.4) * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CANVAS_THEME.accentGold;
  ctx.beginPath();
  ctx.arc(0, -46, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CANVAS_THEME.panelFillStrong;
  ctx.fillRect(-24, -24, 48, 88);
  ctx.fillStyle =
    current.scene === "workshop"
      ? CANVAS_THEME.accentCinnabar
      : current.scene === "training"
        ? CANVAS_THEME.accentDaiqing
        : CANVAS_THEME.accentGold;
  ctx.fillRect(-54, 18, 108, 16);
  ctx.restore();

  ctx.fillStyle = CANVAS_THEME.panelText;
  ctx.font = "24px 'Microsoft YaHei'";
  ctx.fillText(UI_TEXT.canvas.resolvingSlot(getSlotLabel(currentIndex)), 470, 210);
  ctx.font = "18px 'Microsoft YaHei'";
  wrapText(current.summary, 470, 250, 360, 32, CANVAS_THEME.panelMuted);
  drawCanvasProgress(470, 330, 340, 16, state.progress);
  drawTimelineStrip();
}

function drawTaskScene() {
  const task = getActiveTaskInstance(state);
  const taskDef = getActiveTaskDef(state);
  const activityName = getTaskActivityName(state, taskDef);
  if (taskDef?.id === "dao_debate") {
    const session = getActiveDaoDebateSession(state);
    const presentation = getDaoDebatePresentationState(state);
    const latestExchange = session?.latestExchange || null;
    const playerLine = latestExchange?.playerLine || UI_TEXT.left?.daoDebateNoExchangeHint || "请先择一论点回应。";
    const replyLine = !latestExchange
      ? ""
      : presentation.stage === "full"
        ? latestExchange.replyLine || ""
        : UI_TEXT.left?.daoDebatePendingReply || "妙哉偶正在应答……";
    drawAcademyBackdrop("#efe6d8", "#d7c2a7");
    drawBanner(
      UI_TEXT.canvas.taskTitle(state.day, activityName),
      UI_TEXT.canvas.taskSubtitle(getTaskRemainingDays(state, task), "妙哉偶")
    );
    ctx.fillStyle = CANVAS_THEME.panelFill;
    ctx.fillRect(72, 180, 816, 300);
    ctx.strokeStyle = CANVAS_THEME.panelStroke;
    ctx.strokeRect(72, 180, 816, 300);
    ctx.font = "24px 'Microsoft YaHei'";
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.fillText(session?.currentPrompt?.title || "术可代德否", 112, 228);
    wrapText(session?.currentPrompt?.body || "", 112, 270, 736, 30, CANVAS_THEME.panelMuted);
    ctx.font = "18px 'Microsoft YaHei'";
    ctx.fillText(`立论 ${session?.conviction || 0}`, 672, 228);
    ctx.fillText(`破绽 ${session?.exposure || 0}`, 782, 228);
    ctx.strokeStyle = CANVAS_THEME.panelStroke;
    ctx.beginPath();
    ctx.moveTo(112, 338);
    ctx.lineTo(848, 338);
    ctx.stroke();
    ctx.font = "18px 'Microsoft YaHei'";
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.fillText(UI_TEXT.left?.daoDebatePlayerLabel || "你的回应", 112, 368);
    ctx.fillText(UI_TEXT.left?.daoDebateReplyLabel || "妙哉偶回应", 512, 368);
    wrapText(playerLine, 112, 398, 340, 24, CANVAS_THEME.panelText);
    wrapText(replyLine, 512, 398, 340, 24, CANVAS_THEME.panelMuted);
    return;
  }
  const attempt = getActiveRefiningAttempt(state);
  const stageView =
    attempt && typeof buildRefiningStageView === "function"
      ? buildRefiningStageView(attempt, REFINING_STAGE_LAYOUT)
      : { cards: [], slots: [] };
  const remainingDays = getTaskRemainingDays(state, task);
  const title =
    typeof UI_TEXT.canvas?.taskTitle === "function"
      ? UI_TEXT.canvas.taskTitle(state.day, activityName)
      : `第 ${state.day} 天 · ${activityName}`;
  const subtitle =
    typeof UI_TEXT.canvas?.taskSubtitle === "function"
      ? UI_TEXT.canvas.taskSubtitle(remainingDays, taskDef?.objective?.name || activityName)
      : `剩余 ${remainingDays} 天 · ${taskDef?.objective?.name || activityName}`;
  const taskAreaTop = 170;
  const taskAreaHeight = 340;
  const taskAreaBottom = taskAreaTop + taskAreaHeight;

  drawAcademyBackdrop("#f0e5d8", "#ddc7af");
  drawBanner(title, subtitle);

  ctx.fillStyle = CANVAS_THEME.panelFill;
  ctx.fillRect(56, taskAreaTop, 430, taskAreaHeight);
  ctx.strokeStyle = CANVAS_THEME.panelStroke;
  ctx.strokeRect(56, taskAreaTop, 430, taskAreaHeight);
  ctx.fillStyle = CANVAS_THEME.panelText;
  ctx.font = "22px 'Microsoft YaHei'";
  ctx.fillText("翻牌区", 82, taskAreaTop + 30);
  ctx.fillStyle = CANVAS_THEME.panelMuted;
  ctx.font = "14px 'Microsoft YaHei'";
  ctx.fillText("点击卡牌翻开，再点击已翻开的卡牌选中", 82, taskAreaTop + 58);

  stageView.cards.forEach((card) => {
    ctx.fillStyle = card.isUsed
      ? CANVAS_THEME.accentGoldSoft
      : card.revealed
        ? CANVAS_THEME.accentDaiqingSoft
        : CANVAS_THEME.slotIdleFill;
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.strokeStyle = card.isSelected
      ? CANVAS_THEME.accentGold
      : card.isUsed
        ? CANVAS_THEME.accentDaiqing
        : CANVAS_THEME.panelStroke;
    ctx.lineWidth = card.isSelected ? 3 : 1.5;
    ctx.strokeRect(card.x, card.y, card.width, card.height);

    ctx.textAlign = "center";
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.font = card.revealed ? "18px 'Microsoft YaHei'" : "28px 'Microsoft YaHei'";
    ctx.fillText(card.revealed ? getRefiningCardLabel(card) : "?", card.x + card.width / 2, card.y + 38);
    ctx.fillStyle = card.isUsed ? CANVAS_THEME.accentDaiqing : CANVAS_THEME.panelMuted;
    ctx.font = "12px 'Microsoft YaHei'";
    ctx.fillText(card.isUsed ? "已放入牌阵" : card.revealed ? "再次点击选中" : "点击翻开", card.x + card.width / 2, card.y + 64);
    ctx.textAlign = "left";
  });

  const slotCenters = stageView.slots.map((slot) => ({
    x: slot.x + slot.width / 2,
    y: slot.y + slot.height / 2,
  }));
  if (slotCenters.length === 3) {
    ctx.strokeStyle = CANVAS_THEME.accentGoldLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(slotCenters[0].x, slotCenters[0].y);
    ctx.lineTo(slotCenters[1].x, slotCenters[1].y);
    ctx.lineTo(slotCenters[2].x, slotCenters[2].y);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.fillStyle = CANVAS_THEME.panelFill;
  ctx.fillRect(534, taskAreaTop, 358, taskAreaHeight);
  ctx.strokeStyle = CANVAS_THEME.accentGoldLine;
  ctx.strokeRect(534, taskAreaTop, 358, taskAreaHeight);
  ctx.fillStyle = CANVAS_THEME.accentGold;
  ctx.font = "22px 'Microsoft YaHei'";
  ctx.fillText("三角牌阵", 560, taskAreaTop + 30);
  ctx.fillStyle = CANVAS_THEME.panelText;
  ctx.font = "15px 'Microsoft YaHei'";
  wrapText(taskDef?.objective?.name || activity.name, 560, taskAreaTop + 58, 304, 24, CANVAS_THEME.panelText);
  wrapText(getTaskRequirementText(taskDef) || activity.summary || "", 560, taskAreaTop + 104, 304, 22, CANVAS_THEME.panelMuted);

  stageView.slots.forEach((slot) => {
    const card = slot.cardId ? attempt?.deck?.find((entry) => entry.id === slot.cardId) : null;
    const cardLabel = card ? getRefiningCardLabel(card) : null;
    ctx.fillStyle = slot.cardId ? CANVAS_THEME.accentDaiqingSoft : CANVAS_THEME.slotIdleFill;
    ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
    ctx.strokeStyle = slot.cardId ? CANVAS_THEME.accentDaiqing : CANVAS_THEME.panelStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.font = "14px 'Microsoft YaHei'";
    ctx.fillText(`槽位 ${slot.index + 1}`, slot.x + 14, slot.y + 24);
    ctx.font = "18px 'Microsoft YaHei'";
    ctx.fillText(cardLabel || "待放置", slot.x + 14, slot.y + 52);
  });

  ctx.fillStyle = CANVAS_THEME.panelFillStrong;
  ctx.fillRect(560, taskAreaBottom - 36, 304, 30);
  ctx.fillStyle = CANVAS_THEME.panelText;
  ctx.font = "14px 'Microsoft YaHei'";
  ctx.fillText(
    getSelectedTaskCard(state)
      ? `当前选中：${getRefiningCardLabel(getSelectedTaskCard(state))}`
      : getTaskStatusText(state),
    572,
    taskAreaBottom - 16
  );
}

function drawMemoryScene() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#120d1d");
  gradient.addColorStop(0.45, "#1b2243");
  gradient.addColorStop(1, "#0a1322");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 18; i += 1) {
    const x = 70 + (i % 6) * 150 + Math.sin(state.scenePulse + i) * 10;
    const y = 90 + Math.floor(i / 6) * 120 + Math.cos(state.scenePulse * 1.2 + i) * 10;
    ctx.fillStyle = "rgba(137, 187, 255, 0.1)";
    ctx.fillRect(x, y, 100, 72);
  }

  drawBanner(UI_TEXT.canvas.memoryTitle, UI_TEXT.canvas.memorySubtitle);

  const counts = countBoardTypes();
  const x = 140;
  const baseY = 470;
  Object.entries(counts).forEach(([type, value], index) => {
    const meta = MEMORY_TYPES[type];
    ctx.fillStyle = meta.accent;
    for (let i = 0; i < value; i += 1) {
      const towerX = x + index * 130;
      const towerY = baseY - i * 34;
      ctx.fillRect(towerX, towerY, 68, 24);
    }
    ctx.fillStyle = "#dce8ff";
    ctx.font = "18px 'Microsoft YaHei'";
    ctx.fillText(meta.label, x + index * 130, 505);
  });
}

function drawSummaryScene() {
  const summaryWeek = getSummaryWeek();
  const summaryTotalWeeks = getSummaryTotalWeeks();
  const summaryTitle =
    typeof UI_TEXT.canvas.summaryTitle === "function"
      ? UI_TEXT.canvas.summaryTitle(summaryWeek, summaryTotalWeeks)
      : UI_TEXT.canvas.summaryTitle;
  const summarySubtitle =
    typeof UI_TEXT.canvas.summarySubtitle === "function"
      ? UI_TEXT.canvas.summarySubtitle(summaryWeek, summaryTotalWeeks)
      : UI_TEXT.canvas.summarySubtitle;
  drawAcademyBackdrop("#efe7d9", "#d9ccb3");
  drawBanner(summaryTitle, summarySubtitle);
  const rank = state.summary?.rank || UI_TEXT.summary.unranked;
  ctx.fillStyle = CANVAS_THEME.panelFill;
  ctx.fillRect(150, 160, 660, 240);
  ctx.strokeStyle = CANVAS_THEME.accentGoldLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 160, 660, 240);
  ctx.fillStyle = CANVAS_THEME.accentGold;
  ctx.font = "48px 'STZhongsong', 'Microsoft YaHei'";
  ctx.fillText(rank, 420, 255);
  ctx.fillStyle = CANVAS_THEME.panelText;
  ctx.font = "22px 'Microsoft YaHei'";
  ctx.fillText(UI_TEXT.canvas.summaryBest(SKILL_LABELS[state.summary.bestSkill[0]], state.summary.bestSkill[1]), 250, 310);
  wrapText(state.summary.majorBeat, 250, 350, 460, 30, CANVAS_THEME.panelMuted);
}

function drawAcademyBackdrop(topColor, bottomColor) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCourtyardFrame();
  drawRoofline();
  drawLatticeScreen();
  ctx.save();
  ctx.fillStyle = CANVAS_THEME.sceneSilhouette;
  for (let i = 0; i < 7; i += 1) {
    const x = 70 + i * 126;
    const width = 72 + (i % 2) * 24;
    const height = 120 + ((i + 1) % 4) * 44;
    ctx.fillRect(x, canvas.height - height - 18, width, height);
  }
  ctx.fillStyle = CANVAS_THEME.sunGlow;
  ctx.beginPath();
  ctx.arc(canvas.width - 192, 114, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CANVAS_THEME.sceneMist;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawCourtyardFrame() {
  ctx.save();
  const horizon = canvas.height * 0.58;
  const floorGradient = ctx.createLinearGradient(0, horizon, 0, canvas.height);
  floorGradient.addColorStop(0, "rgba(233,224,202,0.14)");
  floorGradient.addColorStop(0.34, "rgba(233,224,202,0.44)");
  floorGradient.addColorStop(1, CANVAS_THEME.floorGlow);
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  ctx.fillStyle = CANVAS_THEME.courtyardMist;
  ctx.fillRect(60, 126, canvas.width - 120, 236);
  ctx.fillStyle = "rgba(255,250,242,0.52)";
  ctx.fillRect(84, 148, canvas.width - 168, 44);

  ctx.strokeStyle = CANVAS_THEME.screenLine;
  ctx.lineWidth = 1;
  for (let index = 0; index < 10; index += 1) {
    const lineY = horizon + 18 + index * 20;
    ctx.beginPath();
    ctx.moveTo(56, lineY);
    ctx.lineTo(canvas.width - 56, lineY - 8);
    ctx.stroke();
  }

  ctx.fillStyle = CANVAS_THEME.roofShadow;
  ctx.fillRect(66, 118, 18, 284);
  ctx.fillRect(canvas.width - 84, 118, 18, 284);
  ctx.fillRect(canvas.width * 0.5 - 12, 170, 24, 232);
  ctx.restore();
}

function drawRoofline() {
  ctx.save();
  ctx.fillStyle = CANVAS_THEME.roofShadow;
  ctx.beginPath();
  ctx.moveTo(0, 104);
  ctx.lineTo(120, 78);
  ctx.lineTo(canvas.width * 0.5, 62);
  ctx.lineTo(canvas.width - 120, 78);
  ctx.lineTo(canvas.width, 104);
  ctx.lineTo(canvas.width, 134);
  ctx.lineTo(0, 134);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = CANVAS_THEME.roofEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 108);
  ctx.lineTo(152, 84);
  ctx.lineTo(canvas.width * 0.5, 68);
  ctx.lineTo(canvas.width - 152, 84);
  ctx.lineTo(canvas.width - 22, 108);
  ctx.stroke();
  ctx.restore();
}

function drawLatticeScreen() {
  ctx.save();
  const frameX = 94;
  const frameY = 142;
  const frameWidth = canvas.width - 188;
  const frameHeight = 220;
  ctx.strokeStyle = CANVAS_THEME.screenLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

  for (let index = 1; index < 5; index += 1) {
    const x = frameX + (frameWidth / 5) * index;
    ctx.beginPath();
    ctx.moveTo(x, frameY);
    ctx.lineTo(x, frameY + frameHeight);
    ctx.stroke();
  }

  for (let index = 1; index < 4; index += 1) {
    const y = frameY + (frameHeight / 4) * index;
    ctx.beginPath();
    ctx.moveTo(frameX, y);
    ctx.lineTo(frameX + frameWidth, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBanner(title, subtitle) {
  ctx.save();
  ctx.fillStyle = CANVAS_THEME.bannerFill;
  ctx.fillRect(48, 34, 860, 118);
  ctx.strokeStyle = CANVAS_THEME.bannerStroke;
  ctx.strokeRect(48, 34, 860, 118);
  ctx.strokeStyle = CANVAS_THEME.accentGoldLine;
  ctx.strokeRect(64, 48, 828, 90);
  ctx.fillStyle = CANVAS_THEME.accentGoldSoft;
  ctx.fillRect(816, 54, 56, 26);
  ctx.fillStyle = CANVAS_THEME.bannerTitle;
  ctx.font = "42px 'STZhongsong', 'Microsoft YaHei'";
  ctx.fillText(title, 74, 92);
  ctx.font = "18px 'Microsoft YaHei'";
  ctx.fillStyle = CANVAS_THEME.bannerSubtitle;
  ctx.fillText(subtitle, 74, 124);
  ctx.restore();
}

function drawFloatingCards(labels, y) {
  const cardWidth = 160;
  const cardGap = 16;
  const totalWidth = labels.length * cardWidth + Math.max(0, labels.length - 1) * cardGap;
  const startX = (canvas.width - totalWidth) / 2;
  labels.forEach((label, index) => {
    const x = startX + index * (cardWidth + cardGap) + Math.sin(state.scenePulse + index) * 6;
    const offsetY = y + Math.cos(state.scenePulse * 1.1 + index) * 4;
    ctx.save();
    ctx.strokeStyle = CANVAS_THEME.screenLine;
    ctx.beginPath();
    ctx.moveTo(x + 28, offsetY - 28);
    ctx.lineTo(x + 28, offsetY);
    ctx.moveTo(x + 132, offsetY - 28);
    ctx.lineTo(x + 132, offsetY);
    ctx.stroke();
    ctx.fillStyle = CANVAS_THEME.panelFillStrong;
    ctx.fillRect(x, offsetY, 160, 84);
    ctx.strokeStyle = CANVAS_THEME.accentGoldLine;
    ctx.strokeRect(x, offsetY, 160, 84);
    ctx.fillStyle = CANVAS_THEME.accentDaiqingSoft;
    ctx.fillRect(x + 10, offsetY + 10, 140, 10);
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.font = "21px 'Microsoft YaHei'";
    ctx.fillText(label, x + 24, offsetY + 52);
    ctx.restore();
  });
}

function drawTimelineStrip() {
  const gap = 12;
  const maxWidth = canvas.width - 96;
  const cardWidth = Math.max(108, Math.min(178, (maxWidth - gap * (SLOT_NAMES.length - 1)) / SLOT_NAMES.length));
  const startX = (canvas.width - (cardWidth * SLOT_NAMES.length + gap * (SLOT_NAMES.length - 1))) / 2;
  const y = 444;
  SLOT_NAMES.forEach((name, index) => {
    const x = startX + index * (cardWidth + gap);
    ctx.fillStyle = CANVAS_THEME.slotIdleFill;
    if (index < state.resolvingIndex) {
      ctx.fillStyle = CANVAS_THEME.slotDoneFill;
    }
    if (state.mode === "planning" && state.selectedSlot === index) {
      ctx.fillStyle = CANVAS_THEME.slotSelectedFill;
    }
    ctx.fillRect(x, y, cardWidth, 54);
    ctx.fillStyle = index === state.selectedSlot && state.mode === "planning" ? CANVAS_THEME.accentDaiqing : CANVAS_THEME.accentGold;
    ctx.fillRect(x + 12, y + 8, cardWidth - 24, 4);
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.font = `${SLOT_NAMES.length > 5 ? 16 : 18}px 'Microsoft YaHei'`;
    ctx.fillText(name, x + 16, y + 24);
    const activity = getActivity(state.schedule[index]);
    ctx.fillStyle = CANVAS_THEME.panelMuted;
    ctx.font = "14px 'Microsoft YaHei'";
    ctx.fillText(activity ? activity.name : UI_TEXT.common.unassigned, x + 16, y + 44);
  });
}

function drawStatConstellation() {
  const points = [
    { label: STAT_LABELS.intelligence, value: state.stats.intelligence, angle: -Math.PI / 2 },
    { label: STAT_LABELS.memory, value: state.stats.memory, angle: -0.22 },
    { label: STAT_LABELS.stamina, value: state.stats.stamina, angle: 0.82 },
    { label: STAT_LABELS.inspiration, value: state.stats.inspiration, angle: 2.18 },
    { label: STAT_LABELS.willpower, value: state.stats.willpower, angle: 3.28 },
  ];
  const centerX = 760;
  const centerY = 310;
  const radius = 120;
  ctx.strokeStyle = CANVAS_THEME.panelStroke;
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, (radius / 4) * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  points.forEach((point, index) => {
    const r = (point.value / 12) * radius;
    const x = centerX + Math.cos(point.angle) * r;
    const y = centerY + Math.sin(point.angle) * r;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = CANVAS_THEME.accentDaiqingSoft;
  ctx.fill();
  ctx.strokeStyle = CANVAS_THEME.accentDaiqing;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
  points.forEach((point) => {
    const x = centerX + Math.cos(point.angle) * (radius + 30);
    const y = centerY + Math.sin(point.angle) * (radius + 30);
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.font = "16px 'Microsoft YaHei'";
    ctx.fillText(`${point.label} ${point.value}`, x - 30, y);
  });
}

function drawCanvasProgress(x, y, width, height, progress) {
  ctx.fillStyle = CANVAS_THEME.progressTrack;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = CANVAS_THEME.progressFill;
  ctx.fillRect(x, y, width * progress, height);
}

function wrapText(text, x, y, maxWidth, lineHeight, color = "#edf4ff") {
  ctx.fillStyle = color;
  ctx.font = "18px 'Microsoft YaHei'";
  const words = text.split("");
  let line = "";
  let lineY = y;
  words.forEach((char) => {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = char;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  });
  if (line) {
    ctx.fillText(line, x, lineY);
  }
}

function countBoardTypes() {
  const counts = { base: 0, ability: 0, boost: 0, reasoning: 0, bridge: 0 };
  state.memory.board.forEach((node) => {
    if (!node) {
      return;
    }
    if (node.unlocked) {
      counts.base += 1;
    }
    if (node.structure && counts[node.structure] !== undefined) {
      counts[node.structure] += 1;
    }
  });
  counts.bridge = state.memory.bridges.filter(Boolean).length;
  return counts;
}

function metric(label, value) {
  return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
}

function escapeModalText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDaoDebateHistoryRounds(rootState = state) {
  const session = getActiveDaoDebateSession(rootState);
  const history = Array.isArray(session?.history) ? session.history : [];
  if (!history.length) {
    return [];
  }
  const latest = session?.latestExchange;
  if (!latest) {
    return history.slice(0, Math.max(0, history.length - 1));
  }
  const latestIndex = history.findIndex(
    (entry) => entry === latest || (entry.roundIndex === latest.roundIndex && entry.cardId === latest.cardId)
  );
  if (latestIndex < 0) {
    return history.slice(0, Math.max(0, history.length - 1));
  }
  return history.slice(0, latestIndex);
}

function renderDaoDebateHistoryModalHtml(input = {}) {
  const rounds = Array.isArray(input.rounds) ? input.rounds : [];
  const roundsHtml = rounds.length
    ? rounds
        .map(
          (entry, index) => `
            <div class="modal-rule">
              <strong>第 ${Number(entry.roundIndex || index + 1)} 轮</strong>
              ${entry.cardLabel ? `<small>论点：${escapeModalText(entry.cardLabel)}</small>` : ""}
              <small>${escapeModalText(UI_TEXT.left?.daoDebatePlayerLabel || "你的回应")}：${escapeModalText(entry.playerLine || "")}</small>
              <small>${escapeModalText(UI_TEXT.left?.daoDebateReplyLabel || "妙哉偶回应")}：${escapeModalText(entry.replyLine || "")}</small>
            </div>
          `
        )
        .join("")
    : `
      <div class="modal-rule">
        <small>${escapeModalText(UI_TEXT.left?.daoDebateHistoryEmpty || "当前还没有可回看的前几轮对话。")}</small>
      </div>
    `;

  return `
    <div class="panel-title">
      <h2>${escapeModalText(input.title || "")}</h2>
      <button class="drawer-close" id="info-close-btn" type="button">${escapeModalText(input.closeLabel || "")}</button>
    </div>
    <div class="modal-body">
      ${roundsHtml}
    </div>
  `;
}

function toggleStatsPanel(force) {
  state.ui.statsOpen = typeof force === "boolean" ? force : !state.ui.statsOpen;
  if (state.ui.statsOpen) {
    state.ui.infoModal = null;
  }
  syncUi();
}

function openInfoModal(kind) {
  state.ui.infoModal = kind;
  state.ui.statsOpen = false;
  syncUi();
}

function closeInfoModal() {
  state.ui.infoModal = null;
  syncUi();
}

function getCurrentPhaseIndex() {
  if (state.mode === "menu") return -1;
  if (state.mode === "planning") return state.selectedSlot;
  if (state.mode === "resolving") return Math.min(state.resolvingFlow.slotIndex, SLOT_NAMES.length - 1);
  if (state.mode === "task") {
    return Math.min(Math.max(Number(getActiveTaskRuntime(state).pendingSlotIndex || 0), 0), SLOT_NAMES.length - 1);
  }
  if (state.mode === "memory") return SLOT_NAMES.length - 1;
  return SLOT_NAMES.length - 1;
}

function getQuickStatusCards() {
  return UI_TEXT.quickCards.map((item) => ({
    label: RESOURCE_LABELS[item.key],
    value: state.resources[item.key],
    hint: item.hint,
  }));
}

function renderInfoModal() {
  const kind = state.ui.infoModal;
  if (!kind) {
    infoModal.innerHTML = "";
    infoModal.classList.remove("overlay-modal-timetable");
    return;
  }
  infoModal.classList.remove("overlay-modal-timetable");
  if (kind === "memory-rules") {
    infoModal.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.infoModal.memoryTitle}</h2>
        <button class="drawer-close" id="info-close-btn" type="button">${UI_TEXT.common.close}</button>
      </div>
      <div class="modal-body">
        <p class="tiny">${UI_TEXT.infoModal.memoryIntro}</p>
        <div class="modal-grid">
          ${Object.entries(MEMORY_TYPES)
            .map(
              ([, meta]) => `
                <div class="modal-rule">
                  <strong style="color:${meta.accent};">${meta.label}</strong>
                  <small>${meta.desc}</small>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="modal-rule">
          <strong>${UI_TEXT.infoModal.memoryRulesTitle}</strong>
          <small>${UI_TEXT.infoModal.memoryRulesBody}</small>
        </div>
      </div>
    `;
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
    return;
  }
  if (kind === "progress") {
    infoModal.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.infoModal.progressTitle}</h2>
        <button class="drawer-close" id="info-close-btn" type="button">${UI_TEXT.common.close}</button>
      </div>
      ${flowPanel.innerHTML}
    `;
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
    return;
  }
  if (kind === "weekly-timetable") {
    infoModal.classList.add("overlay-modal-timetable");
    infoModal.innerHTML = window.GAME_RUNTIME.renderWeeklyTimetableModalHtml({
      title: UI_TEXT.infoModal.timetableTitle,
      closeLabel: UI_TEXT.common.close,
      timetableHtml: renderWeeklyTimetable(),
    });
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
    return;
  }
  if (kind === "dao-debate-history") {
    infoModal.innerHTML = renderDaoDebateHistoryModalHtml({
      title: UI_TEXT.infoModal?.daoDebateHistoryTitle || "道法论辩 · 前几轮",
      closeLabel: UI_TEXT.common.close,
      rounds: getDaoDebateHistoryRounds(state),
    });
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
    return;
  }
  if (kind === "feedback") {
    infoModal.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.infoModal.feedbackTitle}</h2>
        <button class="drawer-close" id="info-close-btn" type="button">${UI_TEXT.common.close}</button>
      </div>
      ${logPanel.innerHTML}
    `;
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
  }
}

function renderRandomEventModal() {
  const runtime = getRandomEventRuntime();
  const stage = runtime?.stage;
  if (!stage || stage === "idle") {
    infoModal.classList.remove("overlay-modal-random-event");
    return false;
  }

  infoModal.classList.remove("overlay-modal-timetable");
  infoModal.classList.add("overlay-modal-random-event");
  infoModal.innerHTML = window.GAME_RUNTIME.renderRandomEventModalHtml({
    runtime,
    uiText: UI_TEXT,
  });

  const choiceButtons = infoModal.querySelectorAll("[data-random-event-choice]");
  choiceButtons.forEach((button, index) => {
    button.classList.add("random-event-choice");
    button.addEventListener("click", () => {
      runtime.focusedChoiceIndex = index;
      const choiceId = button.dataset.randomEventChoice;
      if (choiceId) {
        chooseRandomEventOptionForFlowState(state, choiceId, createDayFlowContext());
        syncUi();
      }
    });
  });

  const continueBtn = infoModal.querySelector("#random-event-continue-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", confirmRandomEventResult);
  }

  const activeButton = choiceButtons[runtime.focusedChoiceIndex];
  if (activeButton && stage === "prompt") {
    activeButton.focus();
  }

  return true;
}

function syncUi() {
  renderLeftPanel();
  renderTopPanel();
  renderFlowPanel();
  renderMainPanel();
  renderLogPanel();
  renderMemoryStage();
  const randomEventOpen = renderRandomEventModal();
  if (randomEventOpen) {
    state.ui.statsOpen = false;
    state.ui.infoModal = null;
  }
  if (!randomEventOpen) {
    infoModal.classList.remove("overlay-modal-random-event");
    renderInfoModal();
  }
  topPanel.classList.toggle("hidden", !state.ui.statsOpen);
  infoModal.classList.toggle("hidden", !state.ui.infoModal && !randomEventOpen);
  overlayBackdrop.classList.toggle("hidden", !state.ui.statsOpen && !state.ui.infoModal && !randomEventOpen);
  statsToggleBtn.textContent = state.ui.statsOpen ? UI_TEXT.toolbar.statsClose : UI_TEXT.toolbar.statsOpen;
  progressToggleBtn.textContent = UI_TEXT.toolbar.progress;
  feedbackToggleBtn.textContent = UI_TEXT.toolbar.feedback;
  if (timetableToggleBtn) {
    timetableToggleBtn.textContent = UI_TEXT.toolbar.timetable;
  }
  document.body.classList.toggle("memory-mode", state.mode === "memory");
  document.body.classList.toggle("task-mode", state.mode === "task");
  const isDaoDebateTaskMode = state.mode === "task" && getActiveTaskDef(state)?.id === "dao_debate";
  document.body.classList.toggle("dao-debate-task-mode", isDaoDebateTaskMode);
  memoryStage.classList.toggle("hidden", state.mode !== "memory");
  canvas.classList.toggle("hidden", state.mode === "memory");
  statusLine.textContent =
    state.mode === "course_selection"
      ? "正在确认本周课表"
      : state.mode === "planning"
      ? UI_TEXT.statusLine.planning(state.day, getSlotLabel(state.selectedSlot))
      : state.mode === "resolving"
        ? UI_TEXT.statusLine.resolving(state.day, Math.round(state.progress * 100), state.resolvingFlow.autoplay)
        : state.mode === "task"
          ? getTaskStatusLineText(state)
        : state.mode === "memory"
          ? UI_TEXT.statusLine.memory(state.day)
          : state.mode === "summary"
            ? typeof UI_TEXT.statusLine.summary === "function"
              ? UI_TEXT.statusLine.summary(getSummaryWeek(), getSummaryTotalWeeks())
              : UI_TEXT.statusLine.summary
            : UI_TEXT.statusLine.menu;
}

function renderFlowPanel() {
  if (state.mode === "course_selection") {
    const quickCards = getQuickStatusCards();
    const blocks = state.courseSelection.blocks || [];
    const requiredCount = blocks.filter((block) => block.category !== "elective" && block.selectedCourseId).length;
    const requiredTotal = blocks.filter((block) => block.category !== "elective").length;
    const electiveCount = blocks.filter((block) => block.category === "elective" && block.selectedCourseId).length;
    const electiveTotal = blocks.filter((block) => block.category === "elective").length;
    flowPanel.innerHTML = `
      <div class="flow-shell">
        <div class="panel-title">
          <h2>当前进展</h2>
          <span class="badge">选课阶段</span>
        </div>
        <div class="hint-grid">
          <div class="hint-card focus-callout">
            <strong>${state.currentStory.title}</strong>
            <small>${state.currentStory.body}</small>
          </div>
          <div class="hint-card">
            <strong>现在要做什么</strong>
            <small>先确认通识必修和专业必修已经写入课表，再从专业选修中决定本周偏向。</small>
            <small>左上主舞台会实时预览整周课表，并展示各时段对应时辰。</small>
          </div>
        </div>
        <div class="quick-grid">
          ${quickCards.map((card) => `
            <div class="quick-card">
              <strong>${card.value}</strong>
              <small>${card.label}</small>
              <small>${card.hint}</small>
            </div>
          `).join("")}
        </div>
        <div class="selection-summary">
          <p class="tiny">必修已锁定 ${requiredCount} / ${requiredTotal} 组，选修已选 ${electiveCount} / ${electiveTotal} 组。</p>
          <p class="tiny">${blocks.every((block) => block.selectedCourseId) ? "课表已完整，可以进入本周。" : "仍有专业选修尚未选定。"}</p>
        </div>
      </div>
    `;
    return;
  }

  const phaseIndex = getCurrentPhaseIndex();
  const quickCards = getQuickStatusCards();
  const currentActivity = getActivity(state.schedule[Math.max(0, Math.min(state.selectedSlot, SLOT_NAMES.length - 1))]);
  const planningHintText = isPlanningSlotLocked(state.selectedSlot)
    ? `当前时段 ${getSlotLabel(state.selectedSlot)} 为固定课程，只能查看内容，不能改动。请切换到其他自由时段安排活动。`
    : UI_TEXT.flow.planningHint(currentActivity ? currentActivity.name : null);
  const courseSelectionReady =
    state.mode === "course_selection" && state.courseSelection.blocks.length > 0 && state.courseSelection.blocks.every((block) => block.selectedCourseId);
  const latestTimeline = state.timeline[0];
  flowPanel.innerHTML = `
    <div class="flow-shell">
      <div class="panel-title">
        <h2>${UI_TEXT.flow.title}</h2>
        <span class="badge">${UI_TEXT.common.dayBadge(state.day, state.totalDays)}</span>
      </div>
      <div class="phase-strip">
        ${SLOT_NAMES.map((slot, index) => {
          const activity = getActivity(state.schedule[index]);
          let stateClass = "";
            if (state.mode === "resolving") {
              const flow = state.resolvingFlow;
              const finishedCount =
                flow.phase === "opening" || flow.phase === "lead" || flow.phase === "story"
                  ? flow.slotIndex
                  : Math.min(flow.slotIndex + 1, SLOT_NAMES.length);
            if (index < finishedCount) {
              stateClass = "done";
            }
            if (index === phaseIndex && flow.phase !== "ending") {
              stateClass = stateClass ? `${stateClass} current` : "current";
            }
          } else if (state.mode === "memory") {
            stateClass = "done";
          } else if (index === phaseIndex) {
            stateClass = "current";
          }
          return `
            <div class="phase-card ${stateClass}">
              <strong>${slot}</strong>
              <small>${activity ? activity.name : UI_TEXT.common.unassigned}</small>
            </div>
          `;
        }).join("")}
      </div>
      <div class="hint-grid">
        <div class="hint-card focus-callout">
          <strong>${state.currentStory.title}</strong>
          <small>${state.currentStory.body}</small>
          <div class="mini-progress">
            ${SLOT_NAMES.map((_, index) => {
              let cls = "";
              if (state.mode === "resolving") {
                const flow = state.resolvingFlow;
                const finishedCount =
                  flow.phase === "opening" || flow.phase === "lead" || flow.phase === "story"
                    ? flow.slotIndex
                    : Math.min(flow.slotIndex + 1, SLOT_NAMES.length);
                if (index < finishedCount) {
                  cls = "done";
                }
                if (index === phaseIndex && flow.phase !== "ending") {
                  cls = cls ? `${cls} current` : "current";
                }
              } else if (state.mode === "memory") {
                cls = "done";
              } else if (index === phaseIndex) {
                cls = "current";
              }
              return `<i class="${cls}"></i>`;
            }).join("")}
          </div>
        </div>
        <div class="hint-card">
          <strong>${UI_TEXT.flow.nowWhatTitle}</strong>
          <small>${
            state.mode === "menu"
              ? UI_TEXT.flow.menuHint
              : state.mode === "course_selection"
                ? courseSelectionReady
                  ? "固定课程已经选完，可以确认并进入今天的自由安排。"
                  : "先为每组固定上课时间选定课程。主舞台会实时预览整周课表。"
              : state.mode === "planning"
                ? planningHintText
                : state.mode === "resolving"
                  ? state.resolvingFlow.autoplay
                    ? UI_TEXT.flow.resolvingHintAuto
                    : UI_TEXT.flow.resolvingHintClick
                : state.mode === "task"
                    ? getTaskFlowHintText(state)
                  : state.mode === "memory"
                    ? UI_TEXT.flow.memoryHint
                    : UI_TEXT.flow.summaryHint
          }</small>
          <small>${getFlowHotkeysText()}</small>
        </div>
      </div>
      <div class="quick-grid">
        ${quickCards.map((card) => `
          <div class="quick-card">
            <strong>${card.value}</strong>
            <small>${card.label}</small>
            <small>${card.hint}</small>
          </div>
        `).join("")}
      </div>
      <div class="selection-summary">
        <p class="tiny">${
          latestTimeline
            ? UI_TEXT.flow.feedbackPrefix(latestTimeline.day, latestTimeline.slot, latestTimeline.activity)
            : UI_TEXT.flow.feedbackEmptyPrefix
        }</p>
        <p class="tiny">${latestTimeline ? latestTimeline.notes : UI_TEXT.flow.feedbackEmptyBody}</p>
      </div>
    </div>
  `;
}

function renderPlanningPanel() {
  if (state.mode === "resolving") {
    const flow = state.resolvingFlow;
    const currentIndex = Math.min(flow.slotIndex, SLOT_NAMES.length - 1);
    const currentActivity = getResolvingSlotActivity(currentIndex);
    const nextLabel = flow.phase === "ending" ? UI_TEXT.planning.resolveFinish : UI_TEXT.planning.resolveNext;
    const autoLabel = flow.autoplay ? UI_TEXT.planning.resolveAutoOn : UI_TEXT.planning.resolveAutoOff;
    const storyTrailHtml = flow.storyTrail
      .map(
        (item) => `
          <div class="resolve-story-line">
            <strong>${item.title}</strong>
            <small>${item.body}</small>
          </div>
        `
      )
      .join("");
    mainPanel.innerHTML = `
      <div class="resolving-shell">
        <div class="panel-title">
          <h2>${UI_TEXT.planning.resolveTitle}</h2>
          <span class="badge">${getSlotLabel(currentIndex)}</span>
        </div>
        <div class="story-card focus-callout" id="resolve-story-card" role="button" tabindex="0">
          <div class="resolve-story-trail">${storyTrailHtml}</div>
          <small>${UI_TEXT.planning.resolveCurrentActivity(currentActivity.name)}</small>
        </div>
        <div class="progress-bar"><i style="width:${Math.max(6, state.progress * 100)}%"></i></div>
        <div class="selection-summary">
          <p class="tiny">${UI_TEXT.planning.resolveTip1}</p>
          <p class="tiny">${UI_TEXT.planning.resolveTip2(Math.round(state.progress * 100))}</p>
        </div>
        <div class="action-row">
          <button class="primary" id="resolve-next-btn">${nextLabel}</button>
          <button class="ghost-button ${flow.autoplay ? "primary" : ""}" id="resolve-auto-btn">${autoLabel}</button>
        </div>
      </div>
    `;
    const advance = () => advanceResolvingFlow();
    mainPanel.querySelector("#resolve-next-btn").addEventListener("click", advance);
    mainPanel.querySelector("#resolve-auto-btn").addEventListener("click", () => toggleResolvingAutoplay());
    const storyCard = mainPanel.querySelector("#resolve-story-card");
    storyCard.addEventListener("click", advance);
    storyCard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advance();
      }
    });
    if (flow.justAppended) {
      storyCard.scrollTop = storyCard.scrollHeight;
      flow.justAppended = false;
    }
    return;
  }

  const selectedSlotActivity = getActivity(state.schedule[state.selectedSlot]);
  const selectedSlotLocked = isPlanningSlotLocked(state.selectedSlot);
  const planningActivities = getPlanningActivities();
  const activeActivity =
    planningActivities.find((activity) => activity.id === state.selectedActivity) || planningActivities[0] || ACTIVITIES[0];
  const { filled: filledSlots, total: totalEditableSlots } = getEditableScheduleStats();
  const canCopyPrevious = canCopyPreviousDaySchedule();
  const recommendedPresets = getRecommendedSchedulePresets();
  const todayFixedCourses = state.schedule
    .map((activityId, index) => ({ activity: getActivity(activityId), locked: state.scheduleLocks[index], slot: getSlotFullLabel(index) }))
    .filter((item) => item.locked && item.activity);
  mainPanel.innerHTML = `
    <div class="planning-shell">
      <div class="panel-title">
        <h2>今日安排</h2>
        <span class="badge">${getWeekdayLabel(state.day)} · ${getSlotLabel(state.selectedSlot)}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${getSlotFullLabel(state.selectedSlot)}</strong>
        <small>${selectedSlotLocked ? "这个时段来自整周课表中的固定课程，只能查看，不能改动。" : "这个时段是自由时间，可以安排课业、生活、修炼或社交。固定课程会按周课表自动带入。"}</small>
        <small>${selectedSlotLocked ? `固定课程：${selectedSlotActivity?.name || "未排课"}` : UI_TEXT.planning.eventPicked(selectedSlotActivity?.name || null)}</small>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card">
          <strong>${selectedSlotLocked ? "固定课程详情" : UI_TEXT.planning.preparingTitle}</strong>
          <small>${selectedSlotActivity?.name || activeActivity.name}</small>
          <small>${selectedSlotLocked ? selectedSlotActivity?.summary || "这节课会按周课表自动执行。" : activeActivity.summary}</small>
        </div>
        <div class="story-card">
          <strong>今日自由时段</strong>
          <small>${getPlanningScheduleFilledText(filledSlots, totalEditableSlots)}</small>
          <small>${getPlanningScheduleHintText(filledSlots, totalEditableSlots)}</small>
        </div>
      </div>
      ${
        selectedSlotLocked
          ? `
            <div class="planning-event-list">
              <div class="story-card locked-slot-note">
                <strong>今日固定课程</strong>
                <small>${todayFixedCourses.length ? todayFixedCourses.map((item) => `${item.slot} · ${item.activity.name}`).join(" / ") : "今天没有固定课程。"}</small>
                <small>切换到左侧的自由时段后，右侧才会出现可安排的自由活动列表。</small>
              </div>
            </div>
          `
          : `
            <div class="planning-event-list">
              <div class="activity-grid planning-activity-grid">
                ${planningActivities.map(
                  (activity) => `
                    <button class="activity-card ${state.selectedActivity === activity.id ? "active" : ""}" data-activity="${activity.id}" data-tone="${activity.tone}">
                      <strong>${activity.name}</strong>
                      <small>${getActivityKindLabel(activity)} · 推荐：${getActivityPreferredSlotText(activity)}</small>
                      <small>${activity.summary}</small>
                    </button>
                  `
                ).join("")}
              </div>
            </div>
          `
      }
      <div class="planning-actions">
        <div class="planning-shortcuts">
          <button class="ghost-button planning-shortcut-btn" id="copy-prev-btn" ${canCopyPrevious ? "" : "disabled"} title="快捷键 C">\u590d\u5236\u524d\u4e00\u5929</button>
          ${recommendedPresets
            .map(
              (preset, index) =>
                `<button class="ghost-button planning-shortcut-btn ${index === 0 ? "primary" : ""}" data-quick-preset="${preset.id}" title="${index === 0 ? "快捷键 R" : "推荐安排"}">${preset.label}</button>`
            )
            .join("")}
        </div>
        <div class="action-row planning-main-actions">
          <button class="ghost-button warn" id="clear-btn">${UI_TEXT.planning.clear}</button>
          <button class="primary" id="execute-btn">${UI_TEXT.planning.execute}</button>
        </div>
      </div>
    </div>
  `;
  mainPanel.querySelectorAll("[data-activity]").forEach((button) => {
    button.addEventListener("click", () => assignActivity(button.dataset.activity));
  });
  mainPanel.querySelectorAll("[data-quick-preset]").forEach((button) => {
    button.addEventListener("click", () => applyQuickPreset(button.dataset.quickPreset));
  });
  mainPanel.querySelector("#copy-prev-btn")?.addEventListener("click", copyPreviousDaySchedule);
  mainPanel.querySelector("#clear-btn").addEventListener("click", clearSchedule);
  mainPanel.querySelector("#execute-btn").addEventListener("click", startDay);
}

function renderCourseSelectionPanel() {
  const blocks = state.courseSelection.blocks || [];
  const ready = blocks.length > 0 && blocks.every((block) => block.selectedCourseId);
  const sections = [
    {
      key: "required_common",
      title: "通识必修",
      desc: "全员都会自动带入这些固定课程，用来铺出学院的共同基础。",
    },
    {
      key: "required_major",
      title: "专业必修",
      desc: "由当前入学原型对应的培养方向决定，同样会自动锁进整周课表。",
    },
    {
      key: "elective",
      title: "专业选修",
      desc: "这些时段需要你从候选课程中亲自选定，决定本周偏向。",
    },
  ];
  mainPanel.innerHTML = `
    <div class="course-selection-shell">
      <div class="panel-title">
        <h2>开周选课</h2>
        <span class="badge">${getWeekdayLabel(1)} 前</span>
      </div>
      <div class="story-card focus-callout">
        <strong>先看本周固定课，再补专业选修</strong>
        <small>通识必修和专业必修会自动锁定到课表里；只有专业选修需要你在候选课程中做选择。</small>
        <small>左上主舞台会实时展示整周课表预览，并标出各时段对应的时辰。</small>
      </div>
      <div class="planning-event-list">
        <div class="course-selection-list">
          ${sections
            .map((section) => {
              const sectionBlocks = blocks.filter((block) => block.category === section.key);
              if (!sectionBlocks.length) {
                return "";
              }
              return `
                <section class="course-selection-section">
                  <div class="panel-title">
                    <h3>${section.title}</h3>
                    <span class="badge">${sectionBlocks.filter((block) => block.selectedCourseId).length} / ${sectionBlocks.length}</span>
                  </div>
                  <p class="tiny">${section.desc}</p>
                  ${sectionBlocks
                    .map((block) => {
                      const selectedActivity = getActivity(block.selectedCourseId);
                      return `
                        <div class="course-selection-card">
                          <strong>${block.label}</strong>
                          <small>${getCourseBlockCategoryLabel(block)} · ${getCourseBlockTimingText(block)}</small>
                          <small>${selectedActivity ? `已定：${selectedActivity.name}` : "尚未选择课程"}</small>
                          ${
                            block.selectionMode === "fixed"
                              ? `
                                <div class="story-card course-selection-fixed">
                                  <strong>${selectedActivity?.name || "固定课程"}</strong>
                                  <small>${selectedActivity?.summary || "这门课程会自动写入本周课表。"}</small>
                                </div>
                              `
                              : `
                                <div class="course-option-row">
                                  ${(block.options || [])
                                    .map((courseId) => {
                                      const activity = getActivity(courseId);
                                      const course = getCourseCatalogEntry(courseId);
                                      if (!activity || !course) {
                                        return "";
                                      }
                                      return `
                                        <button
                                          class="ghost-button ${block.selectedCourseId === courseId ? "primary" : ""}"
                                          data-course-block="${block.id}"
                                          data-course-id="${courseId}"
                                          type="button"
                                          style="--course-accent:${getCourseSkillColor(activity)};"
                                        >
                                          ${activity.name}
                                          <span>${course.track} · ${course.module}</span>
                                        </button>
                                      `;
                                    })
                                    .join("")}
                                </div>
                              `
                          }
                        </div>
                      `;
                    })
                    .join("")}
                </section>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="action-row planning-actions">
        <button class="primary" id="confirm-course-selection-btn" ${ready ? "" : "disabled"}>确认课表并开始本周</button>
      </div>
    </div>
  `;
  mainPanel.querySelectorAll("[data-course-block]").forEach((button) => {
    button.addEventListener("click", () => pickCourseSelection(button.dataset.courseBlock, button.dataset.courseId));
  });
  mainPanel.querySelector("#confirm-course-selection-btn").addEventListener("click", confirmCourseSelection);
}

function renderMainPanel() {
  if (state.mode === "menu") {
    renderMenuPanel();
    return;
  }
  if (state.mode === "course_selection") {
    renderCourseSelectionPanel();
    return;
  }
  if (state.mode === "task") {
    renderTaskPanel();
    return;
  }
  if (state.mode === "planning" || state.mode === "resolving") {
    renderPlanningPanel();
    return;
  }
  if (state.mode === "memory") {
    renderMemoryPanelCompact();
    return;
  }
  renderSummaryPanel();
}

function renderMemoryStage() {
  if (state.mode !== "memory") {
    memoryStage.innerHTML = "";
    return;
  }
  const activePiece =
    state.memory.pieces.find((piece) => piece.id === (state.memory.dragPieceId || state.memory.selectedPiece)) ||
    null;
  const cursor = normalizeMemoryCursor();
  const zoneLegend = Object.entries(MEMORY_ZONE_META)
    .map(
      ([zoneId, meta]) => `
        <span class="memory-zone-chip zone-${zoneId}">
          <i style="--zone-color:${meta.color};"></i>
          ${meta.label}
        </span>
      `
    )
    .join("");
  const zoneAreaPolygons = MEMORY_ZONE_AREAS.polygons
    .map((polygon) => `<polygon class="memory-zone-area zone-${polygon.zone}" points="${polygon.points}" />`)
    .join("");
  const coreZoneArea = `<circle class="memory-zone-area zone-core" cx="${MEMORY_ZONE_AREAS.core.x}" cy="${MEMORY_ZONE_AREAS.core.y}" r="${MEMORY_ZONE_AREAS.core.r}" />`;

  const edgeLines = MEMORY_HEX_LAYOUT.edges
    .map((edge) => {
      const occupied = Boolean(state.memory.bridges[edge.index]);
      const valid = activePiece?.type === "link" && isValidPlacement(activePiece, { kind: "edge", id: edge.index });
      const active = cursor.kind === "edge" && cursor.id === edge.index;
      const connectable = isValidBridgePlacement(edge.index);
      return `
        <line
          x1="${MEMORY_HEX_LAYOUT.nodes[edge.a].ux}"
          y1="${MEMORY_HEX_LAYOUT.nodes[edge.a].uy}"
          x2="${MEMORY_HEX_LAYOUT.nodes[edge.b].ux}"
          y2="${MEMORY_HEX_LAYOUT.nodes[edge.b].uy}"
          class="memory-edge-line ${occupied ? "filled" : ""} ${valid ? "valid" : ""} ${active ? "active" : ""} ${connectable ? "connectable" : ""}"
        />
      `;
    })
    .join("");

  const gridLines = MEMORY_HEX_LAYOUT.edges
    .map(
      (edge) => `
        <line
          x1="${MEMORY_HEX_LAYOUT.nodes[edge.a].ux}"
          y1="${MEMORY_HEX_LAYOUT.nodes[edge.a].uy}"
          x2="${MEMORY_HEX_LAYOUT.nodes[edge.b].ux}"
          y2="${MEMORY_HEX_LAYOUT.nodes[edge.b].uy}"
          class="memory-grid-line"
        />
      `
    )
    .join("");

  const gridDots = MEMORY_HEX_LAYOUT.nodes
    .map(
      (node) => `
        <circle
          cx="${node.ux}"
          cy="${node.uy}"
          r="0.78"
          class="memory-grid-dot zone-${node.zone}"
        />
      `
    )
    .join("");

  const edgeButtons = MEMORY_HEX_LAYOUT.edges
    .map((edge) => {
      const occupied = Boolean(state.memory.bridges[edge.index]);
      const valid = activePiece?.type === "link" && isValidPlacement(activePiece, { kind: "edge", id: edge.index });
      const active = cursor.kind === "edge" && cursor.id === edge.index;
      return `
        <button
          class="memory-edge ${occupied ? "filled" : ""} ${valid ? "valid" : ""} ${active ? "active" : ""}"
          data-memory-edge="${edge.index}"
          style="left:${edge.mx}%;top:${edge.my}%;"
          type="button"
          aria-label="${UI_TEXT.memory.edgeAria(edge.index)}"
        >
          ${occupied ? UI_TEXT.memory.edgeHintOccupied : valid ? UI_TEXT.memory.edgeHintValid : UI_TEXT.memory.edgeHintDefault}
        </button>
      `;
    })
    .join("");

  const nodeButtons = MEMORY_HEX_LAYOUT.nodes
    .map((node) => {
      const nodeState = state.memory.board[node.index];
      const structureType = nodeState.structure;
      const prediction = getMemoryNodePrediction(nodeState);
      const valid = activePiece?.type ? isValidPlacement(activePiece, { kind: "node", id: node.index }) : false;
      const active = cursor.kind === "node" && cursor.id === node.index;
      const title = !nodeState.unlocked
        ? UI_TEXT.memory.nodeLockedTitle
        : structureType
          ? `${MEMORY_TYPES[structureType].label}${nodeState.structureSkill ? ` · ${SKILL_LABELS[nodeState.structureSkill]}` : ""}`
          : nodeState.fragments.length
            ? `正在拼装：${nodeState.fragments.map(getMemoryPieceLabel).join(" + ")}`
            : UI_TEXT.memory.nodeUnlockedTitle;
      const desc = !nodeState.unlocked
        ? UI_TEXT.memory.nodeLockedDesc
        : structureType
          ? UI_TEXT.memory.nodeBuiltDesc(nodeState.day)
          : nodeState.fragments.length
            ? `已嵌入 ${nodeState.fragments.length} / ${MEMORY_BUILD_RULES.nodeCapacity} 枚，预计定型为 ${MEMORY_TYPES[prediction?.building || "reasoning"].label}。`
            : UI_TEXT.memory.nodeEmptyDesc;
      const zoneLabel = MEMORY_ZONE_META[node.zone].label;
      return `
        <button
          class="memory-node zone-${node.zone} ${nodeState.unlocked ? "unlocked" : "locked"} ${structureType ? "filled" : ""} ${nodeState.fragments.length ? "assembling" : ""} ${valid ? "valid" : ""} ${active ? "active" : ""}"
          data-memory-node="${node.index}"
          data-zone="${node.zone}"
          data-type="${structureType || prediction?.building || ""}"
          style="left:${node.ux}%;top:${node.uy}%;"
          type="button"
          aria-label="${UI_TEXT.memory.nodeAria(node.index)} - ${zoneLabel} - ${title} - ${desc}"
        >
          <span class="memory-node-dot" aria-hidden="true"></span>
          ${nodeState.fragments.length ? `<span class="memory-node-stack">${nodeState.fragments.length}/${MEMORY_BUILD_RULES.nodeCapacity}</span>` : ""}
          <span class="memory-node-tooltip" role="tooltip">
            <em>${zoneLabel}</em>
            <strong>${title}</strong>
            <small>${desc}</small>
          </span>
        </button>
      `;
    })
    .join("");

  memoryStage.innerHTML = `
    <div class="memory-stage-shell">
      <div class="memory-stage-header">
        <div>
          <h2>${UI_TEXT.memory.stageTitle}</h2>
          <p>${UI_TEXT.memory.stageDesc}</p>
        </div>
        <span class="badge">${activePiece ? UI_TEXT.memory.stageCurrentPiece(getMemoryPieceLabel(activePiece)) : UI_TEXT.memory.stageSelectHint}</span>
      </div>
      <div class="memory-zone-legend">
        ${zoneLegend}
      </div>
      <div class="memory-hex-board">
        <svg class="memory-zone-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${zoneAreaPolygons}
          ${coreZoneArea}
        </svg>
        <svg class="memory-grid-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${gridLines}
          ${gridDots}
        </svg>
        <svg class="memory-edge-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${edgeLines}
        </svg>
        <div class="memory-edge-layer">
          ${edgeButtons}
        </div>
        <div class="memory-node-layer">
          ${nodeButtons}
        </div>
      </div>
    </div>
  `;

  const bindTargetEvents = (selector, kind) => {
    memoryStage.querySelectorAll(selector).forEach((element) => {
      const rawId = kind === "node" ? element.dataset.memoryNode : element.dataset.memoryEdge;
      const id = Number(rawId);
      if (!Number.isFinite(id)) {
        return;
      }
      const target = { kind, id };

      element.addEventListener("dragover", (event) => {
        const draggingPiece =
          state.memory.pieces.find((piece) => piece.id === state.memory.dragPieceId && !piece.used) || null;
        if (!draggingPiece || !isValidPlacement(draggingPiece, target)) {
          return;
        }
        event.preventDefault();
        element.classList.add("drop-target");
      });

      element.addEventListener("dragleave", () => {
        element.classList.remove("drop-target");
      });

      element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drop-target");
        if (state.memory.dragPieceId) {
          placeMemoryPiece(target, state.memory.dragPieceId);
        }
      });

      element.addEventListener("click", () => {
        state.memory.cursor = target;
        if (activePiece && isValidPlacement(activePiece, target)) {
          placeMemoryPiece(target, activePiece.id);
        } else {
          syncUi();
        }
      });
    });
  };

  bindTargetEvents("[data-memory-node]", "node");
  bindTargetEvents("[data-memory-edge]", "edge");
}

function renderTopPanel() {
  const picked = getArchetype(state.selectedArchetype);
  topPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.top.title}</h2>
      <div class="toolbar-actions">
        <span class="badge">${UI_TEXT.common.dayBadge(state.day, state.totalDays)}</span>
        <button class="drawer-close" id="stats-close-btn" type="button">${UI_TEXT.common.close}</button>
      </div>
    </div>
    <p class="hero-line">${picked.name} · ${picked.title}</p>
    <div class="meta-grid">
      <div class="meta-card"><strong>${state.resources.coins}</strong><span>${RESOURCE_LABELS.coins}</span></div>
      <div class="meta-card"><strong>${state.resources.insight}</strong><span>${RESOURCE_LABELS.insight}</span></div>
      <div class="meta-card"><strong>${state.resources.spirit}</strong><span>${RESOURCE_LABELS.spirit}</span></div>
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>${UI_TEXT.top.coreStatsTitle}</h3>
      <span class="badge">${state.currentStory.speaker}</span>
    </div>
    <div class="stats-grid">
      ${metric(STAT_LABELS.intelligence, state.stats.intelligence)}
      ${metric(STAT_LABELS.memory, state.stats.memory)}
      ${metric(STAT_LABELS.stamina, state.stats.stamina)}
      ${metric(STAT_LABELS.inspiration, state.stats.inspiration)}
      ${metric(STAT_LABELS.willpower, state.stats.willpower)}
      ${metric(STAT_LABELS.aura, state.stats.aura)}
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>${UI_TEXT.top.externalStatsTitle}</h3>
    </div>
    <div class="stats-grid">
      ${metric(STAT_LABELS.charisma, state.stats.charisma)}
      ${metric(STAT_LABELS.cleanliness, state.stats.cleanliness)}
      ${metric(STAT_LABELS.mood, state.stats.mood)}
      ${metric(STAT_LABELS.fatigue, state.stats.fatigue)}
      ${metric(STAT_LABELS.selfControl, state.stats.selfControl)}
      ${metric(RELATIONSHIP_LABELS.roommate, state.relationships.roommate)}
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>${UI_TEXT.top.relationSkillTitle}</h3>
    </div>
    <div class="stats-grid">
      ${metric(RELATIONSHIP_LABELS.friend, state.relationships.friend)}
      ${metric(RELATIONSHIP_LABELS.mentor, state.relationships.mentor)}
      ${metric(RELATIONSHIP_LABELS.counselor, state.relationships.counselor)}
      ${metric(SKILL_LABELS.math, state.skills.math)}
      ${metric(SKILL_LABELS.sigil, state.skills.sigil)}
      ${metric(SKILL_LABELS.dao, state.skills.dao)}
      ${metric(SKILL_LABELS.craft, state.skills.craft)}
      ${metric(SKILL_LABELS.herbal, state.skills.herbal)}
      ${metric(SKILL_LABELS.formation, state.skills.formation)}
    </div>
  `;
  topPanel.querySelector("#stats-close-btn").addEventListener("click", () => toggleStatsPanel(false));
}

function renderMenuPanel() {
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.menu.title}</h2>
      <span class="badge">${UI_TEXT.menu.badge}</span>
    </div>
    <div class="choice-grid">
      ${ARCHETYPES.map(
        (item) => `
          <button class="choice-card ${item.id === state.selectedArchetype ? "active" : ""}" data-archetype="${item.id}">
            <strong>${item.name}</strong>
            <small>${item.title}</small>
            <small>${item.summary}</small>
          </button>
        `
      ).join("")}
    </div>
    <div class="action-row">
      <button class="primary" id="start-btn">${UI_TEXT.menu.startBtn}</button>
    </div>
  `;
  mainPanel.querySelectorAll("[data-archetype]").forEach((button) => {
    button.addEventListener("click", () => chooseArchetype(button.dataset.archetype));
  });
  mainPanel.querySelector("#start-btn").addEventListener("click", () => {
    applyArchetypeIfNeeded();
    startRun();
  });
}

function renderMemoryPanel() {
  renderMemoryPanelCompact();
}

function renderTaskPanel() {
  const taskText = UI_TEXT.task || {};
  const task = getActiveTaskInstance(state);
  const taskDef = getActiveTaskDef(state);
  if (taskDef?.id === "dao_debate") {
    const session = getActiveDaoDebateSession(state);
    const presentation = getDaoDebatePresentationState(state);
    const panelState = buildDaoDebateTaskPanelState({
      activity: getActiveTaskActivity(state),
      task,
      session,
      taskText,
      controlsDisabled: presentation.stage === "player_only",
    });
    mainPanel.innerHTML = renderDaoDebateTaskPanelHtml(panelState);
    mainPanel.querySelectorAll("[data-debate-card]").forEach((button) => {
      button.addEventListener("click", () => playDaoDebateCardFromUi(button.dataset.debateCard));
    });
    return;
  }
  const session = getActiveRefiningSession(state);
  const activity = getActiveTaskActivity(state) || { name: taskText.title || "炼器委托", summary: "" };
  const attempt = getActiveRefiningAttempt(state);
  const selectedCard = getSelectedTaskCard(state);
  const panelState = buildRefiningTaskPanelState({
    taskText,
    task,
    taskDef,
    activity,
    attempt,
    refiningSession: session,
    getCardLabel: getRefiningCardLabel,
    requirementText: getTaskRequirementText(taskDef),
    remainingDays: getTaskRemainingDays(state, task),
    selectedCardLabel: selectedCard ? getRefiningCardLabel(selectedCard) : taskText.noSelection || "",
    slotCardLabels: (attempt?.slots || [null, null, null]).map((cardId) => {
      if (!cardId) {
        return null;
      }
      const card = attempt?.deck?.find((entry) => entry.id === cardId);
      return card ? getRefiningCardLabel(card) : null;
    }),
    statusText: getTaskStatusText(state),
  });

  mainPanel.innerHTML = renderRefiningTaskPanelHtml(panelState, taskText);
  mainPanel.querySelector("#task-confirm-btn")?.addEventListener("click", confirmTaskAttempt);
  return;
  /*
  const requirementText = getTaskRequirementText(taskDef);
  const remainingDays = getTaskRemainingDays(state, task);
  const canConfirm = Boolean(attempt?.slots?.every(Boolean));
  const objectiveName = taskDef?.objective?.name || activity.name;
  const cardsHtml = (attempt?.deck || [])
    .map((card, index) => {
      const label = card.revealed ? getRefiningCardLabel(card) : taskText.reveal || "翻开";
      const detail = card.used
        ? taskText.used || "已放入"
        : card.revealed
          ? getRefiningCardLabel(card)
          : typeof taskText.hiddenCard === "function"
            ? taskText.hiddenCard(index)
            : `未翻开卡牌 ${index + 1}`;
      return `
        <button
          class="activity-card ${attempt.selectedCardId === card.id ? "active" : ""}"
          data-task-card="${card.id}"
          data-task-control="card"
          type="button"
          ${card.used ? "disabled" : ""}
        >
          <strong>${label}</strong>
          <small>${detail}</small>
          <small>${card.used ? taskText.used || "已放置" : card.revealed ? taskText.select || "选中" : taskText.reveal || "翻开"}</small>
        </button>
      `;
    })
    .join("");
  const slotsHtml = (attempt?.slots || [null, null, null])
    .map((cardId, index) => `
      <button class="ghost-button ${cardId ? "primary" : ""}" data-task-slot="${index}" data-task-control="slot" type="button">
        ${(typeof taskText.slot === "function" ? taskText.slot(index) : `槽位 ${index + 1}`)}
        <span>${cardId ? getRefiningCardLabel(cardId) : taskText.emptySlot || "空位"}</span>
      </button>
    `)
    .join("");

  mainPanel.innerHTML = `
    <div class="planning-shell">
      <div class="panel-title">
        <h2>${taskText.title || "炼器任务"}</h2>
        <span class="badge">${typeof taskText.remainingDays === "function" ? taskText.remainingDays(remainingDays) : remainingDays}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${activity.name}</strong>
        <small>${activity.summary || ""}</small>
        <small>${task && typeof taskText.attemptCount === "function" ? taskText.attemptCount(task.attemptCount || 0) : ""}</small>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card">
          <strong>${taskText.objective || "本次目标"}</strong>
          <small>${objectiveName}</small>
          <small>${typeof taskText.scoreTarget === "function" ? taskText.scoreTarget(taskDef?.objective?.scoreTarget || 0) : ""}</small>
        </div>
        <div class="story-card">
          <strong>${taskText.requirement || "材料要求"}</strong>
          <small>${typeof taskText.requirements === "function" ? taskText.requirements(requirementText) : requirementText}</small>
          <small>${getTaskStatusText(state)}</small>
        </div>
      </div>
      <div class="planning-event-list">
        <div class="activity-grid planning-activity-grid">${cardsHtml}</div>
      </div>
      <div class="action-row">${slotsHtml}</div>
      <div class="story-card" style="margin-top:16px;">
        <strong>${taskText.selected || "当前选牌"}</strong>
        <small>${selectedCard ? getRefiningCardLabel(selectedCard) : taskText.noSelection || "尚未选牌"}</small>
        <small>${getTaskStatusText(state)}</small>
      </div>
      <div class="action-row planning-actions">
        <button class="primary" id="task-confirm-btn" data-task-control="confirm" ${canConfirm ? "" : "disabled"}>${taskText.confirm || "确认结算"}</button>
      </div>
    </div>
  `;

  mainPanel.querySelectorAll("[data-task-card]").forEach((button) => {
    button.addEventListener("click", () => revealOrSelectTaskCard(button.dataset.taskCard));
  });
  mainPanel.querySelectorAll("[data-task-slot]").forEach((button) => {
    button.addEventListener("click", () => placeSelectedTaskCard(Number(button.dataset.taskSlot)));
  });
  mainPanel.querySelector("#task-confirm-btn")?.addEventListener("click", confirmTaskAttempt);
  */
}

function renderSummaryPanel() {
  const rank = state.summary?.rank || UI_TEXT.summary.unranked;
  const bestSkill = state.summary?.bestSkill || ["dao", 0];
  const summaryWeek = getSummaryWeek();
  const summaryTotalWeeks = getSummaryTotalWeeks();
  const canContinue = Boolean(state.summary?.canContinue);
  const taskMarks = Array.isArray(state.summary?.taskMarks) ? state.summary.taskMarks : [];
  const dominantRouteLabels = {
    study: "课业",
    work: "打工",
    training: "修炼",
    balanced: "均衡",
  };
  const dominantRoute = dominantRouteLabels[state.summary?.dominantRoute || "balanced"] || "均衡";
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>${typeof UI_TEXT.summary.panelTitle === "function" ? UI_TEXT.summary.panelTitle(summaryWeek, summaryTotalWeeks) : UI_TEXT.summary.panelTitle}</h2>
      <span class="badge">${rank}</span>
    </div>
    <div class="story-card focus-callout">
      <strong>${state.currentStory.title}</strong>
      <small>${state.currentStory.body}</small>
    </div>
    <div class="summary-grid" style="margin-top:16px;">
      ${metric(UI_TEXT.summary.resourceBalance(RESOURCE_LABELS.coins), state.resources.coins)}
      ${metric(RESOURCE_LABELS.insight, state.resources.insight)}
      ${metric(RESOURCE_LABELS.spirit, state.resources.spirit)}
      ${metric(UI_TEXT.summary.bestSkill, `${SKILL_LABELS[bestSkill[0]]} ${bestSkill[1]}`)}
      ${metric("主路线", dominantRoute)}
    </div>
    <div class="action-row">
      ${canContinue ? `<button class="primary" id="continue-week-btn">${UI_TEXT.summary.continueBtn(summaryWeek, summaryTotalWeeks)}</button>` : ""}
      <button class="primary" id="restart-btn">${UI_TEXT.summary.restartBtn}</button>
    </div>
  `;
  if (taskMarks.length) {
    const summaryGrid = mainPanel.querySelector(".summary-grid");
    if (summaryGrid) {
      summaryGrid.insertAdjacentHTML(
        "beforeend",
        metric(UI_TEXT.summary.taskMarks || "委托印记", taskMarks.map(getTaskMarkLabel).join(" / "))
      );
    }
  }
  if (canContinue) {
    mainPanel.querySelector("#continue-week-btn").addEventListener("click", continueWeek);
  }
  mainPanel.querySelector("#restart-btn").addEventListener("click", restartGame);
}

function renderLogPanel() {
  const recentLogs = state.log.slice(0, 4);
  const recentTimeline = state.timeline.slice(0, 3);
  logPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.log.title}</h2>
      <span class="badge">${state.mode === "resolving" ? UI_TEXT.log.badgeResolving : UI_TEXT.log.badgeDefault}</span>
    </div>
    <div class="feedback-list">
      ${recentTimeline
        .map(
          (item) => `
            <div class="story-card">
              <strong>${UI_TEXT.log.timelineTitle(item.day, item.slot)}</strong>
              <small>${item.activity}</small>
              <small>${item.notes}</small>
            </div>
          `
        )
        .join("")}
      ${!recentTimeline.length ? `<p class="tiny">${UI_TEXT.log.emptyTimeline}</p>` : ""}
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>${UI_TEXT.log.systemTitle}</h3>
      <span class="badge">${UI_TEXT.log.latest4}</span>
    </div>
    <div class="feedback-list">
      ${recentLogs
        .map(
          (entry) => `
            <div class="log-entry">
              <strong>${UI_TEXT.log.entryTitle(entry.day, entry.title)}</strong>
              <small>${entry.body}</small>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderMemoryPanelCompact() {
  const pieces = renderMemoryShardField();
  const blueprints = MEMORY_BUILD_RULES.recipes
    .filter((item, index, list) => list.findIndex((entry) => entry.building === item.building) === index)
    .map(
      (item) => `
        <div class="memory-blueprint-card" data-type="${item.building}">
          <strong>${MEMORY_TYPES[item.building].label}</strong>
          <small>${item.hint}</small>
        </div>
      `
    )
    .join("");
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>短期灵块</h2>
      <span class="badge">${state.memory.lastSummary}</span>
    </div>
    <div class="selection-summary">
      <p class="tiny">先用锚片点亮节点，再把两枚灵块拼成一处建筑。</p>
      <p class="tiny">不同形状只对应灵块类型；颜色只对应可落下的分区。</p>
      <p class="tiny">只有完整建成的建筑会在夜间结算时生效。</p>
    </div>
    <div class="action-row">
      <button class="ghost-button" id="memory-help-btn">${UI_TEXT.memory.helpBtn}</button>
    </div>
    <div class="memory-blueprint-grid">
      ${blueprints}
    </div>
    <div class="memory-fragment-field" style="margin-top:16px;">${pieces}</div>
    <div class="story-card" style="margin-top:16px;">
      <strong>当前夜修进度</strong>
      <small>今夜已完成建筑 ${getMemoryBuiltCount()} 处。未消耗的灵块仍可继续拖到合法目标上。</small>
      <small>专注纹片会继承白天主修方向。前几天还会额外提高衔接纹片与灵台锚片的出现权重，帮助更快开盘。</small>
    </div>
    <div class="action-row">
      <button class="primary" id="end-night-btn">结束夜修</button>
    </div>
  `;
  mainPanel.querySelector("#memory-help-btn").addEventListener("click", () => openInfoModal("memory-rules"));
  mainPanel.querySelectorAll("[data-piece]").forEach((button) => {
    button.addEventListener("click", () => selectMemoryPiece(button.dataset.piece));
    button.addEventListener("dragstart", (event) => {
      startMemoryDrag(button.dataset.piece);
      event.dataTransfer?.setData("text/plain", button.dataset.piece);
      event.dataTransfer.effectAllowed = "move";
    });
    button.addEventListener("dragend", () => {
      endMemoryDrag();
    });
  });
  mainPanel.querySelector("#end-night-btn").addEventListener("click", endNight);
}

function renderLeftPanel() {
  if (state.mode === "course_selection") {
    const blocks = state.courseSelection.blocks || [];
    const requiredBlocks = blocks.filter((block) => block.category !== "elective");
    const electiveBlocks = blocks.filter((block) => block.category === "elective");
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>本周选课</h2>
        <span class="badge">${blocks.filter((block) => block.selectedCourseId).length} / ${blocks.length}</span>
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>选课规则</strong>
          <small>通识必修与专业必修会自动写入整周课表，专业选修需要你亲自决定。</small>
          <small>所有固定课程确认后都会锁定，之后每天只能安排剩余自由时间。</small>
        </div>
        <div class="left-info-card">
          <strong>当前进度</strong>
          <small>必修已锁定：${requiredBlocks.filter((block) => block.selectedCourseId).length} / ${requiredBlocks.length}</small>
          <small>选修已选：${electiveBlocks.filter((block) => block.selectedCourseId).length} / ${electiveBlocks.length}</small>
          <small>${blocks.every((block) => block.selectedCourseId) ? "课表已完整，可以开始本周。" : "右侧还有未选定的选修课。"}</small>
        </div>
      </div>
    `;
    return;
  }

  if (state.mode === "planning" || state.mode === "resolving") {
    const { filled: filledSlots, total: totalEditableSlots } = getEditableScheduleStats();
    const resolvingSlotIndex =
      state.mode === "resolving" ? Math.min(state.resolvingFlow.slotIndex, SLOT_NAMES.length - 1) : state.selectedSlot;
    const currentSlotName = getSlotLabel(resolvingSlotIndex);
    const currentSlotActivity = getActivity(state.schedule[resolvingSlotIndex]);
    const currentSlotLocked = isPlanningSlotLocked(resolvingSlotIndex);
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.left.scheduleTitle}</h2>
        <span class="badge">${UI_TEXT.common.dayBadge(state.day, state.totalDays)}</span>
      </div>
      <div class="left-slot-grid">
        ${SLOT_NAMES.map((slot, index) => {
          const activity = getActivity(state.schedule[index]);
          let cls = "";
          if (state.mode === "resolving") {
            const flow = state.resolvingFlow;
            const finishedCount =
              flow.phase === "opening" || flow.phase === "lead" || flow.phase === "story"
                ? flow.slotIndex
                : Math.min(flow.slotIndex + 1, SLOT_NAMES.length);
            if (index < finishedCount) {
              cls = "done";
            }
            if (index === Math.min(flow.slotIndex, SLOT_NAMES.length - 1) && flow.phase !== "ending") {
              cls = cls ? `${cls} active` : "active";
            }
          } else if (index === state.selectedSlot) {
            cls = "active";
          }
          return `
            <button class="left-slot-card ${cls} ${state.scheduleLocks[index] ? "fixed" : "free"}" data-left-slot="${index}" ${state.mode === "resolving" ? "disabled" : ""}>
              <strong>${slot}</strong>
              <small>${activity ? activity.name : UI_TEXT.common.unassigned}</small>
              <small>${state.scheduleLocks[index] ? "固定课程" : "自由安排"}</small>
            </button>
          `;
        }).join("")}
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>${state.mode === "resolving" ? UI_TEXT.left.stepTitleResolving : UI_TEXT.left.stepTitlePlanning}</strong>
          <small>${
            state.mode === "resolving"
              ? UI_TEXT.left.resolvingStep(currentSlotName, Math.round(state.progress * 100))
              : currentSlotLocked
                ? `${currentSlotName} 为固定课程时段，可查看但不能改动。`
                : UI_TEXT.left.planningStep(currentSlotName)
          }</small>
          <small>${
            state.mode === "resolving"
              ? state.resolvingFlow.autoplay
                ? UI_TEXT.left.resolvingStepHintAuto
                : UI_TEXT.left.resolvingStepHintClick
              : currentSlotLocked
                ? `固定课程：${currentSlotActivity?.name || "未排课"}。请切换到其他自由时段继续安排今天。`
                : UI_TEXT.left.planningStepHint(currentSlotActivity?.name || null, currentSlotName)
          }</small>
        </div>
        <div class="left-info-card">
          <strong>${state.mode === "resolving" ? UI_TEXT.left.progressTitleResolving : UI_TEXT.left.progressTitlePlanning}</strong>
          <small>${
            state.mode === "resolving"
              ? getResolvingProgressText(Math.min(state.resolvingIndex, SLOT_NAMES.length))
              : getPlanningProgressText(filledSlots, totalEditableSlots)
          }</small>
          <small>${state.mode === "resolving" ? UI_TEXT.left.resolvingProgressHint : UI_TEXT.left.planningProgressHint}</small>
        </div>
      </div>
    `;
    leftPanel.querySelectorAll("[data-left-slot]").forEach((button) => {
      button.addEventListener("click", () => setSlot(Number(button.dataset.leftSlot)));
    });
    return;
  }

  if (state.mode === "task") {
    const task = getActiveTaskInstance(state);
    const taskDef = getActiveTaskDef(state);
    const activityName = getTaskActivityName(state, taskDef);
    if (taskDef?.id === "dao_debate") {
      const session = getActiveDaoDebateSession(state);
      const promptTitle = session?.currentPrompt?.title || "当前追问";
      const promptBody = session?.currentPrompt?.body || "请继续回应妙哉偶的追问。";
      const historyRounds = getDaoDebateHistoryRounds(state);
      leftPanel.innerHTML = `
        <div class="panel-title">
          <h2>${UI_TEXT.left.scheduleTitle}</h2>
          <span class="badge">${typeof UI_TEXT.task?.remainingDays === "function" ? UI_TEXT.task.remainingDays(getTaskRemainingDays(state, task)) : getTaskRemainingDays(state, task)}</span>
        </div>
        <div class="left-info-grid">
          <div class="left-info-card">
            <strong>${activityName}</strong>
            <small>${UI_TEXT.left?.daoDebatePromptLabel || "当前追问"}</small>
            <small>${promptTitle}</small>
            <small>${promptBody}</small>
          </div>
          <div class="left-info-card">
            <strong>论辩态势</strong>
            <small>立论 ${session?.conviction || 0}</small>
            <small>破绽 ${session?.exposure || 0}</small>
            <small>${getTaskStatusText(state)}</small>
          </div>
        </div>
        ${
          historyRounds.length
            ? `
              <div class="action-row">
                <button class="ghost-button" id="dao-debate-history-btn" type="button">${UI_TEXT.left?.daoDebateHistoryBtn || "查看前几轮"}</button>
              </div>
            `
            : ""
        }
      `;
      leftPanel.querySelector("#dao-debate-history-btn")?.addEventListener("click", () =>
        openInfoModal("dao-debate-history")
      );
      return;
    }
    const activity = getActiveTaskActivity(state) || { name: activityName };
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.left.scheduleTitle}</h2>
        <span class="badge">${typeof UI_TEXT.task?.remainingDays === "function" ? UI_TEXT.task.remainingDays(getTaskRemainingDays(state, task)) : getTaskRemainingDays(state, task)}</span>
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>${activity.name}</strong>
          <small>${taskDef?.objective?.name || ""}</small>
          <small>${typeof UI_TEXT.task?.requirements === "function" ? UI_TEXT.task.requirements(getTaskRequirementText(taskDef)) : getTaskRequirementText(taskDef)}</small>
        </div>
        <div class="left-info-card">
          <strong>${UI_TEXT.task?.selected || "当前选牌"}</strong>
          <small>${getSelectedTaskCard(state) ? getRefiningCardLabel(getSelectedTaskCard(state)) : UI_TEXT.task?.noSelection || "尚未选牌"}</small>
          <small>${getTaskStatusText(state)}</small>
        </div>
      </div>
    `;
    return;
  }

  if (state.mode === "memory") {
    const builtCount = getMemoryBuiltCount();
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.memory.leftTitle}</h2>
        <span class="badge">${state.memory.placementsToday.length} / ${state.memory.pieces.length}</span>
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>${UI_TEXT.memory.leftGoalTitle}</strong>
          <small>${UI_TEXT.memory.leftGoals[0]}</small>
          <small>${UI_TEXT.memory.leftGoals[1]}</small>
        </div>
        <div class="left-info-card">
          <strong>${UI_TEXT.memory.leftProgressTitle}</strong>
          <small>${UI_TEXT.memory.leftPlaced(state.memory.placementsToday.length)}</small>
          <small>已定型建筑：${builtCount} · ${UI_TEXT.memory.leftRemain(state.memory.pieces.filter((piece) => !piece.used).length)}</small>
        </div>
      </div>
    `;
    return;
  }

  if (state.mode === "summary") {
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>${UI_TEXT.left.summaryTitle}</h2>
        <span class="badge">${state.summary?.rank || UI_TEXT.left.summaryPending}</span>
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>${state.currentStory.title}</strong>
          <small>${state.currentStory.body}</small>
        </div>
        <div class="left-info-card">
          <strong>${UI_TEXT.left.resourcesTitle}</strong>
          <small>${RESOURCE_LABELS.coins} ${state.resources.coins}</small>
          <small>${RESOURCE_LABELS.insight} ${state.resources.insight}</small>
          <small>${RESOURCE_LABELS.spirit} ${state.resources.spirit}</small>
        </div>
      </div>
    `;
    return;
  }

  leftPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.left.bootTitle}</h2>
      <span class="badge">${UI_TEXT.left.bootBadge}</span>
    </div>
    <div class="left-info-grid">
      <div class="left-info-card">
        <strong>${UI_TEXT.left.bootFlowTitle}</strong>
        <small>${UI_TEXT.left.bootFlowBody}</small>
      </div>
      <div class="left-info-card">
        <strong>${UI_TEXT.left.bootOverlayTitle}</strong>
        <small>${UI_TEXT.left.bootOverlayBody}</small>
      </div>
    </div>
  `;
}

function buildTextState() {
  return buildTextStateExport(state, createStateExportContext());
}

window.render_game_to_text = () => JSON.stringify(buildTextState());
window.advanceTime = (ms) => {
  const dt = 1 / 60;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    update(dt);
  }
  render();
};

document.addEventListener(
  "keydown",
  createKeyboardHandler({
    state,
    slotCount: SLOT_NAMES.length,
    clamp,
    toggleStatsPanel,
    setSlot,
    changeArchetype,
    applyArchetypeIfNeeded,
    startRun,
    confirmCourseSelection,
    cycleSelectedActivity,
    assignActivity,
    fillPreset,
    copyPreviousDaySchedule,
    applyRecommendedPreset,
    startDay,
    advanceResolvingFlow,
    toggleResolvingAutoplay,
    focusRandomEventChoice,
    activateRandomEventChoice,
    confirmRandomEventResult,
    focusTaskControl,
    activateTaskControl,
    moveMemoryCursor,
    cycleMemoryPiece,
    placeMemoryPiece,
    endNight,
    continueWeek,
    restartGame,
    toggleFullscreen,
  })
);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

statsToggleBtn.addEventListener("click", () => toggleStatsPanel());
progressToggleBtn.addEventListener("click", () => {
  if (state.ui.infoModal === "progress") {
    closeInfoModal();
    return;
  }
  openInfoModal("progress");
});
feedbackToggleBtn.addEventListener("click", () => {
  if (state.ui.infoModal === "feedback") {
    closeInfoModal();
    return;
  }
  openInfoModal("feedback");
});
timetableToggleBtn?.addEventListener("click", () => {
  if (state.ui.infoModal === "weekly-timetable") {
    closeInfoModal();
    return;
  }
  openInfoModal("weekly-timetable");
});
overlayBackdrop.addEventListener("click", () => {
  if (isRandomEventActive()) {
    return;
  }
  toggleStatsPanel(false);
  closeInfoModal();
});
canvas.addEventListener("click", (event) => {
  if (state.mode !== "task" || typeof buildRefiningStageView !== "function" || typeof hitTestRefiningStage !== "function") {
    return;
  }
  const attempt = getActiveRefiningAttempt(state);
  if (!attempt) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const view = buildRefiningStageView(attempt, REFINING_STAGE_LAYOUT);
  const target = hitTestRefiningStage(view, x, y);
  if (!target) {
    return;
  }
  if (target.kind === "card") {
    revealOrSelectTaskCard(target.id);
    return;
  }
  if (target.kind === "slot") {
    placeSelectedTaskCard(target.index);
  }
});

applyArchetypeIfNeeded();
syncUi();

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
