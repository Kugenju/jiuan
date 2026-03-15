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
      board: Array(16).fill(null),
      pieces: [],
      selectedPiece: null,
      dragPieceId: null,
      placementsToday: [],
      cursor: 12,
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
  state.dayModifier = buildDayModifier();

  if (state.dayModifier) {
    const modifierLog = COPY.dayModifierLog(state.day, state.dayModifier);
    addLog(modifierLog.title, modifierLog.body);
  }

  state.currentStory = COPY.dayStart(state.day);
  syncUi();
}

function update(dt) {
  state.scenePulse += dt;
  if (state.mode !== "resolving") {
    return;
  }
  state.phaseTimer += dt;
  state.progress = Math.min(1, (state.resolvingIndex + state.phaseTimer / 1.05) / SLOT_NAMES.length);
  if (state.phaseTimer >= 1.05) {
    state.phaseTimer = 0;
    resolveNextSlot();
  }
  syncUi();
}

function resolveNextSlot() {
  if (state.resolvingIndex >= SLOT_NAMES.length) {
    enterMemoryPhase();
    return;
  }
  const slotIndex = state.resolvingIndex;
  const activity = getActivity(state.schedule[slotIndex]);
  const notes = applyActivity(activity, slotIndex);
  pushTimeline(slotIndex, activity, notes);
  state.currentStory = {
    title: `${SLOT_NAMES[slotIndex]} · ${activity.name}`,
    body: notes,
    speaker: activity.tone === "study" ? "课程系统" : "日程系统",
  };
  state.resolvingIndex += 1;
  if (state.resolvingIndex >= SLOT_NAMES.length) {
    state.progress = 1;
    state.phaseTimer = 0;
    addLog(COPY.dayEndLog.title, COPY.dayEndLog.body);
    enterMemoryPhase();
    return;
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

function isValidPlacement(type, index) {
  if (!type || state.memory.board[index]) {
    return false;
  }

  const row = Math.floor(index / 4);
  const col = index % 4;
  const below = index + 4 < state.memory.board.length ? state.memory.board[index + 4] : null;
  const left = col > 0 ? state.memory.board[index - 1] : null;
  const right = col < 3 ? state.memory.board[index + 1] : null;
  const up = row > 0 ? state.memory.board[index - 4] : null;

  if (type === "base") {
    return row === 3;
  }

  if (type === "ability" || type === "reasoning") {
    return Boolean(below);
  }

  if (type === "boost") {
    return Boolean(left || right || up || below);
  }

  if (type === "bridge") {
    return Boolean(left && right);
  }

  return false;
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
  const row = Math.floor(state.memory.cursor / 4);
  const col = state.memory.cursor % 4;
  const nextCol = clamp(col + dx, 0, 3);
  const nextRow = clamp(row + dy, 0, 3);
  state.memory.cursor = nextRow * 4 + nextCol;
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
  state.memory.cursor = 12;
  const story = COPY.memoryStart(state.memory.pieces.length);
  state.currentStory = {
    title: story.title,
    body: story.body,
    speaker: story.speaker,
  };
  state.memory.lastSummary = story.summary;
  syncUi();
}

function placeMemoryPiece(index, pieceId = state.memory.selectedPiece) {
  const piece = state.memory.pieces.find((item) => item.id === pieceId);
  if (!piece || piece.used || state.memory.board[index]) {
    return;
  }
  if (!isValidPlacement(piece.type, index)) {
    state.currentStory = COPY.invalidPlacement(MEMORY_TYPES[piece.type].label);
    syncUi();
    return;
  }
  state.memory.board[index] = { type: piece.type, day: state.day };
  state.memory.placementsToday.push({ index, type: piece.type });
  piece.used = true;
  state.memory.dragPieceId = null;
  state.memory.selectedPiece = state.memory.pieces.find((item) => !item.used)?.id || null;
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
      summary.push("基座稳住了一部分悟道点。");
    }
    if (item.type === "ability") {
      const focus = getMainFocusSkill() || "dao";
      state.skills[focus] += 1;
      spiritGain += 1;
      summary.push(`能力块把 ${SKILL_LABELS[focus]} 再推进了一格。`);
    }
    if (item.type === "boost") {
      state.stats.fatigue -= 1;
      state.stats.mood += 1;
      summary.push("增益块安抚了情绪并消化疲惫。");
    }
    if (item.type === "reasoning") {
      state.stats.intelligence += 1;
      state.stats.inspiration += 1;
      summary.push("推理块让你把白天的问题想明白了。");
    }
    if (item.type === "bridge") {
      state.stats.memory += 1;
      summary.push("衔接块打通了不同知识区域。");
    }
  });

  for (let col = 0; col < 4; col += 1) {
    const column = [state.memory.board[col], state.memory.board[col + 4], state.memory.board[col + 8], state.memory.board[col + 12]];
    const chain = column.filter(Boolean).map((cell) => cell.type);
    if (chain.includes("base") && chain.includes("ability") && chain.includes("reasoning")) {
      spiritGain += 1;
    }
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

  drawBanner("夜间记忆建构", "基座在底层，能力和推理要有承托，衔接让知识跨区相连。");

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
  return state.memory.board.reduce(
    (acc, cell) => {
      if (cell) {
        acc[cell.type] += 1;
      }
      return acc;
    },
    { base: 0, ability: 0, boost: 0, reasoning: 0, bridge: 0 }
  );
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
  if (state.mode === "resolving") return Math.min(state.resolvingIndex, 3);
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
        <p class="tiny">夜间说明改成浮窗展示，右栏只保留灵块托盘和结束操作。</p>
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
          <small>基座只能放最底层。能力塔和推理塔需要下方支撑。增益塔贴靠任意已有块即可。衔接塔需要左右相邻支点。</small>
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
        ? `第 ${state.day} 天执行中：${Math.round(state.progress * 100)}%`
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
          const stateClass =
            state.mode === "resolving"
              ? index < state.resolvingIndex
                ? "done"
                : index === phaseIndex
                  ? "current"
                  : ""
              : state.mode === "memory"
                ? "done"
                : index === phaseIndex
                  ? "current"
                  : "";
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
              const cls =
                state.mode === "resolving"
                  ? index < state.resolvingIndex
                    ? "done"
                    : index === phaseIndex
                      ? "current"
                      : ""
                  : state.mode === "memory"
                    ? "done"
                    : index === phaseIndex
                      ? "current"
                      : "";
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
                  ? "日程正在自动结算，留意左侧进度条和最近反馈。"
                  : state.mode === "memory"
                    ? "从待放置灵块里挑一块，落到满足规则的位置。"
                    : "查看本周结果，决定是否重新开始。"
          }</small>
          <small>快捷键：1-4 选时段，空格填入活动，Enter 执行/确认，F 全屏。</small>
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
    const currentIndex = Math.min(state.resolvingIndex, 3);
    const currentActivity = getActivity(state.schedule[currentIndex]) || activeActivity;
    mainPanel.innerHTML = `
      <div class="panel-title">
        <h2>当前执行</h2>
        <span class="badge">${SLOT_NAMES[currentIndex]}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${currentActivity.name}</strong>
        <small>${currentActivity.summary}</small>
      </div>
      <div class="progress-bar"><i style="width:${Math.max(6, state.progress * 100)}%"></i></div>
      <div class="selection-summary">
        <p class="tiny">系统正在自动结算今天的四个时段。</p>
        <p class="tiny">当前进度 ${Math.round(state.progress * 100)}%，完成后会自动进入夜间记忆建构。</p>
      </div>
    `;
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
  memoryStage.innerHTML = `
    <div class="memory-stage-shell">
      <div class="memory-stage-header">
        <div>
          <h2>长期记忆区</h2>
          <p>把右侧灵块拖到左边的记忆位。底层基座最先落下，发光格表示当前可以放置的位置。</p>
        </div>
        <span class="badge">${activePiece ? `当前灵块：${MEMORY_TYPES[activePiece.type].label}` : "右侧选择一枚灵块"}</span>
      </div>
      <div class="memory-row-labels">
        <span>推理层</span>
        <span>能力层</span>
        <span>衔接层</span>
        <span>基座层</span>
      </div>
      <div class="memory-stage-board">
        ${state.memory.board
          .map((cell, index) => {
            const pieceType = activePiece?.type || null;
            const valid = pieceType ? !cell && isValidPlacement(pieceType, index) : false;
            const type = cell?.type || "";
            return `
              <div
                class="memory-slot ${valid ? "valid" : ""} ${cell ? "filled" : ""} ${state.memory.cursor === index ? "active" : ""}"
                data-memory-slot="${index}"
                data-type="${type}"
              >
                <strong>${cell ? MEMORY_TYPES[cell.type].label : `记忆位 ${index + 1}`}</strong>
                <small>${cell ? `第 ${cell.day} 天建成` : valid ? "拖到这里" : "等待承托或连接条件"}</small>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
  memoryStage.querySelectorAll("[data-memory-slot]").forEach((slot) => {
    const index = Number(slot.dataset.memorySlot);
    slot.addEventListener("dragover", (event) => {
      const draggingPiece =
        state.memory.pieces.find((piece) => piece.id === state.memory.dragPieceId && !piece.used) || null;
      if (!draggingPiece || state.memory.board[index] || !isValidPlacement(draggingPiece.type, index)) {
        return;
      }
      event.preventDefault();
      slot.classList.add("drop-target");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drop-target");
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drop-target");
      if (state.memory.dragPieceId) {
        placeMemoryPiece(index, state.memory.dragPieceId);
      }
    });
    slot.addEventListener("click", () => {
      state.memory.cursor = index;
      if (activePiece && !state.memory.board[index] && isValidPlacement(activePiece.type, index)) {
        placeMemoryPiece(index, activePiece.id);
      } else {
        syncUi();
      }
    });
  });
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
      <p class="tiny">步骤 2：拖到左侧发光的记忆位。</p>
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
      <small>基座只能放最底层；能力塔和推理塔要建立在已成型记忆上；增益塔贴靠任意已有块；衔接塔需要左右相邻支点。</small>
      <small>也可以先点右侧灵块，再点左侧有效记忆位完成放置。</small>
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
      <p class="tiny">步骤 2：拖到左侧发光格。</p>
      <p class="tiny">步骤 3：至少放一块，再结束夜晚。</p>
    </div>
    <div class="action-row">
      <button class="ghost-button" id="memory-help-btn">查看灵块类型</button>
    </div>
    <div class="memory-pieces" style="margin-top:16px;">${pieces}</div>
    <div class="story-card" style="margin-top:16px;">
      <strong>当前放置提示</strong>
      <small>右栏现在只保留灵块托盘和操作按钮。块类型与规则说明已移到浮窗。</small>
      <small>也可以先点右侧灵块，再点左侧有效记忆位完成放置。</small>
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
    const currentSlotName = SLOT_NAMES[state.selectedSlot];
    const currentSlotActivity = getActivity(state.schedule[state.selectedSlot]);
    leftPanel.innerHTML = `
      <div class="panel-title">
        <h2>今日时段</h2>
        <span class="badge">第 ${state.day} / ${state.totalDays} 天</span>
      </div>
      <div class="left-slot-grid">
        ${SLOT_NAMES.map((slot, index) => {
          const activity = getActivity(state.schedule[index]);
          const cls =
            state.mode === "resolving"
              ? index < state.resolvingIndex
                ? "done"
                : index === Math.min(state.resolvingIndex, 3)
                  ? "active"
                  : ""
              : index === state.selectedSlot
                ? "active"
                : "";
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
          <strong>${state.mode === "resolving" ? "自动结算中" : "当前步骤"}</strong>
          <small>${
            state.mode === "resolving"
              ? `正在结算 ${SLOT_NAMES[Math.min(state.resolvingIndex, 3)]}，进度 ${Math.round(state.progress * 100)}%。`
              : `先在左侧选择时段，再在右侧选择事件。当前时段：${currentSlotName}。`
          }</small>
          <small>${
            state.mode === "resolving"
              ? "Progress and feedback are now moved into top toolbar popups."
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
          <small>把右侧托盘中的灵块拖到左侧高亮的记忆位中。</small>
          <small>规则说明和类型介绍改为浮窗显示，不再长期占据界面空间。</small>
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
  return {
    coordinate_system: { origin: "canvas top-left", x: "right", y: "down" },
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
      current_slot_index: state.resolvingIndex,
      progress: Number(state.progress.toFixed(2)),
    },
    memory: {
      selected_piece: state.memory.pieces.find((piece) => piece.id === state.memory.selectedPiece)?.type || null,
      cursor: {
        index: state.memory.cursor,
        row: Math.floor(state.memory.cursor / 4),
        col: state.memory.cursor % 4,
      },
      valid_slots: state.memory.selectedPiece
        ? state.memory.board
            .map((cell, index) => (!cell && isValidPlacement(state.memory.pieces.find((piece) => piece.id === state.memory.selectedPiece)?.type, index) ? index : null))
            .filter((value) => value !== null)
        : [],
      pieces_left: state.memory.pieces.filter((piece) => !piece.used).map((piece) => piece.type),
      board: state.memory.board.map((cell, index) => ({
        index,
        row: Math.floor(index / 4),
        col: index % 4,
        type: cell?.type || null,
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
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "a", "b", "f", "i"].includes(key) || event.key === " ") {
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
