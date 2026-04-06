const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files, { runtime = {}, data = {} } = {}) {
  const context = {
    window: {
      GAME_DATA: data,
      GAME_RUNTIME: { ...runtime },
    },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(REPO_ROOT, file);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(code, context, { filename: fullPath });
  });

  return context.window;
}

function realmSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRootState() {
  return {
    day: 3,
    rng: () => 0,
    resources: { insight: 0 },
    stats: { fatigue: 0, memory: 0 },
    skills: { dao: 0, craft: 0 },
    relationships: { friend: 0 },
    today: {
      kinds: { course: 1, assignment: 1 },
      randomEvents: [],
      latestCourseSkill: "dao",
    },
  };
}

test("triggerRandomEventForTiming returns pending prompt payload without applying rewards immediately", () => {
  const windowObject = loadScripts(["src/domain/player.js", "src/domain/random-event.js"]);
  const { triggerRandomEventForTiming } = windowObject.GAME_RUNTIME;
  const rootState = createRootState();
  const activity = { id: "math_course", kind: "course", name: "Math" };
  const event = {
    id: "course_followup",
    title: "课后加讲",
    timing: "after",
    chance: 1,
    oncePerDay: false,
    condition: { activityKinds: ["course"] },
    effect: { resources: { insight: 1 } },
    prompt: {
      speakerKey: "course",
      title: "随机事件 · 课后加讲",
      body: "老师补充讲解。",
    },
    choices: [
      { id: "note", label: "记下补充", rewardTemplate: "insight_small" },
      { id: "skip", label: "先回座复盘", rewardTemplate: "insight_small" },
    ],
  };
  const context = {
    randomEvents: [event],
    uiText: {
      speakers: {
        course: "course",
        assignment: "assignment",
        routine: "routine",
      },
    },
    skillLabels: { dao: "道法", craft: "炼器" },
    getMainFocusSkill: () => "dao",
    addLog: () => {},
  };

  const pending = triggerRandomEventForTiming(rootState, 0, activity, "after", context);

  assert.equal(pending.title, "随机事件 · 课后加讲");
  assert.equal(pending.body, "老师补充讲解。");
  assert.equal(pending.speaker, "course");
  assert.equal(pending.slotIndex, 0);
  assert.equal(pending.activityId, "math_course");
  assert.deepEqual(realmSafe(pending.choices), [
    { id: "note", label: "记下补充" },
    { id: "skip", label: "先回座复盘" },
  ]);
  assert.equal(rootState.resources.insight, 0);
  assert.deepEqual(realmSafe(rootState.today.randomEvents), []);
});

test("resolveRandomEventChoice applies template rewards and appends reward summary", () => {
  const windowObject = loadScripts(["src/domain/player.js", "src/domain/random-event.js"]);
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = createRootState();
  const activity = { id: "math_course", kind: "course", name: "Math" };
  const event = {
    id: "course_followup",
    title: "课后加讲",
    timing: "after",
    chance: 1,
    oncePerDay: false,
    condition: { activityKinds: ["course"] },
    prompt: {
      speakerKey: "course",
      title: "随机事件 · 课后加讲",
      body: "老师补充讲解。",
    },
    choices: [
      {
        id: "note",
        label: "记下补充",
        note: "你把关键补充记了下来。",
        rewardTemplate: "insight_small",
      },
      {
        id: "skip",
        label: "先回座复盘",
        rewardTemplate: "insight_small",
      },
    ],
  };
  const pendingEvent = {
    id: event.id,
    title: event.prompt.title,
    body: event.prompt.body,
    speaker: "course",
    slotIndex: 1,
    activityId: activity.id,
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    sourceEvent: event,
  };
  const context = {
    randomEvents: [event],
    uiText: {
      speakers: {
        course: "course",
        assignment: "assignment",
        routine: "routine",
      },
    },
    skillLabels: { dao: "道法", craft: "炼器" },
    getMainFocusSkill: () => "dao",
    addLog: () => {},
  };

  const result = resolveRandomEventChoice(rootState, pendingEvent, "note", activity, context);

  assert.equal(result.ok, true);
  assert.equal(rootState.resources.insight, 1);
  assert.equal(result.notesText.includes("奖励：悟道点+1"), true);
  assert.equal(result.notesText.includes("你把关键补充记了下来。"), true);
  assert.deepEqual(realmSafe(rootState.today.randomEvents), [
    { id: "course_followup", slotIndex: 1, activityId: "math_course", choiceId: "note" },
  ]);
});

test("resolveRandomEventChoice supports custom effects and dynamic skill bonus text", () => {
  const windowObject = loadScripts(["src/domain/player.js", "src/domain/random-event.js"]);
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = createRootState();
  const activity = { id: "homework", kind: "assignment", name: "Homework" };
  const event = {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    timing: "after",
    chance: 1,
    oncePerDay: false,
    condition: { activityKinds: ["assignment"] },
    prompt: {
      speakerKey: "assignment",
      title: "随机事件 · 题解顿悟",
      body: "你忽然意识到答案拼起来了。",
    },
    choices: [
      {
        id: "push",
        label: "顺势推演",
        effect: { stats: { memory: 1 } },
        effectSummary: "记忆+1",
        skillBonus: {
          source: "latestCourseSkill",
          fallbackSource: "mainFocusSkill",
          amount: 1,
          noteTemplate: "一道关键题突然想通，{skill} 额外 +{amount}。",
          fallbackNote: "虽然没有锁定具体学科，但这次顿悟依然把记忆再推高了一截。",
        },
      },
      {
        id: "hold",
        label: "先留到明天",
        rewardTemplate: "memory_small",
      },
    ],
  };
  const pendingEvent = {
    id: event.id,
    title: event.prompt.title,
    body: event.prompt.body,
    speaker: "assignment",
    slotIndex: 2,
    activityId: activity.id,
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    sourceEvent: event,
  };
  const context = {
    randomEvents: [event],
    uiText: {
      speakers: {
        course: "course",
        assignment: "assignment",
        routine: "routine",
      },
    },
    skillLabels: { dao: "道法", craft: "炼器" },
    getMainFocusSkill: () => "craft",
    addLog: () => {},
  };

  const result = resolveRandomEventChoice(rootState, pendingEvent, "push", activity, context);

  assert.equal(result.ok, true);
  assert.equal(rootState.stats.memory, 1);
  assert.equal(rootState.skills.dao, 1);
  assert.equal(result.notesText.includes("道法 额外 +1"), true);
  assert.equal(result.notesText.includes("奖励：记忆+1"), true);
});

test("resolveRandomEventChoice guards skill bonus lookups and label fallback", () => {
  const windowObject = loadScripts(["src/domain/player.js", "src/domain/random-event.js"]);
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = createRootState();
  rootState.skills = {};
  rootState.today.latestCourseSkill = "sigil";
  const activity = { id: "homework", kind: "assignment", name: "Homework" };
  const event = {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    timing: "after",
    chance: 1,
    oncePerDay: false,
    condition: { activityKinds: ["assignment"] },
    prompt: {
      speakerKey: "assignment",
      title: "随机事件 · 题解顿悟",
      body: "你忽然意识到答案拼起来了。",
    },
    choices: [
      {
        id: "push",
        label: "顺势推演",
        effect: { stats: { memory: 1 } },
        effectSummary: "记忆+1",
        skillBonus: {
          source: "latestCourseSkill",
          fallbackSource: "mainFocusSkill",
          amount: 1,
          noteTemplate: "一道关键题突然想通，{skill} 额外 +{amount}。",
          fallbackNote: "虽然没有锁定具体学科，但这次顿悟依然把记忆再推高了一截。",
        },
      },
    ],
  };
  const pendingEvent = {
    id: event.id,
    title: event.prompt.title,
    body: event.prompt.body,
    speaker: "assignment",
    slotIndex: 2,
    activityId: activity.id,
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    sourceEvent: event,
  };
  const context = {
    randomEvents: [event],
    uiText: {
      speakers: {
        course: "course",
        assignment: "assignment",
        routine: "routine",
      },
    },
    skillLabels: {},
    getMainFocusSkill: () => "dao",
    addLog: () => {},
  };

  const result = resolveRandomEventChoice(rootState, pendingEvent, "push", activity, context);

  assert.equal(result.ok, true);
  assert.equal(rootState.skills.sigil, 1);
  assert.equal(result.notesText.includes("sigil 额外 +1"), true);
});

test("resolveRandomEventChoice guards missing getMainFocusSkill callback", () => {
  const windowObject = loadScripts(["src/domain/player.js", "src/domain/random-event.js"]);
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = createRootState();
  rootState.today.latestCourseSkill = null;
  const activity = { id: "homework", kind: "assignment", name: "Homework" };
  const event = {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    timing: "after",
    chance: 1,
    oncePerDay: false,
    condition: { activityKinds: ["assignment"] },
    prompt: {
      speakerKey: "assignment",
      title: "随机事件 · 题解顿悟",
      body: "你忽然意识到答案拼起来了。",
    },
    choices: [
      {
        id: "push",
        label: "顺势推演",
        effect: { stats: { memory: 1 } },
        effectSummary: "记忆+1",
        skillBonus: {
          source: "mainFocusSkill",
          fallbackSource: "activitySkill",
          amount: 1,
          noteTemplate: "一道关键题突然想通，{skill} 额外 +{amount}。",
          fallbackNote: "虽然没有锁定具体学科，但这次顿悟依然把记忆再推高了一截。",
        },
      },
    ],
  };
  const pendingEvent = {
    id: event.id,
    title: event.prompt.title,
    body: event.prompt.body,
    speaker: "assignment",
    slotIndex: 2,
    activityId: activity.id,
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    sourceEvent: event,
  };
  const context = {
    randomEvents: [event],
    uiText: {
      speakers: {
        course: "course",
        assignment: "assignment",
        routine: "routine",
      },
    },
    skillLabels: { dao: "道法" },
    addLog: () => {},
  };

  const result = resolveRandomEventChoice(rootState, pendingEvent, "push", activity, context);

  assert.equal(result.ok, true);
  assert.equal(result.notesText.includes("虽然没有锁定具体学科"), true);
});

test("resolveRandomEventChoice returns unknown_reward_template without mutating state", () => {
  const windowObject = loadScripts(["src/domain/player.js", "src/domain/random-event.js"]);
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = createRootState();
  const snapshot = realmSafe(rootState);
  const activity = { id: "homework", kind: "assignment", name: "Homework" };
  const event = {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    timing: "after",
    chance: 1,
    oncePerDay: false,
    condition: { activityKinds: ["assignment"] },
    prompt: {
      speakerKey: "assignment",
      title: "随机事件 · 题解顿悟",
      body: "你忽然意识到答案拼起来了。",
    },
    choices: [
      {
        id: "push",
        label: "顺势推演",
        rewardTemplate: "unknown_reward",
      },
    ],
  };
  const pendingEvent = {
    id: event.id,
    title: event.prompt.title,
    body: event.prompt.body,
    speaker: "assignment",
    slotIndex: 2,
    activityId: activity.id,
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    sourceEvent: event,
  };
  const context = {
    randomEvents: [event],
    uiText: {
      speakers: {
        course: "course",
        assignment: "assignment",
        routine: "routine",
      },
    },
    skillLabels: {},
    addLog: () => {},
  };

  const result = resolveRandomEventChoice(rootState, pendingEvent, "push", activity, context);

  assert.deepEqual(realmSafe(result), { ok: false, error: "unknown_reward_template" });
  assert.deepEqual(realmSafe(rootState), snapshot);
});
