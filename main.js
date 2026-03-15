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
  ARCHETYPES,
  ACTIVITIES,
  DEFAULT_SCHEDULES,
  SCHEDULE_PRESETS,
  DAY_MODIFIERS,
  STORY_BEATS,
  RANK_THRESHOLDS,
  COPY,
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

const MEMORY_ZONE_META = {
  core: { label: "灵台", color: "#f0c36c" },
  math: { label: "数术区", color: "#7fc8ff" },
  sigil: { label: "符法区", color: "#a995ff" },
  dao: { label: "道法区", color: "#63d3b1" },
  craft: { label: "炼器区", color: "#ef8f85" },
};

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

const MEMORY_HEX_LAYOUT = buildMemoryHexLayout(2);

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
      autoplay: false,
      autoplayDelay: 1.05,
      autoplayTimer: 0,
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
      lastSummary: "夜间灵块尚未生成。",
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
  state.currentStory = {
    title: "入学测评完成",
    body: `你决定以“${picked.name}”的方式开始这七天。${picked.summary}`,
    speaker: "问卷法阵",
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
    autoplay: false,
    autoplayDelay: 1.05,
    autoplayTimer: 0,
  };
  state.dayModifier = buildDayModifier();

  if (state.dayModifier) {
    const modifierLog = COPY.dayModifierLog(state.day, state.dayModifier);
    addLog(modifierLog.title, modifierLog.body);
  }

  state.currentStory = {
    title: `第 ${state.day} 天开始`,
    body: COPY.dayFlowOpening(state.day),
    speaker: "课表法阵",
  };
  syncUi();
}

function getResolvingSlotActivity(slotIndex) {
  return getActivity(state.schedule[slotIndex]) || ACTIVITIES[0];
}

function showResolvingLead(slotIndex) {
  const activity = getResolvingSlotActivity(slotIndex);
  state.currentStory = {
    title: `${SLOT_NAMES[slotIndex]} · 起段`,
    body: COPY.dayFlowLead(SLOT_NAMES[slotIndex], activity.name),
    speaker: "课表法阵",
  };
}

function resolveSlotForFlow(slotIndex) {
  const activity = getResolvingSlotActivity(slotIndex);
  const notes = applyActivity(activity, slotIndex);
  pushTimeline(slotIndex, activity, notes);

  const detail = notes?.trim() || COPY.dayFlowPlaceholder(SLOT_NAMES[slotIndex], activity.name);
  state.currentStory = {
    title: `${SLOT_NAMES[slotIndex]} · ${activity.name}`,
    body: detail,
    speaker: activity.tone === "study" ? "课程系统" : "日程系统",
  };
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
    resolveSlotForFlow(flow.slotIndex);
    flow.phase = "result";
    syncUi();
    return;
  }

  if (flow.phase === "result") {
    if (flow.slotIndex >= SLOT_NAMES.length - 1) {
      addLog(COPY.dayEndLog.title, COPY.dayEndLog.body);
      state.currentStory = {
        title: COPY.dayEndLog.title,
        body: COPY.dayEndLog.body,
        speaker: "课表法阵",
      };
      flow.phase = "ending";
      syncUi();
      return;
    }

    state.currentStory = {
      title: `${SLOT_NAMES[flow.slotIndex]} · 收束`,
      body: COPY.dayFlowOutro(SLOT_NAMES[flow.slotIndex]),
      speaker: "课表法阵",
    };
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
  return `状态「${state.dayModifier.title}」生效。`;
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
  state.memory.lastSummary = `已放置 ${state.memory.placementsToday.length} / ${state.memory.pieces.length} 枚灵块。`;
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
      summary.push("灵台基座点亮了一处灰域节点。");
    }
    if (item.type === "ability") {
      const focus = getMainFocusSkill() || "dao";
      state.skills[focus] += 1;
      spiritGain += 1;
      summary.push(`术式楼将 ${SKILL_LABELS[focus]} 的修行又推进了一重。`);
    }
    if (item.type === "boost") {
      state.stats.fatigue -= 1;
      state.stats.mood += 1;
      summary.push("养神台安抚心神，化去了一段疲惫。");
    }
    if (item.type === "reasoning") {
      state.stats.intelligence += 1;
      state.stats.inspiration += 1;
      summary.push("悟理阁让白日疑题在夜里豁然贯通。");
    }
    if (item.type === "bridge") {
      state.stats.memory += 1;
      summary.push("衔接塔在两座建筑之间牵起了知识脉络。");
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
    summary.push(`术式楼与悟理阁经由衔接塔共鸣 ${resonanceBonus} 次，额外凝成 ${resonanceBonus} 点灵力。`);
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
  drawBanner("久安问道录", "策划案压缩成一周可玩的校园修仙养成 demo");
  drawFloatingCards(["日程编排", "属性成长", "夜间记忆建构", "人物事件"], 118);
}

function drawPlanningScene() {
  drawAcademyBackdrop("#173856", "#0d1a28");
  drawBanner(`第 ${state.day} 天 · 日程编排`, "白天安排课程与活动，夜里把灵块拼进长期记忆。");
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
  drawBanner(`第 ${state.day} 天 · ${current.name}`, "系统正在逐时段结算。");

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
  ctx.fillText(`当前时段：${SLOT_NAMES[Math.min(state.resolvingIndex, 3)]}`, 470, 210);
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

  drawBanner("夜间记忆建构", "先以灵台基座解锁灰域节点，再于节点建塔，以衔接塔贯通边位。");

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
  drawBanner("第一周结算", "从策划案中抽出的核心循环已经跑完一周。");
  const rank = state.summary?.rank || "未评级";
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
  ctx.fillText(`最佳方向：${SKILL_LABELS[state.summary.bestSkill[0]]} ${state.summary.bestSkill[1]} 级`, 250, 310);
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
    ctx.fillText(activity ? activity.name : "待安排", x + 16, y + 44);
  });
}

function drawStatConstellation() {
  const points = [
    { label: "智力", value: state.stats.intelligence, angle: -Math.PI / 2 },
    { label: "记忆", value: state.stats.memory, angle: -0.22 },
    { label: "体力", value: state.stats.stamina, angle: 0.82 },
    { label: "灵感", value: state.stats.inspiration, angle: 2.18 },
    { label: "心力", value: state.stats.willpower, angle: 3.28 },
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
  return [
    { label: "灵石", value: state.resources.coins, hint: "日常花销与打工收入" },
    { label: "悟道点", value: state.resources.insight, hint: "课程与课业沉淀" },
    { label: "灵力值", value: state.resources.spirit, hint: "周结算评级核心" },
  ];
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
        <h2>灵块类型</h2>
        <button class="drawer-close" id="info-close-btn" type="button">关闭</button>
      </div>
      <div class="modal-body">
        <p class="tiny">夜间为六边形长期记忆区。灰域节点需先投放灵台基座解锁，每个节点仅可建一座建筑。</p>
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
          <strong>放置规则</strong>
          <small>灵台基座只能用于解锁灰域节点。术式楼、养神台、悟理阁只能建在已解锁且空置的节点。衔接塔属于边位建筑，仅可架设在两端节点都已有建筑的相邻边上。</small>
        </div>
      </div>
    `;
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
    return;
  }
  if (kind === "progress") {
    infoModal.innerHTML = `
      <div class="panel-title">
        <h2>日程进度</h2>
        <button class="drawer-close" id="info-close-btn" type="button">关闭</button>
      </div>
      ${flowPanel.innerHTML}
    `;
    infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
    return;
  }
  if (kind === "feedback") {
    infoModal.innerHTML = `
      <div class="panel-title">
        <h2>最近反馈</h2>
        <button class="drawer-close" id="info-close-btn" type="button">关闭</button>
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
  statsToggleBtn.textContent = state.ui.statsOpen ? "收起状态" : "角色状态";
  document.body.classList.toggle("memory-mode", state.mode === "memory");
  memoryStage.classList.toggle("hidden", state.mode !== "memory");
  canvas.classList.toggle("hidden", state.mode === "memory");
  statusLine.textContent =
    state.mode === "planning"
      ? `第 ${state.day} 天待安排，当前选中 ${SLOT_NAMES[state.selectedSlot]}`
      : state.mode === "resolving"
        ? `第 ${state.day} 天剧情推进中：${Math.round(state.progress * 100)}%${state.resolvingFlow.autoplay ? "（自动）" : "（点击）"}`
        : state.mode === "memory"
          ? `第 ${state.day} 夜正在建构记忆`
          : state.mode === "summary"
            ? "第一周结算完成"
            : "选择入学测评原型后开始";
}

function renderFlowPanel() {
  const phaseIndex = getCurrentPhaseIndex();
  const quickCards = getQuickStatusCards();
  const currentActivity = getActivity(state.schedule[Math.max(0, Math.min(state.selectedSlot, 3))]);
  const latestTimeline = state.timeline[0];
  flowPanel.innerHTML = `
    <div class="flow-shell">
      <div class="panel-title">
        <h2>当前进展</h2>
        <span class="badge">第 ${state.day} / ${state.totalDays} 天</span>
      </div>
      <div class="phase-strip">
        ${SLOT_NAMES.map((slot, index) => {
          const activity = getActivity(state.schedule[index]);
          let stateClass = "";
          if (state.mode === "resolving") {
            const flow = state.resolvingFlow;
            const finishedCount =
              flow.phase === "opening" || flow.phase === "lead"
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
              <small>${activity ? activity.name : "待安排"}</small>
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
                  flow.phase === "opening" || flow.phase === "lead"
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
          <strong>现在要做什么</strong>
          <small>${
            state.mode === "menu"
              ? "先选入学原型，然后开始第一周。"
              : state.mode === "planning"
                ? `先选中一个时段，再给它安排活动。当前聚焦：${currentActivity ? currentActivity.name : "待安排"}。`
                : state.mode === "resolving"
                  ? state.resolvingFlow.autoplay
                    ? "剧情正在自动播放，你也可以随时手动点击推进。"
                    : "点击右侧剧情卡片或按钮，逐段推进白天流程。"
                  : state.mode === "memory"
                    ? "从待放置灵块里挑一块，落到满足规则的位置。"
                    : "查看本周结果，决定是否重新开始。"
          }</small>
          <small>快捷键：1-4 选时段，空格填入活动；白天推进阶段按空格/Enter前进，P切自动播放；F 全屏。</small>
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
        <p class="tiny">最近反馈：${latestTimeline ? `第 ${latestTimeline.day} 天 ${latestTimeline.slot} · ${latestTimeline.activity}` : "还没有进行日程结算。"}</p>
        <p class="tiny">${latestTimeline ? latestTimeline.notes : "当前阶段的提示会显示在这里，帮助你注意到日程推进。"}</p>
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
    const nextLabel = flow.phase === "ending" ? "进入夜间构筑" : "点击推进剧情";
    const autoLabel = flow.autoplay ? "自动播放：开" : "自动播放：关";
    mainPanel.innerHTML = `
      <div class="panel-title">
        <h2>白天剧情推进</h2>
        <span class="badge">${SLOT_NAMES[currentIndex]}</span>
      </div>
      <div class="story-card focus-callout" id="resolve-story-card" role="button" tabindex="0">
        <strong>${state.currentStory.title}</strong>
        <small>${state.currentStory.body}</small>
        <small>当前时段：${currentActivity.name}</small>
      </div>
      <div class="progress-bar"><i style="width:${Math.max(6, state.progress * 100)}%"></i></div>
      <div class="selection-summary">
        <p class="tiny">点击剧情卡片或按钮推进下一段。</p>
        <p class="tiny">自动播放开启后将按节奏自动推进。当前进度 ${Math.round(state.progress * 100)}%。</p>
      </div>
      <div class="action-row">
        <button class="primary" id="resolve-next-btn">${nextLabel}</button>
        <button class="ghost-button ${flow.autoplay ? "primary" : ""}" id="resolve-auto-btn">${autoLabel}</button>
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
    return;
  }

  const selectedSlotActivity = getActivity(state.schedule[state.selectedSlot]);
  const filledSlots = state.schedule.filter(Boolean).length;
  mainPanel.innerHTML = `
    <div class="planning-shell">
      <div class="panel-title">
        <h2>可选事件</h2>
        <span class="badge">${SLOT_NAMES[state.selectedSlot]}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${SLOT_NAMES[state.selectedSlot]}</strong>
        <small>左栏负责选时段，右栏只显示当前时段可用的事件与操作。</small>
        <small>${selectedSlotActivity ? `已安排：${selectedSlotActivity.name}` : "这个时段还没有安排事件。"}</small>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card">
          <strong>当前准备填入</strong>
          <small>${activeActivity.name}</small>
          <small>${activeActivity.summary}</small>
        </div>
        <div class="story-card">
          <strong>今日排表</strong>
          <small>已填写 ${filledSlots} / 4 个时段。</small>
          <small>${filledSlots === 4 ? "四个时段已满，可以直接执行当天。" : "先把四个时段全部填满再执行。"}</small>
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
        <button class="ghost-button warn" id="clear-btn">清空日程</button>
        <button class="primary" id="execute-btn">执行当天</button>
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
          aria-label="记忆边位 ${edge.index + 1}"
        >
          ${occupied ? "衔" : valid ? "可" : "边"}
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
        ? "灰域节点"
        : structureType
          ? MEMORY_TYPES[structureType].label
          : "已解锁空位";
      const desc = !nodeState.unlocked
        ? "投放灵台基座可解锁"
        : structureType
          ? `第 ${nodeState.day} 天建成`
          : "可建一座建筑";
      return `
        <button
          class="memory-node zone-${node.zone} ${nodeState.unlocked ? "unlocked" : "locked"} ${structureType ? "filled" : ""} ${valid ? "valid" : ""} ${active ? "active" : ""}"
          data-memory-node="${node.index}"
          data-zone="${node.zone}"
          data-type="${structureType || ""}"
          style="left:${node.ux}%;top:${node.uy}%;"
          type="button"
          aria-label="记忆节点 ${node.index + 1}"
        >
          <span class="memory-node-zone">${MEMORY_ZONE_META[node.zone].label}</span>
          <strong>${title}</strong>
          <small>${desc}</small>
        </button>
      `;
    })
    .join("");

  memoryStage.innerHTML = `
    <div class="memory-stage-shell">
      <div class="memory-stage-header">
        <div>
          <h2>长期记忆区</h2>
          <p>六边形节点按数术、符法、道法、炼器分区。灰域节点需先投放灵台基座解锁，每个节点只可建一座建筑，衔接塔架设在节点之间的边位。</p>
        </div>
        <span class="badge">${activePiece ? `当前灵块：${MEMORY_TYPES[activePiece.type].label}` : "右栏选择一枚灵块"}</span>
      </div>
      <div class="memory-zone-legend">
        ${zoneLegend}
      </div>
      <div class="memory-hex-board">
        <svg class="memory-edge-map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
      <h2>角色状态</h2>
      <div class="toolbar-actions">
        <span class="badge">第 ${state.day} / ${state.totalDays} 天</span>
        <button class="drawer-close" id="stats-close-btn" type="button">关闭</button>
      </div>
    </div>
    <p class="hero-line">${picked.name} · ${picked.title}</p>
    <div class="meta-grid">
      <div class="meta-card"><strong>${state.resources.coins}</strong><span>灵石</span></div>
      <div class="meta-card"><strong>${state.resources.insight}</strong><span>悟道点</span></div>
      <div class="meta-card"><strong>${state.resources.spirit}</strong><span>灵力值</span></div>
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>核心属性</h3>
      <span class="badge">${state.currentStory.speaker}</span>
    </div>
    <div class="stats-grid">
      ${metric("智力", state.stats.intelligence)}
      ${metric("记忆", state.stats.memory)}
      ${metric("体力", state.stats.stamina)}
      ${metric("灵感", state.stats.inspiration)}
      ${metric("心力", state.stats.willpower)}
      ${metric("灵力", state.stats.aura)}
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>外在状态</h3>
    </div>
    <div class="stats-grid">
      ${metric("魅力", state.stats.charisma)}
      ${metric("整洁", state.stats.cleanliness)}
      ${metric("情绪", state.stats.mood)}
      ${metric("疲惫", state.stats.fatigue)}
      ${metric("自控", state.stats.selfControl)}
      ${metric("舍友缘", state.relationships.roommate)}
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>关系与技能</h3>
    </div>
    <div class="stats-grid">
      ${metric("朋友", state.relationships.friend)}
      ${metric("导师", state.relationships.mentor)}
      ${metric("辅导员", state.relationships.counselor)}
      ${metric("数术", state.skills.math)}
      ${metric("符法", state.skills.sigil)}
      ${metric("道法", state.skills.dao)}
      ${metric("炼器", state.skills.craft)}
    </div>
  `;
  topPanel.querySelector("#stats-close-btn").addEventListener("click", () => toggleStatsPanel(false));
}

function renderMenuPanel() {
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>开始之前</h2>
      <span class="badge">选择入学原型</span>
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
      <button class="primary" id="start-btn">开始第一周</button>
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
      <h2>待放置灵块</h2>
      <span class="badge">${state.memory.lastSummary}</span>
    </div>
    <div class="selection-summary">
      <p class="tiny">步骤 1：从下方托盘抓取灵块。</p>
      <p class="tiny">步骤 2：拖到左侧六边节点或节点间边位。</p>
      <p class="tiny">步骤 3：至少放一块，再结束夜晚。</p>
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
      <strong>当前规则提示</strong>
      <small>灰域节点需先用灵台基座解锁；每个节点只能建一座建筑；术式楼/养神台/悟理阁仅可放在已解锁空节点；衔接塔属于边位建筑。</small>
      <small>节点需先解锁再建造，衔接塔请点击两节点之间的边位。</small>
    </div>
    <div class="action-row">
      <button class="primary" id="end-night-btn">结束夜晚</button>
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
  const rank = state.summary?.rank || "未评级";
  const bestSkill = state.summary?.bestSkill || ["dao", 0];
  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>本周结算</h2>
      <span class="badge">${rank}</span>
    </div>
    <div class="story-card focus-callout">
      <strong>${state.currentStory.title}</strong>
      <small>${state.currentStory.body}</small>
    </div>
    <div class="summary-grid" style="margin-top:16px;">
      ${metric("灵石结余", state.resources.coins)}
      ${metric("悟道点", state.resources.insight)}
      ${metric("灵力值", state.resources.spirit)}
      ${metric("最佳技能", `${SKILL_LABELS[bestSkill[0]]} ${bestSkill[1]}`)}
    </div>
    <div class="action-row">
      <button class="primary" id="restart-btn">重新开始</button>
    </div>
  `;
  mainPanel.querySelector("#restart-btn").addEventListener("click", restartGame);
}

function renderLogPanel() {
  const recentLogs = state.log.slice(0, 4);
  const recentTimeline = state.timeline.slice(0, 3);
  logPanel.innerHTML = `
    <div class="panel-title">
      <h2>最近反馈</h2>
      <span class="badge">${state.mode === "resolving" ? "请留意这里" : "摘要"}</span>
    </div>
    <div class="feedback-list">
      ${recentTimeline
        .map(
          (item) => `
            <div class="story-card">
              <strong>第 ${item.day} 天 · ${item.slot}</strong>
              <small>${item.activity}</small>
              <small>${item.notes}</small>
            </div>
          `
        )
        .join("")}
      ${!recentTimeline.length ? `<p class="tiny">开始执行日程后，这里会用更醒目的方式回放刚刚发生的事。</p>` : ""}
    </div>
    <div class="panel-title" style="margin-top:16px;">
      <h3>系统记录</h3>
      <span class="badge">最新 4 条</span>
    </div>
    <div class="feedback-list">
      ${recentLogs
        .map(
          (entry) => `
            <div class="log-entry">
              <strong>${entry.day > 0 ? `第 ${entry.day} 天 · ` : ""}${entry.title}</strong>
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
      <h2>待放置灵块</h2>
      <span class="badge">${state.memory.lastSummary}</span>
    </div>
    <div class="selection-summary">
      <p class="tiny">步骤 1：抓起一枚灵块。</p>
      <p class="tiny">步骤 2：拖到左侧六边节点或边位。</p>
      <p class="tiny">步骤 3：至少放一块，再结束夜晚。</p>
    </div>
    <div class="action-row">
      <button class="ghost-button" id="memory-help-btn">查看灵块类型</button>
    </div>
    <div class="memory-pieces" style="margin-top:16px;">${pieces}</div>
    <div class="story-card" style="margin-top:16px;">
      <strong>当前放置提示</strong>
      <small>右栏现在只保留灵块托盘和操作按钮。块类型与规则说明已移到浮窗。</small>
      <small>节点需先解锁再建造，衔接塔请点击两节点之间的边位。</small>
    </div>
    <div class="action-row">
      <button class="primary" id="end-night-btn">结束夜晚</button>
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
        <h2>今日时段</h2>
        <span class="badge">第 ${state.day} / ${state.totalDays} 天</span>
      </div>
      <div class="left-slot-grid">
        ${SLOT_NAMES.map((slot, index) => {
          const activity = getActivity(state.schedule[index]);
          let cls = "";
          if (state.mode === "resolving") {
            const flow = state.resolvingFlow;
            const finishedCount =
              flow.phase === "opening" || flow.phase === "lead"
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
              <small>${activity ? activity.name : "未安排"}</small>
            </button>
          `;
        }).join("")}
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>${state.mode === "resolving" ? "剧情推进中" : "当前步骤"}</strong>
          <small>${
            state.mode === "resolving"
              ? `当前来到 ${currentSlotName}，进度 ${Math.round(state.progress * 100)}%。`
              : `先在左侧选择时段，再在右侧选择事件。当前时段：${currentSlotName}。`
          }</small>
          <small>${
            state.mode === "resolving"
              ? state.resolvingFlow.autoplay
                ? "自动播放已开启，可随时手动点击插入推进。"
                : "点击右侧剧情卡片或“点击推进剧情”按钮进入下一段。"
              : currentSlotActivity
                ? `已安排：${currentSlotActivity.name}`
                : `${currentSlotName} 还没有安排事件。`
          }</small>
        </div>
        <div class="left-info-card">
          <strong>${state.mode === "resolving" ? "今日进度" : "日程完成度"}</strong>
          <small>${state.mode === "resolving" ? `已完成 ${Math.min(state.resolvingIndex, 4)} / 4 个时段。` : `已安排 ${filledSlots} / 4 个时段。`}</small>
          <small>${state.mode === "resolving" ? "需要看角色状态、进度或最近反馈时，使用顶部按钮打开浮窗。" : "下方的进度和反馈已经移出主界面，改为顶部按钮呼出。"}</small>
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
        <h2>夜间构筑</h2>
        <span class="badge">${state.memory.placementsToday.length} / ${state.memory.pieces.length}</span>
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>目标</strong>
          <small>将右侧灵块放入左侧六边形长期记忆区。</small>
          <small>先用灵台基座解锁灰域节点，再建造术式楼/养神台/悟理阁，最后用衔接塔打通边位。</small>
        </div>
        <div class="left-info-card">
          <strong>今夜进度</strong>
          <small>已放置：${state.memory.placementsToday.length}</small>
          <small>剩余：${state.memory.pieces.filter((piece) => !piece.used).length}</small>
        </div>
      </div>
    `;
    return;
  }

  if (state.mode === "summary") {
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>本周结果</h2>
        <span class="badge">${state.summary?.rank || "待结算"}</span>
      </div>
      <div class="left-info-grid">
        <div class="left-info-card">
          <strong>${state.currentStory.title}</strong>
          <small>${state.currentStory.body}</small>
        </div>
        <div class="left-info-card">
          <strong>资源</strong>
          <small>灵石 ${state.resources.coins}</small>
          <small>悟道点 ${state.resources.insight}</small>
          <small>灵力 ${state.resources.spirit}</small>
        </div>
      </div>
    `;
    return;
  }

  leftPanel.innerHTML = `
    <div class="panel-title">
      <h2>开始前</h2>
      <span class="badge">准备阶段</span>
    </div>
    <div class="left-info-grid">
      <div class="left-info-card">
        <strong>流程</strong>
        <small>先在右侧选择开局原型，再开始第一周。</small>
      </div>
      <div class="left-info-card">
        <strong>浮窗</strong>
        <small>角色状态、日程进度和最近反馈都从顶部工具栏打开。</small>
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
    coordinate_system: { origin: "画布左上角", x: "向右", y: "向下" },
    mode: state.mode,
    day: state.day,
    selected_archetype: state.selectedArchetype,
    current_story: state.currentStory.title,
    schedule: SLOT_NAMES.map((slot, index) => ({
      slot,
      action: getActivity(state.schedule[index])?.name || "未安排",
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
