# Multiweek Strategy Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前单周 demo 扩展为“固定课表、连续 4 周验证自由时段策略长期代价”的版本，并把长期代价、周报、自动实验和策划案整合文档一起落地。

**Architecture:** 在现有日程循环上新增“多周状态 + 周报推进层”，并用独立的 `route-stress` 领域模块管理主路线识别、长期透支和路线惩罚。保留当前课程与白天/夜间主循环，只在周末结算点切入多周推进，并让自动实验脚本从“单周终点”升级为“4 周逐周记录”。

**Tech Stack:** Vanilla JS、Node `node:test`、VM 脚本加载测试、Playwright 自动实验脚本

---

## File Structure

### 新建文件

- `src/domain/route-stress.js`
  - 负责主路线识别、`routeStress` 更新、路线惩罚档位与活动结算修正。
- `src/domain/week-cycle.js`
  - 负责每周结算快照、周推进、继续下一周与最终总评。
- `tests/route-stress.test.cjs`
  - 覆盖主路线识别、透支增长/恢复、惩罚档位。
- `tests/week-cycle.test.cjs`
  - 覆盖周结算推进、非最终周继续、最终周总评。
- `tests/multiweek-copy.test.cjs`
  - 覆盖动态周结算文本与 UI 文本。

### 修改文件

- `src/app/session.js`
  - 初始化多周状态；新增 `run/continue-week` 等命令。
- `src/app/night-flow.js`
  - 第 7 天结束时改为“生成周报并决定是否进入下一周”。
- `src/domain/activity.js`
  - 在 `homework / part_time / training` 结算时接入 `routeStress` 惩罚。
- `src/domain/summary.js`
  - 保留评分公式，但将结果包装为“周报数据”供多周循环使用。
- `src/debug/state-export.js`
  - 导出 `week`、`routeStress`、`weeklyReports`、`strategyHistory`。
- `data/copy.js`
  - 把“第一周”写死文本改为动态周次，增加继续下一周与总评文案。
- `data/ui.js`
  - 动态状态栏、Summary UI、下一周按钮文本。
- `main.js`
  - `createSessionOptions` 增加 `totalWeeks`
  - summary 面板改成“下一周 / 重新开始”
  - 注入新的 week-cycle 上下文
- `scripts/third-round-experiment.mjs`
  - 升级为 4 周自动实验并输出逐周结果。
- `策划案整合.md`
  - 同步多周策略验证与长期代价规则。

---

### Task 1: 建立 `routeStress` 领域模块

**Files:**
- Create: `tests/route-stress.test.cjs`
- Create: `src/domain/route-stress.js`
- Modify: `main.js`

- [ ] **Step 1: 写失败测试，锁定主路线识别、透支更新和惩罚档位**

```js
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
    const abs = path.join(process.cwd(), file);
    const code = fs.readFileSync(abs, "utf8");
    vm.runInNewContext(code, context, { filename: abs });
  });

  return context.window;
}

test("主路线识别只统计自由时段并能区分 balanced", () => {
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

test("重复同一路线会提高对应 routeStress，balanced 会恢复", () => {
  const windowObject = loadScripts(["src/domain/route-stress.js"]);
  const { updateRouteStress } = windowObject.GAME_RUNTIME;

  assert.deepEqual(
    updateRouteStress(
      { study: 0, work: 0, training: 0 },
      { dominantRoute: "study", previousDominantRoute: null }
    ),
    { study: 2, work: 0, training: 0 }
  );

  assert.deepEqual(
    updateRouteStress(
      { study: 2, work: 0, training: 0 },
      { dominantRoute: "study", previousDominantRoute: "study" }
    ),
    { study: 5, work: 0, training: 0 }
  );

  assert.deepEqual(
    updateRouteStress(
      { study: 5, work: 1, training: 2 },
      { dominantRoute: "balanced", previousDominantRoute: "study" }
    ),
    { study: 4, work: 0, training: 1 }
  );
});

test("routeStress 惩罚档位符合设计稿", () => {
  const windowObject = loadScripts(["src/domain/route-stress.js"]);
  const { getRouteStressPenaltyProfile } = windowObject.GAME_RUNTIME;

  assert.deepEqual(getRouteStressPenaltyProfile("study", 0), {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  });
  assert.deepEqual(getRouteStressPenaltyProfile("work", 3), {
    resourcePenalty: 2,
    fatigueDelta: 1,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  });
  assert.deepEqual(getRouteStressPenaltyProfile("training", 5), {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 2,
    moodPenalty: 999,
    selfControlPenalty: 1,
    assignmentBonusPenalty: 0,
  });
});
```

- [ ] **Step 2: 跑测试，确认它们先失败**

Run: `node --test .\tests\route-stress.test.cjs`

Expected: FAIL，报 `detectDominantRoute is not a function` 或找不到导出函数。

- [ ] **Step 3: 最小实现 `src/domain/route-stress.js`**

```js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const ROUTE_ACTIVITY_MAP = {
  homework: "study",
  part_time: "work",
  training: "training",
};

function clampStress(value) {
  return Math.max(0, Math.min(6, value));
}

function createRouteStressState() {
  return { study: 0, work: 0, training: 0 };
}

function detectDominantRoute(freeActions) {
  const counts = { study: 0, work: 0, training: 0 };
  (freeActions || []).forEach((activityId) => {
    const route = ROUTE_ACTIVITY_MAP[activityId];
    if (route) {
      counts[route] += 1;
    }
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topRoute, topCount] = entries[0];
  const secondCount = entries[1][1];
  const totalTracked = entries.reduce((sum, [, count]) => sum + count, 0);

  if (totalTracked === 0) {
    return "balanced";
  }
  if (topCount / totalTracked < 0.5) {
    return "balanced";
  }
  if (topCount <= secondCount) {
    return "balanced";
  }
  return topRoute;
}

function updateRouteStress(current, { dominantRoute, previousDominantRoute }) {
  const next = {
    study: current.study,
    work: current.work,
    training: current.training,
  };

  if (dominantRoute === "balanced") {
    next.study = clampStress(next.study - 1);
    next.work = clampStress(next.work - 1);
    next.training = clampStress(next.training - 1);
    return next;
  }

  Object.keys(next).forEach((key) => {
    next[key] = clampStress(next[key] + (key === dominantRoute ? 2 : -1));
  });

  if (dominantRoute === previousDominantRoute) {
    next[dominantRoute] = clampStress(next[dominantRoute] + 1);
  }

  return next;
}

function getRouteStressPenaltyProfile(route, stress) {
  if (stress <= 1) {
    return {
      resourcePenalty: 0,
      fatigueDelta: 0,
      auraPenalty: 0,
      moodPenalty: 0,
      selfControlPenalty: 0,
      assignmentBonusPenalty: 0,
    };
  }

  if (route === "study") {
    return stress <= 3
      ? { resourcePenalty: 1, fatigueDelta: 0, auraPenalty: 0, moodPenalty: 0, selfControlPenalty: 0, assignmentBonusPenalty: 1 }
      : { resourcePenalty: 2, fatigueDelta: 0, auraPenalty: 0, moodPenalty: 0, selfControlPenalty: 0, assignmentBonusPenalty: 999 };
  }

  if (route === "work") {
    return stress <= 3
      ? { resourcePenalty: 2, fatigueDelta: 1, auraPenalty: 0, moodPenalty: 0, selfControlPenalty: 0, assignmentBonusPenalty: 0 }
      : { resourcePenalty: 4, fatigueDelta: 2, auraPenalty: 0, moodPenalty: 0, selfControlPenalty: 0, assignmentBonusPenalty: 0 };
  }

  if (route === "training") {
    return stress <= 3
      ? { resourcePenalty: 0, fatigueDelta: 0, auraPenalty: 1, moodPenalty: 1, selfControlPenalty: 0, assignmentBonusPenalty: 0 }
      : { resourcePenalty: 0, fatigueDelta: 0, auraPenalty: 2, moodPenalty: 999, selfControlPenalty: 1, assignmentBonusPenalty: 0 };
  }

  return {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  };
}

Object.assign(window.GAME_RUNTIME, {
  ROUTE_ACTIVITY_MAP,
  createRouteStressState,
  detectDominantRoute,
  updateRouteStress,
  getRouteStressPenaltyProfile,
});
})();
```

- [ ] **Step 4: 在 `main.js` 中挂入脚本加载顺序**

```js
const {
  createRouteStressState,
  detectDominantRoute,
  updateRouteStress,
  getRouteStressPenaltyProfile,
} = window.GAME_RUNTIME;
```

确保 `src/domain/route-stress.js` 在 `main.js` 引导脚本列表中位于 `src/domain/activity.js` 之前。

- [ ] **Step 5: 重新跑测试，确认全部转绿**

Run: `node --test .\tests\route-stress.test.cjs`

Expected: PASS，3/3 通过。

- [ ] **Step 6: 提交**

```bash
git add tests/route-stress.test.cjs src/domain/route-stress.js main.js
git commit -m "feat: add route stress domain model"
```

---

### Task 2: 扩展会话状态与周推进领域

**Files:**
- Create: `tests/week-cycle.test.cjs`
- Create: `src/domain/week-cycle.js`
- Modify: `src/app/session.js`
- Modify: `main.js`
- Modify: `src/debug/state-export.js`

- [ ] **Step 1: 写失败测试，锁定多周状态初始化与周推进**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScripts(files) {
  const context = {
    window: { GAME_DATA: {}, GAME_RUNTIME: {} },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;
  files.forEach((file) => {
    const abs = path.join(process.cwd(), file);
    const code = fs.readFileSync(abs, "utf8");
    vm.runInNewContext(code, context, { filename: abs });
  });
  return context.window;
}

test("createGameState 初始化多周字段", () => {
  const windowObject = loadScripts([
    "src/domain/route-stress.js",
    "src/app/session.js",
  ]);
  const { createGameState } = windowObject.GAME_RUNTIME;

  const state = createGameState({
    createRng: () => () => 0.5,
    totalDays: 7,
    totalWeeks: 4,
    initialArchetypeId: "scholar",
    initialActivityId: "homework",
    slotCount: 6,
    memoryCenterNodeId: 0,
    copy: {
      initialStory: { title: "", body: "", speaker: "" },
      introLog: { title: "", body: "" },
      memoryPendingSummary: "",
    },
    createTodayState: () => ({ tones: { study: 0, life: 0, social: 0 }, actions: [] }),
    createStoryFlags: () => ({}),
    createMemoryBoardState: () => [],
    createMemoryBridgeState: () => [],
  });

  assert.equal(state.week, 1);
  assert.equal(state.totalWeeks, 4);
  assert.deepEqual(state.routeStress, { study: 0, work: 0, training: 0 });
  assert.deepEqual(state.weeklyReports, []);
  assert.deepEqual(state.strategyHistory, []);
});

test("非最终周结算后允许进入下一周，最终周进入 final summary", () => {
  const windowObject = loadScripts([
    "src/domain/route-stress.js",
    "src/domain/week-cycle.js",
  ]);
  const { buildWeekTransitionState } = windowObject.GAME_RUNTIME;

  const weekThree = buildWeekTransitionState({
    week: 3,
    totalWeeks: 4,
    report: { week: 3, rank: "中中品" },
  });
  assert.equal(weekThree.kind, "continue");
  assert.equal(weekThree.nextWeek, 4);

  const weekFour = buildWeekTransitionState({
    week: 4,
    totalWeeks: 4,
    report: { week: 4, rank: "上中品" },
  });
  assert.equal(weekFour.kind, "final");
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test .\tests\week-cycle.test.cjs`

Expected: FAIL，缺少 `week` / `totalWeeks` / `buildWeekTransitionState`。

- [ ] **Step 3: 最小实现 `src/domain/week-cycle.js`**

```js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createWeeklyReport(rootState, reportPatch) {
  return {
    week: rootState.week,
    rank: reportPatch.rank,
    bestSkill: reportPatch.bestSkill,
    majorBeat: reportPatch.majorBeat,
    dominantRoute: reportPatch.dominantRoute,
    routeStressBefore: structuredClone(rootState.routeStress),
    routeStressAfter: structuredClone(reportPatch.routeStressAfter),
    resources: structuredClone(rootState.resources),
    stats: structuredClone(rootState.stats),
    skills: structuredClone(rootState.skills),
  };
}

function buildWeekTransitionState({ week, totalWeeks, report }) {
  if (week >= totalWeeks) {
    return { kind: "final", report };
  }
  return {
    kind: "continue",
    report,
    nextWeek: week + 1,
  };
}

Object.assign(window.GAME_RUNTIME, {
  createWeeklyReport,
  buildWeekTransitionState,
});
})();
```

- [ ] **Step 4: 扩展 `src/app/session.js` 的初始状态与命令**

```js
function createGameState(options) {
  const playerState = createBasePlayerState();

  return {
    mode: "menu",
    rng: options.createRng(),
    day: 1,
    totalDays: options.totalDays,
    week: 1,
    totalWeeks: options.totalWeeks,
    weeklyReports: [],
    strategyHistory: [],
    weekTracker: {
      freeActions: [],
      dominantRoute: "balanced",
    },
    routeStress: createRouteStressState(),
    finalSummary: null,
  };
}

case "run/continue-week": {
  if (rootState.mode !== "summary" || !rootState.summary?.canContinue) {
    return false;
  }
  rootState.week += 1;
  rootState.day = 1;
  rootState.mode = "planning";
  rootState.scene = "campus";
  rootState.summary = null;
  rootState.weekTracker = { freeActions: [], dominantRoute: "balanced" };
  rootState.schedule = buildDailyScheduleFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
  rootState.scheduleLocks = buildScheduleLocksFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
  rootState.selectedSlot = findNextEditableSlot(rootState.scheduleLocks, 0, 1);
  rootState.selectedActivity = context.initialActivityId;
  rootState.currentStory = context.copy.weekStartStory(rootState.week);
  return true;
}
```

把上面这些字段插入到当前 `createGameState()` 返回对象中，位置放在 `totalDays` 与 `selectedArchetype` 之间；其余既有字段保持原顺序不动。

- [ ] **Step 5: 扩展 `main.js` session options 与 `state-export`**

```js
function createSessionOptions() {
  const initialFreeActivityId = ACTIVITIES.find((activity) => activity.kind !== "course")?.id || ACTIVITIES[0].id;
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
```

```js
return {
  coordinate_system: context.uiText.stateExport.coordinateSystem,
  mode: rootState.mode,
  day: rootState.day,
  week: rootState.week,
  total_weeks: rootState.totalWeeks,
  route_stress: rootState.routeStress,
  weekly_reports: rootState.weeklyReports,
  strategy_history: rootState.strategyHistory,
};
```

把这些字段插入到 `buildTextStateExport()` 返回对象中，放在 `day` 后、`selected_archetype` 前；其余现有导出字段继续保留。

- [ ] **Step 6: 重新跑测试，确认通过**

Run: `node --test .\tests\week-cycle.test.cjs`

Expected: PASS，2/2 通过。

- [ ] **Step 7: 提交**

```bash
git add tests/week-cycle.test.cjs src/domain/week-cycle.js src/app/session.js src/debug/state-export.js main.js
git commit -m "feat: add multiweek session state"
```

---

### Task 3: 在周末结算点接入周报与下一周推进

**Files:**
- Modify: `src/domain/summary.js`
- Modify: `src/app/night-flow.js`
- Modify: `main.js`
- Test: `tests/week-cycle.test.cjs`

- [ ] **Step 1: 为周报对象补充失败测试**

在 `tests/week-cycle.test.cjs` 中追加：

```js
test("finishWeekState 会写入 summary 并标记 canContinue", () => {
  const windowObject = loadScripts([
    "src/domain/route-stress.js",
    "src/domain/week-cycle.js",
    "src/domain/summary.js",
  ]);
  const { finishWeekState } = windowObject.GAME_RUNTIME;

  const rootState = {
    week: 2,
    totalWeeks: 4,
    routeStress: { study: 2, work: 0, training: 0 },
    resources: { coins: 30, insight: 18, spirit: 4 },
    stats: { aura: 3 },
    skills: { math: 6, sigil: 2, dao: 1, craft: 0, herbal: 0, formation: 1 },
    storyFlags: { missingClue: false },
    weeklyReports: [],
  };

  finishWeekState(rootState, {
    rankThresholds: [{ min: -Infinity, label: "中中品" }],
    copy: {
      summary: {
        title: (week) => `第 ${week} 周结算`,
        body: ({ week, rank, bestSkillLabel }) => `第 ${week} 周 ${rank} · ${bestSkillLabel}`,
        speaker: "太学院",
        logTitle: "周结算",
        defaultMajorBeat: "默认事件",
        clueMajorBeat: "线索事件",
      },
    },
    skillLabels: { math: "数术", sigil: "符法", dao: "道法", craft: "炼器", herbal: "灵物", formation: "阵法" },
    addLog: () => {},
    dominantRoute: "study",
    nextRouteStress: { study: 4, work: 0, training: 0 },
  });

  assert.equal(rootState.mode, "summary");
  assert.equal(rootState.summary.week, 2);
  assert.equal(rootState.summary.canContinue, true);
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test .\tests\week-cycle.test.cjs`

Expected: FAIL，`finishWeekState` 未实现或 `summary.week` 缺失。

- [ ] **Step 3: 扩展 `src/domain/summary.js`，把单周结算改成周报生成器**

```js
function buildSummaryPayload(rootState, context) {
  const bestSkill = Object.entries(rootState.skills).sort((a, b) => b[1] - a[1])[0];
  const rank = computeRankForState(rootState, context.rankThresholds);
  const majorBeat = rootState.storyFlags.missingClue ? context.copy.summary.clueMajorBeat : context.copy.summary.defaultMajorBeat;

  return {
    week: rootState.week,
    rank,
    bestSkill,
    majorBeat,
    dominantRoute: context.dominantRoute,
    routeStressBefore: structuredClone(rootState.routeStress),
    routeStressAfter: structuredClone(context.nextRouteStress),
  };
}

function finishWeekState(rootState, context) {
  const payload = buildSummaryPayload(rootState, context);
  const body = context.copy.summary.body({
    week: payload.week,
    rank: payload.rank,
    bestSkillLabel: context.skillLabels[payload.bestSkill[0]],
    dominantRoute: payload.dominantRoute,
  });

  rootState.summary = {
    ...payload,
    canContinue: rootState.week < rootState.totalWeeks,
  };
  rootState.weeklyReports.push(structuredClone(rootState.summary));
  rootState.mode = "summary";
  rootState.scene = "summary";
  rootState.currentStory = {
    title: context.copy.summary.title(payload.week, rootState.totalWeeks),
    body,
    speaker: context.copy.summary.speaker,
  };
  context.addLog(context.copy.summary.logTitle(payload.week), body);
}
```

- [ ] **Step 4: 在 `src/app/night-flow.js` 用周报推进替换“直接 finishRun”**

```js
if (rootState.day >= rootState.totalDays) {
  context.finishWeek({
    dominantRoute: context.detectDominantRoute(rootState.weekTracker.freeActions),
  });
  return { ok: true, finishedRun: true };
}
```

并在 `main.js` 中把原：

```js
function finishRun() {
  finishRunState(state, createSummaryContext());
  syncUi();
}
```

替换为：

```js
function finishWeek({ dominantRoute }) {
  const nextRouteStress = updateRouteStress(state.routeStress, {
    dominantRoute,
    previousDominantRoute: state.strategyHistory.at(-1)?.dominantRoute ?? null,
  });

  state.strategyHistory.push({
    week: state.week,
    dominantRoute,
    freeActions: [...state.weekTracker.freeActions],
  });

  finishWeekState(state, {
    ...createSummaryContext(),
    dominantRoute,
    nextRouteStress,
  });

  state.routeStress = nextRouteStress;
  syncUi();
}
```

- [ ] **Step 5: 重新跑测试**

Run: `node --test .\tests\week-cycle.test.cjs`

Expected: PASS，新增断言通过。

- [ ] **Step 6: 提交**

```bash
git add tests/week-cycle.test.cjs src/domain/summary.js src/app/night-flow.js main.js
git commit -m "feat: add weekly summary progression"
```

---

### Task 4: 把 `routeStress` 惩罚接进活动结算

**Files:**
- Modify: `src/domain/activity.js`
- Test: `tests/route-stress.test.cjs`

- [ ] **Step 1: 为 `homework / part_time / training` 惩罚追加失败测试**

在 `tests/route-stress.test.cjs` 中追加：

```js
test("study routeStress 会压低 homework 的 insight 与额外技能", () => {
  const windowObject = loadScripts([
    "src/domain/player.js",
    "src/domain/route-stress.js",
    "src/domain/activity.js",
  ]);

  const { applyActivityToState } = windowObject.GAME_RUNTIME;
  const rootState = {
    routeStress: { study: 4, work: 0, training: 0 },
    scheduleLocks: [false, false, false, false, false, false],
    today: {
      tones: { study: 0, life: 0, social: 0 },
      actions: [],
      latestCourseSkill: "math",
      kinds: { course: 0, assignment: 0, routine: 0 },
      focus: {},
      courseSkills: {},
      courses: [],
      assignments: [],
      randomEvents: [],
    },
    weekTracker: { freeActions: [] },
    stats: { fatigue: 0, memory: 0, selfControl: 0, intelligence: 0, inspiration: 0, willpower: 0, charisma: 0, cleanliness: 0, mood: 0, stamina: 0, aura: 0 },
    skills: { math: 0, sigil: 0, dao: 0, craft: 0, herbal: 0, formation: 0 },
    resources: { coins: 0, insight: 0, spirit: 0 },
    relationships: { roommate: 0, friend: 0, mentor: 0, counselor: 0 },
  };

  applyActivityToState(rootState, {
    id: "homework",
    name: "做课业",
    tone: "study",
    kind: "assignment",
    effects: { stats: { memory: 1, selfControl: 1 }, resources: { insight: 2 } },
    assignment: { skillSource: "latestCourseSkill", amount: 1, noteTemplate: "{skill}+{amount}" },
    notes: {},
  }, 2, {
    copy: { dayModifierApplied: () => "" },
    storyBeats: [],
    skillLabels: { math: "数术" },
    getMainFocusSkill: () => "math",
    addLog: () => {},
    slotNames: ["A", "B", "C", "D", "E", "F"],
  });

  assert.equal(rootState.resources.insight, 0);
  assert.equal(rootState.skills.math, 0);
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test .\tests\route-stress.test.cjs`

Expected: FAIL，当前 `applyActivityToState` 不读取 `routeStress`。

- [ ] **Step 3: 在 `src/domain/activity.js` 接入长期代价**

```js
const {
  applyEffectBundleToRoot,
  normalizePlayerState,
  triggerStoryBeatForActivity,
  getRouteStressPenaltyProfile,
  ROUTE_ACTIVITY_MAP,
} = window.GAME_RUNTIME;

function getRoutePenaltyForActivity(rootState, activity) {
  const route = ROUTE_ACTIVITY_MAP[activity.id];
  if (!route) {
    return getRouteStressPenaltyProfile("balanced", 0);
  }
  return getRouteStressPenaltyProfile(route, rootState.routeStress?.[route] || 0);
}
```

在 `applyActivityToState` 中：

```js
const routePenalty = getRoutePenaltyForActivity(rootState, activity);
```

对 `homework`：

```js
applyActivityEffectsWithFatiguePenalty(rootState, {
  ...activity.effects,
  resources: {
    ...activity.effects.resources,
    insight: Math.max(0, Number(activity.effects.resources?.insight || 0) - routePenalty.resourcePenalty),
  },
}, fatiguePenaltyStep);
```

对作业额外技能：

```js
const routePenaltyAmount = routePenalty.assignmentBonusPenalty >= 999
  ? baseAmount
  : routePenalty.assignmentBonusPenalty;
return Math.max(0, baseAmount - streakPenalty - fatiguePenalty - routePenaltyAmount);
```

对 `part_time` / `training`：

```js
if (activity.id === "part_time") {
  adjustedEffects.resources.coins = Math.max(0, adjustedEffects.resources.coins - routePenalty.resourcePenalty);
  adjustedEffects.stats.fatigue = Number(adjustedEffects.stats.fatigue || 0) + routePenalty.fatigueDelta;
}

if (activity.id === "training") {
  adjustedEffects.stats.aura = Math.max(0, Number(adjustedEffects.stats.aura || 0) - routePenalty.auraPenalty);
  adjustedEffects.stats.mood = Math.max(0, Number(adjustedEffects.stats.mood || 0) - routePenalty.moodPenalty);
  adjustedEffects.stats.selfControl = Number(adjustedEffects.stats.selfControl || 0) - routePenalty.selfControlPenalty;
}
```

并在自由时段记录中追加：

```js
if (!rootState.scheduleLocks?.[slotIndex] && ROUTE_ACTIVITY_MAP[activity.id]) {
  rootState.weekTracker.freeActions.push(activity.id);
}
```

- [ ] **Step 4: 重新跑测试**

Run: `node --test .\tests\route-stress.test.cjs`

Expected: PASS，新增 route stress 行为断言通过。

- [ ] **Step 5: 提交**

```bash
git add tests/route-stress.test.cjs src/domain/activity.js
git commit -m "feat: apply route stress penalties to activities"
```

---

### Task 5: 动态周结算文案、Summary UI 与继续下一周按钮

**Files:**
- Create: `tests/multiweek-copy.test.cjs`
- Modify: `data/copy.js`
- Modify: `data/ui.js`
- Modify: `main.js`

- [ ] **Step 1: 写失败测试，锁定动态周文案**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScripts(files) {
  const context = {
    window: { GAME_DATA: {}, GAME_RUNTIME: {} },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;
  files.forEach((file) => {
    const abs = path.join(process.cwd(), file);
    const code = fs.readFileSync(abs, "utf8");
    vm.runInNewContext(code, context, { filename: abs });
  });
  return context.window;
}

test("summary 文案支持动态周次与总周数", () => {
  const windowObject = loadScripts(["data/copy.js", "data/ui.js"]);
  const { COPY, UI_TEXT } = windowObject.GAME_DATA;

  assert.equal(COPY.summary.title(2, 4), "第 2 周结算");
  assert.match(
    COPY.summary.body({ week: 2, rank: "中上品", bestSkillLabel: "数术", dominantRoute: "study" }),
    /第 2 周/
  );
  assert.equal(UI_TEXT.statusLine.summary(3), "第 3 周结算完成");
  assert.equal(UI_TEXT.summary.continueBtn(3, 4), "进入第 4 周");
  assert.equal(UI_TEXT.summary.continueBtn(4, 4), "查看总评");
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test .\tests\multiweek-copy.test.cjs`

Expected: FAIL，当前 title/statusLine 还是静态字符串。

- [ ] **Step 3: 改 `data/copy.js` 与 `data/ui.js`**

```js
summary: {
  defaultMajorBeat: "这一周你仍在铺垫人脉和学业。",
  clueMajorBeat: "你推进了失踪舍友线索。",
  title(week) {
    return `第 ${week} 周结算`;
  },
  body({ week, rank, bestSkillLabel, dominantRoute }) {
    const routeText = dominantRoute === "balanced" ? "本周走的是均衡路线" : `本周主路线偏向 ${dominantRoute}`;
    return `你以 ${rank} 的评定结束了第 ${week} 周。当前最强项是 ${bestSkillLabel}。${routeText}。`;
  },
  logTitle(week) {
    return `第 ${week} 周结算`;
  },
},
weekStartStory(week) {
  return {
    title: `第 ${week} 周开始`,
    body: "周课表保持不变，本周重点在于自由时段策略是否还能撑住长期代价。",
    speaker: "教习司",
  };
},
```

```js
statusLine: {
  summary(week) {
    return `第 ${week} 周结算完成`;
  },
},
summary: {
  panelTitle(week, totalWeeks) {
    return week >= totalWeeks ? "阶段总评" : `第 ${week} 周结算`;
  },
  continueBtn(week, totalWeeks) {
    return week >= totalWeeks ? "查看总评" : `进入第 ${week + 1} 周`;
  },
  restartBtn: "重新开始",
  unranked: "未评级",
  bestSkill: "最佳技能",
},
```

- [ ] **Step 4: 改 `main.js` summary 渲染与按钮动作**

```js
function restartGame() {
  runSessionCommand({ type: "run/restart" });
  syncUi();
}

function continueWeek() {
  runSessionCommand({ type: "run/continue-week" });
  syncUi();
}
```

```js
function renderSummaryPanel() {
  const rank = state.summary?.rank || UI_TEXT.summary.unranked;
  const bestSkill = state.summary?.bestSkill || ["dao", 0];
  const isFinalWeek = state.week >= state.totalWeeks;

  mainPanel.innerHTML = `
    <div class="panel-title">
      <h2>${UI_TEXT.summary.panelTitle(state.summary?.week || state.week, state.totalWeeks)}</h2>
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
      ${metric("主路线", state.summary?.dominantRoute || "balanced")}
    </div>
    <div class="action-row">
      ${!isFinalWeek && state.summary?.canContinue ? `<button class="primary" id="continue-week-btn">${UI_TEXT.summary.continueBtn(state.week, state.totalWeeks)}</button>` : ""}
      <button class="ghost-button" id="restart-btn">${UI_TEXT.summary.restartBtn}</button>
    </div>
  `;

  if (!isFinalWeek && state.summary?.canContinue) {
    mainPanel.querySelector("#continue-week-btn").addEventListener("click", continueWeek);
  }
  mainPanel.querySelector("#restart-btn").addEventListener("click", restartGame);
}
```

- [ ] **Step 5: 重新跑文案测试**

Run: `node --test .\tests\multiweek-copy.test.cjs`

Expected: PASS，动态周次文本全部通过。

- [ ] **Step 6: 提交**

```bash
git add tests/multiweek-copy.test.cjs data/copy.js data/ui.js main.js
git commit -m "feat: add dynamic weekly summary UI"
```

---

### Task 6: 升级 4 周自动实验与策划案整合同步

**Files:**
- Modify: `scripts/third-round-experiment.mjs`
- Modify: `策划案整合.md`
- Test: `tests/course-selection.test.cjs`
- Test: `tests/route-stress.test.cjs`
- Test: `tests/week-cycle.test.cjs`
- Test: `tests/multiweek-copy.test.cjs`

- [ ] **Step 1: 先写脚本行为变更点到代码注释中**

在 `scripts/third-round-experiment.mjs` 顶部把模板更新为：

```js
const TOTAL_WEEKS = 4;

const TEMPLATES = [
  { id: "full-course-4w", label: "全课业-4周", pattern: ["homework"], description: "连续四周用课业填满自由时段" },
  { id: "full-part-time-4w", label: "全打工-4周", pattern: ["part_time"], description: "连续四周用打工填满自由时段" },
  { id: "full-training-4w", label: "全修炼-4周", pattern: ["training"], description: "连续四周用修炼填满自由时段" },
  { id: "balanced-4w", label: "均衡混排-4周", pattern: ["homework", "training", "part_time", "walk_city"], description: "连续四周走均衡路线" },
];
```

- [ ] **Step 2: 改造 `runTemplate()`，按周记录结果而不是遇到第一次 summary 就结束**

```js
async function continueIntoNextWeek(page) {
  await page.waitForSelector("#continue-week-btn", { timeout: 20000 });
  await page.click("#continue-week-btn");
  await page.waitForSelector(".planning-shell", { timeout: 20000 });
}

async function runTemplate(page, template, serverUrl) {
  const weeklyResults = [];
  await page.goto(serverUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#start-btn", { timeout: 20000 });
  await page.click('button[data-archetype="scholar"]');
  await page.click("#start-btn");
  await page.waitForSelector(".course-selection-shell", { timeout: 20000 });
  await page.click('button[data-course-id="formation_topology"]');
  await page.waitForFunction(
    () => {
      const btn = document.querySelector("#confirm-course-selection-btn");
      return Boolean(btn) && !btn.disabled;
    },
    { timeout: 20000 }
  );
  await page.click("#confirm-course-selection-btn");
  await page.waitForSelector(".planning-shell", { timeout: 20000 });

  while (true) {
    await fillSchedule(page, template.pattern);
    await page.click("#execute-btn");
    const mode = await advanceDay(page);
    if (mode !== "memory") {
      throw new Error(`Expected memory mode after resolving day, got ${mode}`);
    }
    const state = await getState(page);
    const placed = await placeMemoryPiece(page);
    if (!placed) {
      throw new Error(`Could not find a valid memory placement for week ${state.week} day ${state.day}`);
    }
    await page.click("#end-night-btn");
    const nextMode = await waitForPlanningOrSummary(page);

    if (nextMode === "summary") {
      const summaryState = await getState(page);
      weeklyResults.push({
        week: summaryState.week,
        rank: summaryState.summary?.rank ?? null,
        dominantRoute: summaryState.summary?.dominantRoute ?? null,
        routeStress: summaryState.route_stress || summaryState.routeStress || null,
        resources: summaryState.resources,
        stats: summaryState.stats,
        skills: summaryState.skills,
      });

      if ((summaryState.summary?.canContinue ?? false) === false) {
        return {
          template: template.id,
          label: template.label,
          description: template.description,
          weeks: weeklyResults,
          finalState: summaryState,
        };
      }

      await continueIntoNextWeek(page);
    }
  }
}
```

- [ ] **Step 3: 输出 JSON 改成逐周结构**

```js
results.push({
  template: templateResult.template,
  label: templateResult.label,
  description: templateResult.description,
  weeks: templateResult.weeks,
  final: {
    weeklySettlement: finalState.summary?.rank ?? null,
    fatigue: finalState.stats.fatigue,
    aura: finalState.stats.aura,
    spirit: finalState.resources.spirit,
    insight: finalState.resources.insight,
    coins: finalState.resources.coins,
    bestSkill,
    summary: finalState.summary,
    buildingStats: memoryLens.structureTotals,
    bridgeCount: memoryLens.bridgeCount,
    week: finalState.week,
  },
});
```

- [ ] **Step 4: 更新 [策划案整合.md](/F:/personal/game_t/xianDemo/策划案整合.md)**

追加一节“多周策略验证规则”，明确写入：

```md
## 多周策略验证

- 当前 demo 的验证周期已扩展为固定课表下的 4 周连续实验。
- 课程表只在第 1 周开局选择一次，后续 3 周沿用同一周课表。
- 自由时段策略会累积长期代价：`study / work / training` 三类路线各自记录 `routeStress`。
- 极端路线预期表现为：第 1 周亮眼，第 2-3 周开始变钝，第 4 周若不转向则明显不如均衡路线稳定。
- 周结算现在是阶段性周报；最后一周结束后再看总评。
```

- [ ] **Step 5: 运行完整验证**

Run: `node --test .\tests\course-selection.test.cjs .\tests\route-stress.test.cjs .\tests\week-cycle.test.cjs .\tests\multiweek-copy.test.cjs`

Expected: 全部 PASS。

Run: `node --check .\scripts\third-round-experiment.mjs`

Expected: 无输出，退出码 0。

Run: `node .\scripts\third-round-experiment.mjs`

Expected:
- 4 个模板全部跑完
- `tmp/third-round-experiment-results.json` 写出成功
- JSON 中每个模板都包含 `weeks` 数组，长度为 4

- [ ] **Step 6: 提交**

```bash
git add scripts/third-round-experiment.mjs 策划案整合.md tests/course-selection.test.cjs tests/route-stress.test.cjs tests/week-cycle.test.cjs tests/multiweek-copy.test.cjs
git commit -m "feat: add multiweek experiment coverage"
```

---

## Self-Review Checklist

- [ ] `routeStress` 只在周结算后更新，不在周内提前生效
- [ ] `summary` 文案不再写死“第一周”
- [ ] 第 1 周只选一次课，后续周不重复选课
- [ ] 非最终周 summary 必须能继续下一周
- [ ] 最终周 summary 必须能展示总评或至少停止继续按钮
- [ ] 自动实验脚本输出必须包含逐周结果，而不只是最终结果
- [ ] `策划案整合.md` 已同步多周策略验证与长期代价规则

## Recommended Verification Order

1. `node --test .\tests\route-stress.test.cjs`
2. `node --test .\tests\week-cycle.test.cjs`
3. `node --test .\tests\multiweek-copy.test.cjs`
4. `node --test .\tests\course-selection.test.cjs`
5. `node --test .\tests\course-selection.test.cjs .\tests\route-stress.test.cjs .\tests\week-cycle.test.cjs .\tests\multiweek-copy.test.cjs`
6. `node --check .\scripts\third-round-experiment.mjs`
7. `node .\scripts\third-round-experiment.mjs`
