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
const overlayBackdrop = document.querySelector("#overlay-backdrop");
const memoryStage = document.querySelector("#memory-stage");
const infoModal = document.querySelector("#info-modal");

const {
  SLOT_NAMES,
  SKILL_LABELS,
  MEMORY_TYPES,
  MEMORY_ZONE_META,
  STAT_LABELS,
  RELATIONSHIP_LABELS,
  RESOURCE_LABELS,
  ARCHETYPES,
  ACTIVITIES,
  DEFAULT_SCHEDULES,
  SCHEDULE_PRESETS,
  DAY_MODIFIERS,
  STORY_BEATS,
  RANK_THRESHOLDS,
  COPY,
  UI_TEXT,
} = window.GAME_DATA;

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
  return {
    focus: { math: 0, sigil: 0, dao: 0, craft: 0 },
    tones: { study: 0, life: 0, body: 0, social: 0 },
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
    structure: null,
    day: null,
  }));
}

function createMemoryBridgeState() {
  return MEMORY_HEX_LAYOUT.edges.map(() => null);
}

function createState() {
  return {
    mode: "menu",
    rng: createRng(),
    day: 1,
    totalDays: 7,
    selectedArchetype: ARCHETYPES[0].id,
    selectedSlot: 0,
    selectedActivity: ACTIVITIES[0].id,
    schedule: [null, null, null, null],
    scene: "menu",
    scenePulse: 0,
    progress: 0,
    resolvingIndex: 0,
    phaseTimer: 0,
    resolvingFlow: {
      phase: "idle",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: false,
      autoplayDelay: 1.05,
      autoplayTimer: 0,
      storyTrail: [],
      justAppended: false,
    },
    dayModifier: null,
    currentStory: structuredClone(COPY.initialStory),
    resources: { coins: 18, insight: 0, spirit: 1 },
    stats: {
      intelligence: 4,
      memory: 4,
      stamina: 4,
      inspiration: 4,
      willpower: 4,
      charisma: 3,
      cleanliness: 3,
      mood: 0,
      fatigue: 1,
      selfControl: 3,
      aura: 1,
    },
    skills: { math: 0, sigil: 0, dao: 0, craft: 0 },
    relationships: { roommate: 0, friend: 0, mentor: 0, counselor: 0 },
    storyFlags: createStoryFlags(),
    timeline: [],
    ui: {
      statsOpen: false,
      infoModal: null,
    },
    log: [{ day: 0, ...structuredClone(COPY.introLog) }],
    today: createTodayState(),
    memory: {
      board: createMemoryBoardState(),
      bridges: createMemoryBridgeState(),
      pieces: [],
      selectedPiece: null,
      dragPieceId: null,
      placementsToday: [],
      cursor: { kind: "node", id: MEMORY_HEX_LAYOUT.centerNodeId },
      lastSummary: COPY.memoryPendingSummary,
    },
    summary: null,
  };
}

const state = createState();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addLog(title, body) {
  state.log.unshift({ day: state.day, title, body });
  state.log = state.log.slice(0, 18);
}

function pushTimeline(slotIndex, activity, notes) {
  state.timeline.unshift({ day: state.day, slot: SLOT_NAMES[slotIndex], activity: activity.name, notes });
  state.timeline = state.timeline.slice(0, 12);
}

function getActivity(id) {
  return ACTIVITIES.find((activity) => activity.id === id);
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

function applyPack(target, patch) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    target[key] += value;
  });
}

function defaultScheduleFor(archetypeId) {
  return [...(DEFAULT_SCHEDULES[archetypeId] || DEFAULT_SCHEDULES.scholar)];
}

function chooseArchetype(id) {
  state.selectedArchetype = id;
  const picked = getArchetype(id);
  const chosenCopy = COPY.archetypeChosen(picked.name, picked.summary);
  state.currentStory = {
    title: chosenCopy.title,
    body: chosenCopy.body,
    speaker: UI_TEXT.speakers.survey,
  };
  syncUi();
}

function changeArchetype(delta) {
  const currentIndex = ARCHETYPES.findIndex((item) => item.id === state.selectedArchetype);
  const nextIndex = (currentIndex + delta + ARCHETYPES.length) % ARCHETYPES.length;
  chooseArchetype(ARCHETYPES[nextIndex].id);
}

function applyArchetypeIfNeeded() {
  if (state.summary || state.mode !== "menu") {
    return;
  }
  const base = createState();
  state.resources = structuredClone(base.resources);
  state.stats = structuredClone(base.stats);
  state.skills = structuredClone(base.skills);
  state.relationships = structuredClone(base.relationships);
  const picked = getArchetype(state.selectedArchetype);
  applyPack(state.stats, picked.effect.stats);
  applyPack(state.skills, picked.effect.skills);
  applyPack(state.resources, picked.effect.resources);
  applyPack(state.relationships, picked.effect.relationships);
}

function normalizeState() {
  state.stats.intelligence = clamp(state.stats.intelligence, 0, 12);
  state.stats.memory = clamp(state.stats.memory, 0, 12);
  state.stats.stamina = clamp(state.stats.stamina, 0, 12);
  state.stats.inspiration = clamp(state.stats.inspiration, 0, 12);
  state.stats.willpower = clamp(state.stats.willpower, 0, 12);
  state.stats.charisma = clamp(state.stats.charisma, 0, 12);
  state.stats.cleanliness = clamp(state.stats.cleanliness, 0, 12);
  state.stats.mood = clamp(state.stats.mood, -5, 5);
  state.stats.fatigue = clamp(state.stats.fatigue, 0, 10);
  state.stats.selfControl = clamp(state.stats.selfControl, 0, 10);
  state.stats.aura = clamp(state.stats.aura, 0, 10);
  Object.keys(state.skills).forEach((key) => {
    state.skills[key] = clamp(state.skills[key], 0, 12);
  });
  Object.keys(state.relationships).forEach((key) => {
    state.relationships[key] = clamp(state.relationships[key], -5, 8);
  });
  state.resources.coins = clamp(state.resources.coins, 0, 99);
  state.resources.insight = clamp(state.resources.insight, 0, 99);
  state.resources.spirit = clamp(state.resources.spirit, 0, 20);
}

function applyEffectBundle(bundle) {
  if (!bundle) {
    return;
  }
  applyPack(state.stats, bundle.stats);
  applyPack(state.skills, bundle.skills);
  applyPack(state.resources, bundle.resources);
  applyPack(state.relationships, bundle.relationships);
}

function startRun() {
  state.mode = "planning";
  state.scene = "campus";
  state.storyFlags.introDone = true;
  state.schedule = defaultScheduleFor(state.selectedArchetype);
  state.selectedSlot = 0;
  state.selectedActivity = state.schedule[0] || ACTIVITIES[0].id;
  state.currentStory = structuredClone(COPY.runStartStory);
  addLog(COPY.runStartLog.title, COPY.runStartLog.body);
  syncUi();
}

function fillPreset(presetId) {
  const preset = SCHEDULE_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }
  state.schedule = [...preset.schedule];
  state.selectedActivity = state.schedule[state.selectedSlot] || ACTIVITIES[0].id;
  syncUi();
}

function clearSchedule() {
  state.schedule = [null, null, null, null];
  syncUi();
}

function setSlot(index) {
  if (state.mode !== "planning") {
    return;
  }
  state.selectedSlot = clamp(index, 0, SLOT_NAMES.length - 1);
  state.selectedActivity = state.schedule[state.selectedSlot] || state.selectedActivity || ACTIVITIES[0].id;
  syncUi();
}

function assignActivity(activityId) {
  if (state.mode !== "planning") {
    return;
  }
  if (!getActivity(activityId)) {
    return;
  }
  state.selectedActivity = activityId;
  state.schedule[state.selectedSlot] = activityId;
  syncUi();
}

function cycleSelectedActivity(delta) {
  const currentIndex = ACTIVITIES.findIndex((activity) => activity.id === state.selectedActivity);
  const nextIndex = (currentIndex + delta + ACTIVITIES.length) % ACTIVITIES.length;
  state.selectedActivity = ACTIVITIES[nextIndex].id;
  syncUi();
}

function allSlotsFilled() {
  return state.schedule.every(Boolean);
}

function buildDayModifier() {
  const template = DAY_MODIFIERS.find((modifier) => {
    const value = state.stats[modifier.condition.stat];
    if (typeof modifier.condition.min === "number" && value < modifier.condition.min) {
      return false;
    }
    if (typeof modifier.condition.max === "number" && value > modifier.condition.max) {
      return false;
    }
    return true;
  });

  return template ? { ...structuredClone(template), used: false } : null;
}

function startDay() {
  if (!allSlotsFilled()) {
    state.currentStory = structuredClone(COPY.incompleteSchedule);
    syncUi();
    return;
  }

  state.today = createTodayState();
  state.progress = 0;
  state.resolvingIndex = 0;
  state.phaseTimer = 0;
  state.mode = "resolving";
  state.scene = "resolving";
  state.resolvingFlow = {
    phase: "opening",
    slotIndex: 0,
    segmentIndex: 0,
    autoplay: false,
    autoplayDelay: 1.05,
    autoplayTimer: 0,
    storyTrail: [],
    justAppended: false,
  };
  state.dayModifier = buildDayModifier();

  if (state.dayModifier) {
    const modifierLog = COPY.dayModifierLog(state.day, state.dayModifier);
    addLog(modifierLog.title, modifierLog.body);
  }

  const dayStart = COPY.dayStart(state.day);
  pushResolvingStory(dayStart.title, COPY.dayFlowOpening(state.day), dayStart.speaker);
  syncUi();
}

function getResolvingSlotActivity(slotIndex) {
  return getActivity(state.schedule[slotIndex]) || ACTIVITIES[0];
}

function pushResolvingStory(title, body, speaker) {
  state.currentStory = { title, body, speaker };
  if (state.mode !== "resolving") {
    return;
  }
  const flow = state.resolvingFlow;
  flow.storyTrail.push({ title, body, speaker });
  flow.storyTrail = flow.storyTrail.slice(-32);
  flow.justAppended = true;
}

function resetResolvingStoryTrail() {
  if (state.mode !== "resolving") {
    return;
  }
  state.resolvingFlow.storyTrail = [];
  state.resolvingFlow.justAppended = false;
}

function showResolvingLead(slotIndex) {
  const activity = getResolvingSlotActivity(slotIndex);
  // New schedule slot starts: reset card trail and append from slot opening.
  resetResolvingStoryTrail();
  state.resolvingFlow.segmentIndex = 0;
  pushResolvingStory(
    COPY.dayFlowLeadTitle(SLOT_NAMES[slotIndex]),
    COPY.dayFlowLead(SLOT_NAMES[slotIndex], activity.name),
    UI_TEXT.speakers.schedule
  );
}

function getResolvingSegments(slotIndex) {
  const activity = getResolvingSlotActivity(slotIndex);
  const rawSegments = Array.isArray(activity.storySegments) ? activity.storySegments : [];
  const segments = rawSegments.map((line) => String(line || "").trim()).filter(Boolean);
  return segments.length ? segments : [COPY.dayFlowPlaceholder(SLOT_NAMES[slotIndex], activity.name)];
}

function appendResolvingSegment(slotIndex) {
  const flow = state.resolvingFlow;
  const activity = getResolvingSlotActivity(slotIndex);
  const segments = getResolvingSegments(slotIndex);
  if (flow.segmentIndex >= segments.length) {
    return false;
  }
  const index = flow.segmentIndex;
  pushResolvingStory(
    COPY.dayFlowSegmentTitle(SLOT_NAMES[slotIndex], index, segments.length),
    segments[index],
    activity.tone === "study" ? UI_TEXT.speakers.course : UI_TEXT.speakers.routine
  );
  flow.segmentIndex += 1;
  return true;
}

function resolveSlotForFlow(slotIndex) {
  const activity = getResolvingSlotActivity(slotIndex);
  const notes = applyActivity(activity, slotIndex);
  pushTimeline(slotIndex, activity, notes);

  const detail = COPY.dayFlowResult(SLOT_NAMES[slotIndex], activity.name, notes);
  pushResolvingStory(
    detail.title,
    detail.body,
    activity.tone === "study" ? UI_TEXT.speakers.course : UI_TEXT.speakers.routine
  );
  state.resolvingIndex = slotIndex + 1;
  state.progress = state.resolvingIndex / SLOT_NAMES.length;
}

function advanceResolvingFlow() {
  if (state.mode !== "resolving") {
    return;
  }

  const flow = state.resolvingFlow;
  flow.autoplayTimer = 0;

  if (flow.phase === "opening") {
    flow.phase = "lead";
    showResolvingLead(flow.slotIndex);
    syncUi();
    return;
  }

  if (flow.phase === "lead") {
    if (appendResolvingSegment(flow.slotIndex)) {
      flow.phase = "story";
      syncUi();
      return;
    }
    resolveSlotForFlow(flow.slotIndex);
    flow.phase = "result";
    syncUi();
    return;
  }

  if (flow.phase === "story") {
    if (appendResolvingSegment(flow.slotIndex)) {
      syncUi();
      return;
    }
    resolveSlotForFlow(flow.slotIndex);
    flow.phase = "result";
    syncUi();
    return;
  }

  if (flow.phase === "result") {
    if (flow.slotIndex >= SLOT_NAMES.length - 1) {
      addLog(COPY.dayEndLog.title, COPY.dayEndLog.body);
      pushResolvingStory(COPY.dayEndLog.title, COPY.dayEndLog.body, UI_TEXT.speakers.schedule);
      flow.phase = "ending";
      syncUi();
      return;
    }

    pushResolvingStory(
      COPY.dayFlowOutroTitle(SLOT_NAMES[flow.slotIndex]),
      COPY.dayFlowOutro(SLOT_NAMES[flow.slotIndex]),
      UI_TEXT.speakers.schedule
    );
    flow.phase = "outro";
    syncUi();
    return;
  }

  if (flow.phase === "outro") {
    flow.slotIndex += 1;
    flow.phase = "lead";
    showResolvingLead(flow.slotIndex);
    syncUi();
    return;
  }

  if (flow.phase === "ending") {
    enterMemoryPhase();
  }
}

function toggleResolvingAutoplay(force) {
  if (state.mode !== "resolving") {
    return;
  }
  const flow = state.resolvingFlow;
  flow.autoplay = typeof force === "boolean" ? force : !flow.autoplay;
  flow.autoplayTimer = 0;
  syncUi();
}

function update(dt) {
  state.scenePulse += dt;
  if (state.mode !== "resolving" || !state.resolvingFlow.autoplay) {
    return;
  }
  state.resolvingFlow.autoplayTimer += dt;
  if (state.resolvingFlow.autoplayTimer >= state.resolvingFlow.autoplayDelay) {
    advanceResolvingFlow();
  }
}

function consumeDayModifierIfNeeded(activity) {
  if (!state.dayModifier || state.dayModifier.used) {
    return "";
  }
  if (state.dayModifier.consumeOn === "study" && activity.tone !== "study") {
    return "";
  }
  applyEffectBundle(state.dayModifier.effect);
  state.dayModifier.used = true;
  return COPY.dayModifierApplied(state.dayModifier.title);
}

function applyActivity(activity, slotIndex) {
  const isPreferred = activity.preferred.includes(slotIndex);
  const modifierNote = consumeDayModifierIfNeeded(activity);

  state.today.actions.push(activity.id);
  state.today.tones[activity.tone] += 1;
  if (activity.skill) {
    state.today.focus[activity.skill] += 1;
  }

  const notes = [];
  if (modifierNote) {
    notes.push(modifierNote);
  }

  applyEffectBundle(activity.effects);
  if (activity.notes?.base) {
    notes.push(activity.notes.base);
  }

  if (isPreferred) {
    applyEffectBundle(activity.preferredEffects);
    if (activity.notes?.preferred) {
      notes.push(activity.notes.preferred);
    }
  }

  if (activity.special?.type === "focusSkillBonus") {
    const focus = getMainFocusSkill();
    if (focus) {
      state.skills[focus] += activity.special.amount;
      notes.push(activity.special.noteTemplate.replace("{skill}", SKILL_LABELS[focus]));
    } else if (activity.special.fallbackNote) {
      notes.push(activity.special.fallbackNote);
    }
  }

  triggerStoryBeats(activity, notes);
  normalizeState();
  addLog(`${SLOT_NAMES[slotIndex]} · ${activity.name}`, notes.join(" "));
  return notes.join(" ");
}

function storyBeatMatches(beat, activity) {
  const condition = beat.condition || {};

  if (condition.activityId && activity.id !== condition.activityId) {
    return false;
  }

  if (typeof condition.minDay === "number" && state.day < condition.minDay) {
    return false;
  }

  if (condition.minSkill && state.skills[condition.minSkill.key] < condition.minSkill.value) {
    return false;
  }

  if (condition.maxStat && state.stats[condition.maxStat.key] > condition.maxStat.value) {
    return false;
  }

  if (condition.minRelationship && state.relationships[condition.minRelationship.key] < condition.minRelationship.value) {
    return false;
  }

  if (condition.combinedSkillsAtLeast) {
    const total = condition.combinedSkillsAtLeast.keys.reduce((sum, key) => sum + state.skills[key], 0);
    if (total < condition.combinedSkillsAtLeast.value) {
      return false;
    }
  }

  return true;
}

function triggerStoryBeats(activity, notes) {
  const beat = STORY_BEATS.find((item) => !state.storyFlags[item.id] && storyBeatMatches(item, activity));
  if (!beat) {
    return;
  }

  state.storyFlags[beat.id] = true;
  applyEffectBundle(beat.effect);
  if (beat.note) {
    notes.push(beat.note);
  }
}

function buildMemoryPieces() {
  const pieces = [];
  const pushPiece = (type) => {
    pieces.push({
      id: `day-${state.day}-${type}-${pieces.length}`,
      type,
      used: false,
    });
  };

  pushPiece("base");

  if (getMainFocusSkill() || state.today.tones.study > 0) {
    pushPiece("ability");
  }

  if (state.today.tones.study >= 2 || state.today.actions.includes("homework")) {
    pushPiece("reasoning");
  }

  if (state.today.tones.life > 0 || state.today.tones.body > 0) {
    pushPiece("boost");
  }

  if (
    state.today.tones.social > 0 ||
    Object.values(state.today.tones).filter((count) => count > 0).length >= 3
  ) {
    pushPiece("bridge");
  }

  if (pieces.length === 1) {
    pushPiece("boost");
  }

  return pieces;
}

function normalizeMemoryCursor(cursor = state.memory.cursor) {
  if (
    cursor &&
    cursor.kind === "node" &&
    Number.isInteger(cursor.id) &&
    cursor.id >= 0 &&
    cursor.id < MEMORY_HEX_LAYOUT.nodes.length
  ) {
    return { kind: "node", id: cursor.id };
  }
  if (
    cursor &&
    cursor.kind === "edge" &&
    Number.isInteger(cursor.id) &&
    cursor.id >= 0 &&
    cursor.id < MEMORY_HEX_LAYOUT.edges.length
  ) {
    return { kind: "edge", id: cursor.id };
  }
  return { kind: "node", id: MEMORY_HEX_LAYOUT.centerNodeId };
}

function resolveMemoryTarget(target) {
  if (Number.isInteger(target)) {
    if (target >= 0 && target < MEMORY_HEX_LAYOUT.nodes.length) {
      return { kind: "node", id: target };
    }
    return null;
  }
  if (!target || typeof target !== "object") {
    return null;
  }
  if (
    target.kind === "node" &&
    Number.isInteger(target.id) &&
    target.id >= 0 &&
    target.id < MEMORY_HEX_LAYOUT.nodes.length
  ) {
    return { kind: "node", id: target.id };
  }
  if (
    target.kind === "edge" &&
    Number.isInteger(target.id) &&
    target.id >= 0 &&
    target.id < MEMORY_HEX_LAYOUT.edges.length
  ) {
    return { kind: "edge", id: target.id };
  }
  return null;
}

function isValidNodePlacement(type, nodeId) {
  const node = state.memory.board[nodeId];
  if (!type || !node || !MEMORY_TYPES[type]) {
    return false;
  }

  if (type === "base") {
    return !node.unlocked && !node.structure;
  }

  if (type === "bridge") {
    return false;
  }

  return node.unlocked && !node.structure;
}

function isValidBridgePlacement(edgeId) {
  const edge = MEMORY_HEX_LAYOUT.edges[edgeId];
  if (!edge || state.memory.bridges[edgeId]) {
    return false;
  }
  const left = state.memory.board[edge.a];
  const right = state.memory.board[edge.b];
  return Boolean(left?.structure && right?.structure);
}

function isValidPlacement(type, target) {
  const resolved = resolveMemoryTarget(target);
  if (!type || !resolved || !MEMORY_TYPES[type]) {
    return false;
  }
  if (type === "bridge") {
    return resolved.kind === "edge" && isValidBridgePlacement(resolved.id);
  }
  return resolved.kind === "node" && isValidNodePlacement(type, resolved.id);
}

function selectMemoryPiece(pieceId) {
  if (state.mode !== "memory") {
    return;
  }
  const piece = state.memory.pieces.find((item) => item.id === pieceId && !item.used);
  if (!piece) {
    return;
  }
  state.memory.selectedPiece = piece.id;
  state.memory.dragPieceId = null;
  syncUi();
}

function startMemoryDrag(pieceId) {
  if (state.mode !== "memory") {
    return;
  }
  const piece = state.memory.pieces.find((item) => item.id === pieceId && !item.used);
  if (!piece) {
    return;
  }
  state.memory.selectedPiece = piece.id;
  state.memory.dragPieceId = piece.id;
}

function endMemoryDrag() {
  if (state.mode !== "memory" || !state.memory.dragPieceId) {
    return;
  }
  state.memory.dragPieceId = null;
  syncUi();
}

function moveMemoryCursor(dx, dy) {
  if (state.mode !== "memory") {
    return;
  }
  const cursor = normalizeMemoryCursor();
  const currentNodeId =
    cursor.kind === "node" ? cursor.id : (MEMORY_HEX_LAYOUT.edges[cursor.id]?.a ?? MEMORY_HEX_LAYOUT.centerNodeId);
  const current = MEMORY_HEX_LAYOUT.nodes[currentNodeId];
  let bestNodeId = currentNodeId;
  let bestScore = -Infinity;

  current.neighbors.forEach((neighborId) => {
    const neighbor = MEMORY_HEX_LAYOUT.nodes[neighborId];
    const vx = neighbor.ux - current.ux;
    const vy = neighbor.uy - current.uy;
    const score = vx * dx + vy * dy;
    if (score > bestScore) {
      bestScore = score;
      bestNodeId = neighborId;
    }
  });

  if (bestScore > 0) {
    state.memory.cursor = { kind: "node", id: bestNodeId };
  } else {
    state.memory.cursor = { kind: "node", id: currentNodeId };
  }
  syncUi();
}

function cycleMemoryPiece(delta) {
  if (state.mode !== "memory") {
    return;
  }
  const available = state.memory.pieces.filter((piece) => !piece.used);
  if (!available.length) {
    state.memory.selectedPiece = null;
    syncUi();
    return;
  }
  const currentIndex = Math.max(
    0,
    available.findIndex((piece) => piece.id === state.memory.selectedPiece)
  );
  const nextIndex = (currentIndex + delta + available.length) % available.length;
  state.memory.selectedPiece = available[nextIndex].id;
  state.memory.dragPieceId = null;
  syncUi();
}

function enterMemoryPhase() {
  state.mode = "memory";
  state.scene = "memory";
  state.memory.pieces = buildMemoryPieces();
  state.memory.selectedPiece = state.memory.pieces.find((piece) => !piece.used)?.id || null;
  state.memory.dragPieceId = null;
  state.memory.placementsToday = [];
  state.memory.cursor = { kind: "node", id: MEMORY_HEX_LAYOUT.centerNodeId };
  const story = COPY.memoryStart(state.memory.pieces.length);
  state.currentStory = {
    title: story.title,
    body: story.body,
    speaker: story.speaker,
  };
  state.memory.lastSummary = story.summary;
  syncUi();
}

function placeMemoryPiece(target, pieceId = state.memory.selectedPiece) {
  const resolvedTarget = resolveMemoryTarget(target ?? state.memory.cursor);
  const piece = state.memory.pieces.find((item) => item.id === pieceId);
  if (!piece || piece.used || !resolvedTarget) {
    return;
  }
  if (!isValidPlacement(piece.type, resolvedTarget)) {
    state.currentStory = COPY.invalidPlacement(MEMORY_TYPES[piece.type].label);
    syncUi();
    return;
  }

  if (piece.type === "base") {
    const node = state.memory.board[resolvedTarget.id];
    node.unlocked = true;
    node.unlockedDay = state.day;
    state.memory.placementsToday.push({
      kind: "node",
      nodeId: resolvedTarget.id,
      type: piece.type,
    });
  } else if (piece.type === "bridge") {
    state.memory.bridges[resolvedTarget.id] = { type: "bridge", day: state.day };
    state.memory.placementsToday.push({
      kind: "edge",
      edgeId: resolvedTarget.id,
      type: piece.type,
    });
  } else {
    const node = state.memory.board[resolvedTarget.id];
    node.structure = piece.type;
    node.day = state.day;
    state.memory.placementsToday.push({
      kind: "node",
      nodeId: resolvedTarget.id,
      type: piece.type,
    });
  }

  piece.used = true;
  state.memory.dragPieceId = null;
  state.memory.selectedPiece = state.memory.pieces.find((item) => !item.used)?.id || null;
  state.memory.cursor = resolvedTarget;
  state.memory.lastSummary = UI_TEXT.memory.placedSummary(state.memory.placementsToday.length, state.memory.pieces.length);
  syncUi();
}

function endNight() {
  const placed = state.memory.placementsToday;
  if (!placed.length) {
    state.currentStory = structuredClone(COPY.emptyNightFinish);
    syncUi();
    return;
  }

  const summary = [];
  let spiritGain = 0;
  placed.forEach((item) => {
    if (item.type === "base") {
      state.resources.insight += 1;
      summary.push(COPY.nightEffects.baseUnlock);
    }
    if (item.type === "ability") {
      const focus = getMainFocusSkill() || "dao";
      state.skills[focus] += 1;
      spiritGain += 1;
      summary.push(COPY.nightEffects.abilityBoost(SKILL_LABELS[focus]));
    }
    if (item.type === "boost") {
      state.stats.fatigue -= 1;
      state.stats.mood += 1;
      summary.push(COPY.nightEffects.boostRecover);
    }
    if (item.type === "reasoning") {
      state.stats.intelligence += 1;
      state.stats.inspiration += 1;
      summary.push(COPY.nightEffects.reasoningBreakthrough);
    }
    if (item.type === "bridge") {
      state.stats.memory += 1;
      summary.push(COPY.nightEffects.bridgeLink);
    }
  });

  let resonanceBonus = 0;
  state.memory.bridges.forEach((bridge, edgeId) => {
    if (!bridge) {
      return;
    }
    const edge = MEMORY_HEX_LAYOUT.edges[edgeId];
    const left = state.memory.board[edge.a]?.structure;
    const right = state.memory.board[edge.b]?.structure;
    if (
      (left === "ability" && right === "reasoning") ||
      (left === "reasoning" && right === "ability")
    ) {
      resonanceBonus += 1;
    }
  });
  if (resonanceBonus > 0) {
    spiritGain += resonanceBonus;
    summary.push(COPY.nightEffects.resonance(resonanceBonus));
  }

  state.resources.spirit += spiritGain;
  normalizeState();

  const summaryText = summary.join(" ");
  const nightLog = COPY.nightLog(state.day, summaryText);
  addLog(nightLog.title, nightLog.body);
  state.currentStory = COPY.nightSummary(state.day, summaryText);

  if (state.day >= state.totalDays) {
    finishRun();
    return;
  }

  state.day += 1;
  state.mode = "planning";
  state.scene = "campus";
  state.schedule = defaultScheduleFor(state.selectedArchetype);
  state.selectedSlot = 0;
  state.selectedActivity = state.schedule[0];
  state.dayModifier = null;
  syncUi();
}

function computeRank() {
  const score =
    state.resources.spirit * 1.8 +
    state.resources.insight * 0.4 +
    state.stats.aura * 0.8 +
    state.skills.math +
    state.skills.sigil +
    state.skills.dao +
    state.skills.craft;

  return RANK_THRESHOLDS.find((item) => score >= item.min).label;
}

function finishRun() {
  const bestSkill = Object.entries(state.skills).sort((a, b) => b[1] - a[1])[0];
  const rank = computeRank();
  const majorBeat = state.storyFlags.missingClue ? COPY.summary.clueMajorBeat : COPY.summary.defaultMajorBeat;
  const body = COPY.summary.body(rank, SKILL_LABELS[bestSkill[0]]);

  state.summary = {
    rank,
    bestSkill,
    majorBeat,
  };
  state.mode = "summary";
  state.scene = "summary";
  state.currentStory = {
    title: COPY.summary.title,
    body,
    speaker: COPY.summary.speaker,
  };
  addLog(COPY.summary.logTitle, `${body} ${majorBeat}`);
  syncUi();
}

function restartGame() {
  const fresh = createState();
  Object.keys(fresh).forEach((key) => {
    state[key] = fresh[key];
  });
  syncUi();
}

function render() {
  drawBackground();
  drawScene();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#09131d");
  gradient.addColorStop(0.45, "#10253a");
  gradient.addColorStop(1, "#08121c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 44; i += 1) {
    const x = (i * 71 + Math.sin(state.scenePulse * 0.6 + i) * 18 + 40) % canvas.width;
    const y = (i * 29 + Math.cos(state.scenePulse * 0.4 + i) * 22 + 50) % canvas.height;
    ctx.fillStyle = `rgba(255,255,255,${0.03 + ((i % 7) * 0.006)})`;
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
  if (state.mode === "memory") {
    drawMemoryScene();
    return;
  }
  if (state.mode === "summary") {
    drawSummaryScene();
    return;
  }
  if (state.mode === "resolving") {
    drawResolvingScene();
    return;
  }
  drawPlanningScene();
}

function drawMenuScene() {
  drawAcademyBackdrop("#143048", "#0a1625");
  drawBanner(UI_TEXT.canvas.menuTitle, UI_TEXT.canvas.menuSubtitle);
  drawFloatingCards(UI_TEXT.canvas.menuCards, 118);
}

function drawPlanningScene() {
  drawAcademyBackdrop("#173856", "#0d1a28");
  drawBanner(UI_TEXT.canvas.planningTitle(state.day), UI_TEXT.canvas.planningSubtitle);
  drawTimelineStrip();
  drawStatConstellation();
}

function drawResolvingScene() {
  const current = getActivity(state.schedule[Math.min(state.resolvingIndex, 3)]) || getActivity(state.schedule[3]);
  const palettes = {
    lecture: ["#10263d", "#1e4d6f"],
    seminar: ["#1a2543", "#37538b"],
    workshop: ["#2b1e28", "#7c4b54"],
    desk: ["#1f252f", "#5c6672"],
    cafeteria: ["#2a2116", "#896139"],
    dorm: ["#1b2233", "#49617d"],
    training: ["#13231c", "#32674e"],
    arcade: ["#23192f", "#724d88"],
    city: ["#152432", "#587c8f"],
    job: ["#2d2419", "#876b3e"],
  };
  const palette = palettes[current.scene] || ["#12283e", "#2f5b78"];
  drawAcademyBackdrop(palette[0], palette[1]);
  drawBanner(UI_TEXT.canvas.resolvingTitle(state.day, current.name), UI_TEXT.canvas.resolvingSubtitle);

  const centerX = canvas.width * 0.3;
  const centerY = canvas.height * 0.62;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(0, 0, 86 + Math.sin(state.scenePulse * 2.4) * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0c36c";
  ctx.beginPath();
  ctx.arc(0, -46, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9e4ff";
  ctx.fillRect(-24, -24, 48, 88);
  ctx.fillStyle = current.scene === "workshop" ? "#ef8f85" : current.scene === "training" ? "#63d3b1" : "#89bbff";
  ctx.fillRect(-54, 18, 108, 16);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "24px 'Microsoft YaHei'";
  ctx.fillText(UI_TEXT.canvas.resolvingSlot(SLOT_NAMES[Math.min(state.resolvingFlow.slotIndex, 3)]), 470, 210);
  ctx.font = "18px 'Microsoft YaHei'";
  wrapText(current.summary, 470, 250, 360, 32, "#c8d7ea");
  drawCanvasProgress(470, 330, 340, 16, state.progress);
  drawTimelineStrip();
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
  drawAcademyBackdrop("#172036", "#274b6c");
  drawBanner(UI_TEXT.canvas.summaryTitle, UI_TEXT.canvas.summarySubtitle);
  const rank = state.summary?.rank || UI_TEXT.summary.unranked;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(150, 160, 660, 240);
  ctx.strokeStyle = "rgba(240,195,108,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 160, 660, 240);
  ctx.fillStyle = "#f0c36c";
  ctx.font = "48px 'STZhongsong', 'Microsoft YaHei'";
  ctx.fillText(rank, 420, 255);
  ctx.fillStyle = "#e8f1ff";
  ctx.font = "22px 'Microsoft YaHei'";
  ctx.fillText(UI_TEXT.canvas.summaryBest(SKILL_LABELS[state.summary.bestSkill[0]], state.summary.bestSkill[1]), 250, 310);
  wrapText(state.summary.majorBeat, 250, 350, 460, 30, "#c9d8ea");
}

function drawAcademyBackdrop(topColor, bottomColor) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 9; i += 1) {
    const height = 120 + (i % 4) * 48;
    ctx.fillRect(i * 120, canvas.height - height, 90, height);
  }
  ctx.fillStyle = "rgba(240,195,108,0.15)";
  ctx.beginPath();
  ctx.arc(canvas.width - 180, 110, 56, 0, Math.PI * 2);
  ctx.fill();
}

function drawBanner(title, subtitle) {
  ctx.fillStyle = "rgba(8,18,29,0.7)";
  ctx.fillRect(44, 36, 872, 112);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(44, 36, 872, 112);
  ctx.fillStyle = "#edf4ff";
  ctx.font = "42px 'STZhongsong', 'Microsoft YaHei'";
  ctx.fillText(title, 72, 90);
  ctx.font = "18px 'Microsoft YaHei'";
  ctx.fillStyle = "#b8c9dc";
  ctx.fillText(subtitle, 72, 124);
}

function drawFloatingCards(labels, y) {
  labels.forEach((label, index) => {
    const x = 110 + index * 190 + Math.sin(state.scenePulse + index) * 10;
    const offsetY = y + Math.cos(state.scenePulse * 1.2 + index) * 8;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, offsetY, 160, 90);
    ctx.strokeStyle = "rgba(137,187,255,0.28)";
    ctx.strokeRect(x, offsetY, 160, 90);
    ctx.fillStyle = "#edf4ff";
    ctx.font = "22px 'Microsoft YaHei'";
    ctx.fillText(label, x + 22, offsetY + 52);
  });
}

function drawTimelineStrip() {
  const startX = 82;
  const y = 444;
  SLOT_NAMES.forEach((name, index) => {
    const x = startX + index * 210;
    ctx.fillStyle = index < state.resolvingIndex ? "rgba(99,211,177,0.35)" : "rgba(255,255,255,0.08)";
    if (state.mode === "planning" && state.selectedSlot === index) {
      ctx.fillStyle = "rgba(137,187,255,0.28)";
    }
    ctx.fillRect(x, y, 178, 54);
    ctx.fillStyle = "#edf4ff";
    ctx.font = "18px 'Microsoft YaHei'";
    ctx.fillText(name, x + 16, y + 24);
    const activity = getActivity(state.schedule[index]);
    ctx.fillStyle = "#b8c9dc";
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
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
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
  ctx.fillStyle = "rgba(99,211,177,0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(99,211,177,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
  points.forEach((point) => {
    const x = centerX + Math.cos(point.angle) * (radius + 30);
    const y = centerY + Math.sin(point.angle) * (radius + 30);
    ctx.fillStyle = "#edf4ff";
    ctx.font = "16px 'Microsoft YaHei'";
    ctx.fillText(`${point.label} ${point.value}`, x - 30, y);
  });
}

function drawCanvasProgress(x, y, width, height, progress) {
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#63d3b1";
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
  if (state.mode === "resolving") return Math.min(state.resolvingFlow.slotIndex, 3);
  if (state.mode === "memory") return 3;
  return 3;
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
    return;
  }
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

function syncUi() {
  renderLeftPanel();
  renderTopPanel();
  renderFlowPanel();
  renderMainPanel();
  renderLogPanel();
  renderMemoryStage();
  renderInfoModal();
  topPanel.classList.toggle("hidden", !state.ui.statsOpen);
  infoModal.classList.toggle("hidden", !state.ui.infoModal);
  overlayBackdrop.classList.toggle("hidden", !state.ui.statsOpen && !state.ui.infoModal);
  statsToggleBtn.textContent = state.ui.statsOpen ? UI_TEXT.toolbar.statsClose : UI_TEXT.toolbar.statsOpen;
  progressToggleBtn.textContent = UI_TEXT.toolbar.progress;
  feedbackToggleBtn.textContent = UI_TEXT.toolbar.feedback;
  document.body.classList.toggle("memory-mode", state.mode === "memory");
  memoryStage.classList.toggle("hidden", state.mode !== "memory");
  canvas.classList.toggle("hidden", state.mode === "memory");
  statusLine.textContent =
    state.mode === "planning"
      ? UI_TEXT.statusLine.planning(state.day, SLOT_NAMES[state.selectedSlot])
      : state.mode === "resolving"
        ? UI_TEXT.statusLine.resolving(state.day, Math.round(state.progress * 100), state.resolvingFlow.autoplay)
        : state.mode === "memory"
          ? UI_TEXT.statusLine.memory(state.day)
          : state.mode === "summary"
            ? UI_TEXT.statusLine.summary
            : UI_TEXT.statusLine.menu;
}

function renderFlowPanel() {
  const phaseIndex = getCurrentPhaseIndex();
  const quickCards = getQuickStatusCards();
  const currentActivity = getActivity(state.schedule[Math.max(0, Math.min(state.selectedSlot, 3))]);
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
              : state.mode === "planning"
                ? UI_TEXT.flow.planningHint(currentActivity ? currentActivity.name : null)
                : state.mode === "resolving"
                  ? state.resolvingFlow.autoplay
                    ? UI_TEXT.flow.resolvingHintAuto
                    : UI_TEXT.flow.resolvingHintClick
                  : state.mode === "memory"
                    ? UI_TEXT.flow.memoryHint
                    : UI_TEXT.flow.summaryHint
          }</small>
          <small>${UI_TEXT.flow.hotkeys}</small>
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
  const activeActivity = getActivity(state.selectedActivity) || ACTIVITIES[0];
  if (state.mode === "resolving") {
    const flow = state.resolvingFlow;
    const currentIndex = Math.min(flow.slotIndex, 3);
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
          <span class="badge">${SLOT_NAMES[currentIndex]}</span>
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
  const filledSlots = state.schedule.filter(Boolean).length;
  mainPanel.innerHTML = `
    <div class="planning-shell">
      <div class="panel-title">
        <h2>${UI_TEXT.planning.eventTitle}</h2>
        <span class="badge">${SLOT_NAMES[state.selectedSlot]}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${SLOT_NAMES[state.selectedSlot]}</strong>
        <small>${UI_TEXT.planning.eventHelp}</small>
        <small>${UI_TEXT.planning.eventPicked(selectedSlotActivity?.name || null)}</small>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card">
          <strong>${UI_TEXT.planning.preparingTitle}</strong>
          <small>${activeActivity.name}</small>
          <small>${activeActivity.summary}</small>
        </div>
        <div class="story-card">
          <strong>${UI_TEXT.planning.scheduleTitle}</strong>
          <small>${UI_TEXT.planning.scheduleFilled(filledSlots)}</small>
          <small>${UI_TEXT.planning.scheduleHint(filledSlots)}</small>
        </div>
      </div>
      <div class="planning-event-list">
        <div class="activity-grid planning-activity-grid">
          ${ACTIVITIES.map(
            (activity) => `
              <button class="activity-card ${state.selectedActivity === activity.id ? "active" : ""}" data-activity="${activity.id}" data-tone="${activity.tone}">
                <strong>${activity.name}</strong>
                <small>${activity.summary}</small>
              </button>
            `
          ).join("")}
        </div>
      </div>
      <div class="action-row planning-actions">
        ${SCHEDULE_PRESETS.map(
          (preset) => `<button class="ghost-button" data-preset="${preset.id}">${preset.label}</button>`
        ).join("")}
        <button class="ghost-button warn" id="clear-btn">${UI_TEXT.planning.clear}</button>
        <button class="primary" id="execute-btn">${UI_TEXT.planning.execute}</button>
      </div>
    </div>
  `;
  mainPanel.querySelectorAll("[data-activity]").forEach((button) => {
    button.addEventListener("click", () => assignActivity(button.dataset.activity));
  });
  mainPanel.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => fillPreset(button.dataset.preset));
  });
  mainPanel.querySelector("#clear-btn").addEventListener("click", clearSchedule);
  mainPanel.querySelector("#execute-btn").addEventListener("click", startDay);
}

function renderMainPanel() {
  if (state.mode === "menu") {
    renderMenuPanel();
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
      const valid = activePiece?.type === "bridge" && isValidPlacement("bridge", { kind: "edge", id: edge.index });
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
      const valid = activePiece?.type === "bridge" && isValidPlacement("bridge", { kind: "edge", id: edge.index });
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
      const valid = activePiece?.type
        ? isValidPlacement(activePiece.type, { kind: "node", id: node.index })
        : false;
      const active = cursor.kind === "node" && cursor.id === node.index;
      const title = !nodeState.unlocked
        ? UI_TEXT.memory.nodeLockedTitle
        : structureType
          ? MEMORY_TYPES[structureType].label
          : UI_TEXT.memory.nodeUnlockedTitle;
      const desc = !nodeState.unlocked
        ? UI_TEXT.memory.nodeLockedDesc
        : structureType
          ? UI_TEXT.memory.nodeBuiltDesc(nodeState.day)
          : UI_TEXT.memory.nodeEmptyDesc;
      const zoneLabel = MEMORY_ZONE_META[node.zone].label;
      return `
        <button
          class="memory-node zone-${node.zone} ${nodeState.unlocked ? "unlocked" : "locked"} ${structureType ? "filled" : ""} ${valid ? "valid" : ""} ${active ? "active" : ""}"
          data-memory-node="${node.index}"
          data-zone="${node.zone}"
          data-type="${structureType || ""}"
          style="left:${node.ux}%;top:${node.uy}%;"
          type="button"
          aria-label="${UI_TEXT.memory.nodeAria(node.index)} - ${zoneLabel} - ${title} - ${desc}"
        >
          <span class="memory-node-dot" aria-hidden="true"></span>
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
        <span class="badge">${activePiece ? UI_TEXT.memory.stageCurrentPiece(MEMORY_TYPES[activePiece.type].label) : UI_TEXT.memory.stageSelectHint}</span>
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
        if (!draggingPiece || !isValidPlacement(draggingPiece.type, target)) {
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
        if (activePiece && isValidPlacement(activePiece.type, target)) {
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
  const pieces = state.memory.pieces
    .map(
      (piece) => `
        <button
          class="memory-token ${piece.id === state.memory.selectedPiece ? "active" : ""} ${piece.id === state.memory.dragPieceId ? "dragging" : ""} ${piece.used ? "disabled" : ""}"
          data-piece="${piece.id}"
          data-type="${piece.type}"
          draggable="${piece.used ? "false" : "true"}"
          ${piece.used ? "disabled" : ""}
        >
          <strong>${MEMORY_TYPES[piece.type].label}</strong>
          <small>${MEMORY_TYPES[piece.type].desc}</small>
        </button>
      `
    )
    .join("");
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.memory.panelTitle}</h2>
      <span class="badge">${state.memory.lastSummary}</span>
    </div>
    <div class="selection-summary">
      <p class="tiny">${UI_TEXT.memory.steps[0]}</p>
      <p class="tiny">${UI_TEXT.memory.steps[1]}</p>
      <p class="tiny">${UI_TEXT.memory.steps[2]}</p>
    </div>
    <div class="tower-grid">
      ${Object.entries(MEMORY_TYPES)
        .map(
          ([, meta]) => `
            <div class="tower-card">
              <strong style="color:${meta.accent};">${meta.label}</strong>
              <span>${meta.desc}</span>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="memory-pieces" style="margin-top:16px;">${pieces}</div>
    <div class="story-card" style="margin-top:16px;">
      <strong>${UI_TEXT.memory.tipsTitle}</strong>
      <small>${UI_TEXT.memory.tips[0]}</small>
      <small>${UI_TEXT.memory.tips[1]}</small>
    </div>
    <div class="action-row">
      <button class="primary" id="end-night-btn">${UI_TEXT.memory.endBtn}</button>
    </div>
  `;
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

function renderSummaryPanel() {
  const rank = state.summary?.rank || UI_TEXT.summary.unranked;
  const bestSkill = state.summary?.bestSkill || ["dao", 0];
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.summary.panelTitle}</h2>
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
    </div>
    <div class="action-row">
      <button class="primary" id="restart-btn">${UI_TEXT.summary.restartBtn}</button>
    </div>
  `;
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
  const pieces = state.memory.pieces
    .map(
      (piece) => `
        <button
          class="memory-token ${piece.id === state.memory.selectedPiece ? "active" : ""} ${piece.id === state.memory.dragPieceId ? "dragging" : ""} ${piece.used ? "disabled" : ""}"
          data-piece="${piece.id}"
          data-type="${piece.type}"
          draggable="${piece.used ? "false" : "true"}"
          ${piece.used ? "disabled" : ""}
        >
          <strong>${MEMORY_TYPES[piece.type].label}</strong>
          <small>${MEMORY_TYPES[piece.type].desc}</small>
        </button>
      `
    )
    .join("");
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.memory.panelTitle}</h2>
      <span class="badge">${state.memory.lastSummary}</span>
    </div>
    <div class="selection-summary">
      <p class="tiny">${UI_TEXT.memory.steps[0]}</p>
      <p class="tiny">${UI_TEXT.memory.steps[1]}</p>
      <p class="tiny">${UI_TEXT.memory.steps[2]}</p>
    </div>
    <div class="action-row">
      <button class="ghost-button" id="memory-help-btn">${UI_TEXT.memory.helpBtn}</button>
    </div>
    <div class="memory-pieces" style="margin-top:16px;">${pieces}</div>
    <div class="story-card" style="margin-top:16px;">
      <strong>${UI_TEXT.memory.tipsTitle}</strong>
      <small>${UI_TEXT.memory.tips[0]}</small>
      <small>${UI_TEXT.memory.tips[1]}</small>
    </div>
    <div class="action-row">
      <button class="primary" id="end-night-btn">${UI_TEXT.memory.endBtn}</button>
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
  if (state.mode === "planning" || state.mode === "resolving") {
    const filledSlots = state.schedule.filter(Boolean).length;
    const resolvingSlotIndex =
      state.mode === "resolving" ? Math.min(state.resolvingFlow.slotIndex, SLOT_NAMES.length - 1) : state.selectedSlot;
    const currentSlotName = SLOT_NAMES[resolvingSlotIndex];
    const currentSlotActivity = getActivity(state.schedule[resolvingSlotIndex]);
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
            <button class="left-slot-card ${cls}" data-left-slot="${index}" ${state.mode === "resolving" ? "disabled" : ""}>
              <strong>${slot}</strong>
              <small>${activity ? activity.name : UI_TEXT.common.unassigned}</small>
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
              : UI_TEXT.left.planningStep(currentSlotName)
          }</small>
          <small>${
            state.mode === "resolving"
              ? state.resolvingFlow.autoplay
                ? UI_TEXT.left.resolvingStepHintAuto
                : UI_TEXT.left.resolvingStepHintClick
              : UI_TEXT.left.planningStepHint(currentSlotActivity?.name || null, currentSlotName)
          }</small>
        </div>
        <div class="left-info-card">
          <strong>${state.mode === "resolving" ? UI_TEXT.left.progressTitleResolving : UI_TEXT.left.progressTitlePlanning}</strong>
          <small>${
            state.mode === "resolving"
              ? UI_TEXT.left.resolvingProgress(Math.min(state.resolvingIndex, 4))
              : UI_TEXT.left.planningProgress(filledSlots)
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

  if (state.mode === "memory") {
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
          <small>${UI_TEXT.memory.leftRemain(state.memory.pieces.filter((piece) => !piece.used).length)}</small>
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
  const selectedPieceType = state.memory.pieces.find((piece) => piece.id === state.memory.selectedPiece)?.type || null;
  const cursor = normalizeMemoryCursor(state.memory.cursor);
  const validNodes =
    selectedPieceType && selectedPieceType !== "bridge"
      ? MEMORY_HEX_LAYOUT.nodes
          .filter((node) => isValidPlacement(selectedPieceType, { kind: "node", id: node.index }))
          .map((node) => ({ id: node.index, q: node.q, r: node.r }))
      : [];
  const validEdges =
    selectedPieceType === "bridge"
      ? MEMORY_HEX_LAYOUT.edges
          .filter((edge) => isValidPlacement("bridge", { kind: "edge", id: edge.index }))
          .map((edge) => ({ id: edge.index, from: edge.a, to: edge.b }))
      : [];

  return {
    coordinate_system: UI_TEXT.stateExport.coordinateSystem,
    mode: state.mode,
    day: state.day,
    selected_archetype: state.selectedArchetype,
    current_story: state.currentStory.title,
    schedule: SLOT_NAMES.map((slot, index) => ({
      slot,
      action: getActivity(state.schedule[index])?.name || UI_TEXT.common.unassigned,
      selected: state.selectedSlot === index,
    })),
    stats: state.stats,
    skills: state.skills,
    resources: state.resources,
    relationships: state.relationships,
    ui: state.ui,
    resolving: {
      current_slot_index: state.resolvingFlow.slotIndex,
      phase: state.resolvingFlow.phase,
      autoplay: state.resolvingFlow.autoplay,
      progress: Number(state.progress.toFixed(2)),
      segment_index: state.resolvingFlow.segmentIndex,
      segment_total: getResolvingSegments(Math.min(state.resolvingFlow.slotIndex, SLOT_NAMES.length - 1)).length,
      story_lines: state.resolvingFlow.storyTrail.map((item) => ({
        title: item.title,
        body: item.body,
      })),
    },
    memory: {
      selected_piece: selectedPieceType,
      cursor:
        cursor.kind === "node"
          ? {
              kind: "node",
              id: cursor.id,
              q: MEMORY_HEX_LAYOUT.nodes[cursor.id].q,
              r: MEMORY_HEX_LAYOUT.nodes[cursor.id].r,
              zone: MEMORY_HEX_LAYOUT.nodes[cursor.id].zone,
            }
          : {
              kind: "edge",
              id: cursor.id,
              from: MEMORY_HEX_LAYOUT.edges[cursor.id].a,
              to: MEMORY_HEX_LAYOUT.edges[cursor.id].b,
            },
      valid_nodes: validNodes,
      valid_edges: validEdges,
      pieces_left: state.memory.pieces.filter((piece) => !piece.used).map((piece) => piece.type),
      board: state.memory.board.map((nodeState, index) => ({
        index,
        q: MEMORY_HEX_LAYOUT.nodes[index].q,
        r: MEMORY_HEX_LAYOUT.nodes[index].r,
        zone: nodeState.zone,
        unlocked: nodeState.unlocked,
        unlocked_day: nodeState.unlockedDay,
        structure: nodeState.structure,
        structure_day: nodeState.day,
      })),
      bridges: state.memory.bridges.map((bridge, edgeId) => ({
        edge_id: edgeId,
        from: MEMORY_HEX_LAYOUT.edges[edgeId].a,
        to: MEMORY_HEX_LAYOUT.edges[edgeId].b,
        built: Boolean(bridge),
        day: bridge?.day ?? null,
      })),
    },
    summary: state.summary,
  };
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

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "a", "b", "f", "i", "p"].includes(key) || event.key === " ") {
    event.preventDefault();
  }
  if (key === "i") {
    toggleStatsPanel();
  }
  if (event.key >= "1" && event.key <= "4" && state.mode === "planning") {
    setSlot(Number(event.key) - 1);
  }
  if (state.mode === "menu") {
    if (key === "arrowleft") changeArchetype(-1);
    if (key === "arrowright") changeArchetype(1);
    if (key === "enter") {
      applyArchetypeIfNeeded();
      startRun();
    }
  }
  if (state.mode === "planning") {
    if (key === "arrowleft") setSlot(clamp(state.selectedSlot - 1, 0, 3));
    if (key === "arrowright") setSlot(clamp(state.selectedSlot + 1, 0, 3));
    if (key === "arrowup") cycleSelectedActivity(-1);
    if (key === "arrowdown") cycleSelectedActivity(1);
    if (key === " ") assignActivity(state.selectedActivity);
    if (key === "a") fillPreset("balanced");
    if (key === "b") fillPreset("body_expand");
  }
  if (event.key === "Enter" && state.mode === "planning") {
    startDay();
  }
  if (state.mode === "resolving") {
    if (key === " " || key === "enter") advanceResolvingFlow();
    if (key === "p") toggleResolvingAutoplay();
  }
  if (state.mode === "memory") {
    if (key === "arrowleft") moveMemoryCursor(-1, 0);
    if (key === "arrowright") moveMemoryCursor(1, 0);
    if (key === "arrowup") moveMemoryCursor(0, -1);
    if (key === "arrowdown") moveMemoryCursor(0, 1);
    if (key === "a") cycleMemoryPiece(-1);
    if (key === "b") cycleMemoryPiece(1);
    if (key === " ") placeMemoryPiece(state.memory.cursor);
    if (key === "enter") endNight();
  }
  if (state.mode === "summary" && key === "enter") {
    restartGame();
  }
  if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
  if (event.key === "Escape" && document.fullscreenElement) {
    document.exitFullscreen();
  }
});

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
overlayBackdrop.addEventListener("click", () => {
  toggleStatsPanel(false);
  closeInfoModal();
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
