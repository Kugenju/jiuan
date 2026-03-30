const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScripts(files) {
  const context = {
    window: {
      GAME_DATA: {},
      GAME_RUNTIME: {},
    },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(code, context, { filename: fullPath });
  });

  return context.window;
}

function realmSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

test("detectDominantRoute finds study/work/training or balanced", () => {
  const windowObject = loadScripts(["src/domain/route-stress.js"]);
  const { detectDominantRoute } = windowObject.GAME_RUNTIME;

  assert.equal(
    detectDominantRoute(["homework", "homework", "homework", "walk_city"]),
    "study"
  );
  assert.equal(
    detectDominantRoute(["part_time", "part_time", "training", "walk_city"]),
    "balanced"
  );
  assert.equal(
    detectDominantRoute(["training", "training", "training", "wash"]),
    "training"
  );
});

test("updateRouteStress adjusts and clamps stresses with balanced recovery", () => {
  const windowObject = loadScripts(["src/domain/route-stress.js"]);
  const { updateRouteStress } = windowObject.GAME_RUNTIME;

  assert.deepEqual(
    realmSafe(
      updateRouteStress(
        { study: 0, work: 0, training: 0 },
        { dominantRoute: "study", previousDominantRoute: null }
      )
    ),
    { study: 2, work: 0, training: 0 }
  );

  assert.deepEqual(
    realmSafe(
      updateRouteStress(
        { study: 2, work: 0, training: 0 },
        { dominantRoute: "study", previousDominantRoute: "study" }
      )
    ),
    { study: 5, work: 0, training: 0 }
  );

  assert.deepEqual(
    realmSafe(
      updateRouteStress(
        { study: 5, work: 1, training: 2 },
        { dominantRoute: "balanced", previousDominantRoute: "study" }
      )
    ),
    { study: 4, work: 0, training: 1 }
  );
});

test("getRouteStressPenaltyProfile returns the designed tiered penalties", () => {
  const windowObject = loadScripts(["src/domain/route-stress.js"]);
  const { getRouteStressPenaltyProfile } = windowObject.GAME_RUNTIME;

  assert.deepEqual(realmSafe(getRouteStressPenaltyProfile("study", 0)), {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  });

  assert.deepEqual(realmSafe(getRouteStressPenaltyProfile("work", 3)), {
    resourcePenalty: 2,
    fatigueDelta: 1,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  });

  assert.deepEqual(realmSafe(getRouteStressPenaltyProfile("training", 5)), {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 2,
    moodPenalty: 999,
    selfControlPenalty: 1,
    assignmentBonusPenalty: 0,
  });
});

function createActivityTestState(routeStress) {
  return {
    routeStress,
    scheduleLocks: [false, false, false, false, false, false],
    today: {
      tones: { study: 0, life: 0, body: 0, social: 0 },
      kinds: { course: 0, assignment: 0, routine: 0 },
      focus: {},
      courseSkills: {},
      courses: [],
      assignments: [],
      randomEvents: [],
      latestCourseSkill: "math",
      actions: [],
    },
    weekActions: [],
    stats: {
      fatigue: 0,
      memory: 0,
      selfControl: 0,
      intelligence: 0,
      inspiration: 0,
      willpower: 0,
      charisma: 0,
      cleanliness: 0,
      mood: 0,
      stamina: 0,
      aura: 0,
    },
    skills: { math: 0, sigil: 0, dao: 0, craft: 0, herbal: 0, formation: 0 },
    resources: { coins: 0, insight: 0, spirit: 0 },
    relationships: { roommate: 0, friend: 0, mentor: 0, counselor: 0 },
  };
}

test("applyActivityToState applies study route penalties to homework bonus and insight", () => {
  const windowObject = loadScripts([
    "src/domain/player.js",
    "src/domain/route-stress.js",
    "src/domain/story.js",
    "src/domain/activity.js",
  ]);
  const { applyActivityToState } = windowObject.GAME_RUNTIME;
  const rootState = createActivityTestState({ study: 4, work: 0, training: 0 });

  applyActivityToState(
    rootState,
    {
      id: "homework",
      name: "做课业",
      tone: "study",
      kind: "assignment",
      effects: {
        stats: { memory: 1, selfControl: 1 },
        resources: { insight: 2 },
      },
      assignment: {
        skillSource: "latestCourseSkill",
        amount: 1,
        noteTemplate: "{skill}+{amount}",
      },
      notes: {},
    },
    2,
    {
      copy: { dayModifierApplied: () => "" },
      storyBeats: [],
      slotNames: ["A", "B", "C", "D", "E", "F"],
      skillLabels: { math: "数术" },
      getMainFocusSkill: () => "math",
      addLog: () => {},
    }
  );

  assert.equal(rootState.resources.insight, 0);
  assert.equal(rootState.skills.math, 0);
  assert.deepEqual(realmSafe(rootState.weekActions), ["homework"]);
});

test("applyActivityToState applies work and training route penalties to free actions", () => {
  const windowObject = loadScripts([
    "src/domain/player.js",
    "src/domain/route-stress.js",
    "src/domain/story.js",
    "src/domain/activity.js",
  ]);
  const { applyActivityToState } = windowObject.GAME_RUNTIME;
  const workState = createActivityTestState({ study: 0, work: 5, training: 0 });
  const trainingState = createActivityTestState({ study: 0, work: 0, training: 5 });

  applyActivityToState(
    workState,
    {
      id: "part_time",
      name: "去打工",
      tone: "social",
      kind: "routine",
      effects: {
        resources: { coins: 6 },
        stats: { fatigue: 2, selfControl: 1 },
      },
      notes: {},
    },
    3,
    {
      copy: { dayModifierApplied: () => "" },
      storyBeats: [],
      slotNames: ["A", "B", "C", "D", "E", "F"],
      skillLabels: {},
      getMainFocusSkill: () => null,
      addLog: () => {},
    }
  );

  applyActivityToState(
    trainingState,
    {
      id: "training",
      name: "去操场修炼",
      tone: "body",
      kind: "routine",
      effects: {
        stats: { stamina: 1, aura: 1, fatigue: 1, mood: 1 },
      },
      notes: {},
    },
    4,
    {
      copy: { dayModifierApplied: () => "" },
      storyBeats: [],
      slotNames: ["A", "B", "C", "D", "E", "F"],
      skillLabels: {},
      getMainFocusSkill: () => null,
      addLog: () => {},
    }
  );

  assert.equal(workState.resources.coins, 2);
  assert.equal(workState.stats.fatigue, 4);
  assert.deepEqual(realmSafe(workState.weekActions), ["part_time"]);

  assert.equal(trainingState.stats.aura, 0);
  assert.equal(trainingState.stats.mood, 0);
  assert.equal(trainingState.stats.selfControl, 0);
  assert.deepEqual(realmSafe(trainingState.weekActions), ["training"]);
});
