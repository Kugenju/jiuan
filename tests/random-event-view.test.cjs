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

const UI_TEXT = {
  randomEvent: {
    badge: "随机事件",
    promptLabel: "事件抉择",
    resultLabel: "事件结果",
    chooseHint: "请选择一项。",
    continueBtn: "继续",
    rewardPrefix: "奖励：",
  },
};

function createPromptRuntime() {
  return {
    stage: "prompt",
    focusedChoiceIndex: 1,
    pendingEvent: {
      title: "A note",
      body: "You find a note.",
      choices: [
        { id: "accept", label: "Accept" },
        { id: "ignore", label: "Ignore" },
      ],
    },
  };
}

function createResultRuntime() {
  return {
    stage: "result",
    focusedChoiceIndex: 0,
    pendingEvent: {
      title: "A note",
      body: "You find a note.",
      choices: [
        { id: "accept", label: "Accept" },
        { id: "ignore", label: "Ignore" },
      ],
    },
    resultText: "You accept.",
    rewardSummary: "Insight +1",
  };
}

test("renderRandomEventModalHtml prompt hides rewards and includes choice buttons", () => {
  const windowObject = loadScripts(["src/app/random-event-view.js"]);
  const { renderRandomEventModalHtml } = windowObject.GAME_RUNTIME;

  const html = renderRandomEventModalHtml({ runtime: createPromptRuntime(), uiText: UI_TEXT });

  assert.match(html, /随机事件/);
  assert.match(html, /事件抉择/);
  assert.match(html, /A note/);
  assert.match(html, /You find a note\./);
  assert.match(html, /请选择一项/);
  assert.match(html, /Accept/);
  assert.match(html, /Ignore/);
  assert.match(html, /choice-card active/);
  assert.doesNotMatch(html, /奖励/);
  assert.doesNotMatch(html, /继续/);
});

test("renderRandomEventModalHtml result shows reward summary and continue button", () => {
  const windowObject = loadScripts(["src/app/random-event-view.js"]);
  const { renderRandomEventModalHtml } = windowObject.GAME_RUNTIME;

  const html = renderRandomEventModalHtml({ runtime: createResultRuntime(), uiText: UI_TEXT });

  assert.match(html, /事件结果/);
  assert.match(html, /A note/);
  assert.match(html, /You accept\./);
  assert.match(html, /奖励/);
  assert.match(html, /Insight \+1/);
  assert.match(html, /继续/);
});

test("renderRandomEventModalHtml returns empty string for idle stage", () => {
  const windowObject = loadScripts(["src/app/random-event-view.js"]);
  const { renderRandomEventModalHtml } = windowObject.GAME_RUNTIME;

  const html = renderRandomEventModalHtml({
    runtime: { stage: "idle" },
    uiText: UI_TEXT,
  });

  assert.equal(html, "");
});

test("renderRandomEventModalHtml escapes interpolated text", () => {
  const windowObject = loadScripts(["src/app/random-event-view.js"]);
  const { renderRandomEventModalHtml } = windowObject.GAME_RUNTIME;
  const runtime = {
    stage: "prompt",
    focusedChoiceIndex: 0,
    pendingEvent: {
      title: "<strong>Title</strong>",
      body: "Body & more",
      choices: [
        { id: "a\"b", label: "<Click>" },
      ],
    },
  };

  const html = renderRandomEventModalHtml({ runtime, uiText: UI_TEXT });

  assert.match(html, /&lt;strong&gt;Title&lt;\/strong&gt;/);
  assert.match(html, /Body &amp; more/);
  assert.match(html, /&lt;Click&gt;/);
  assert.match(html, /data-random-event-choice=\"a&quot;b\"/);
});

test("keyboard handler routes resolving keys to random-event modal", () => {
  const windowObject = loadScripts(["src/app/keyboard-controls.js"]);
  const { createKeyboardHandler } = windowObject.GAME_RUNTIME;
  const calls = {
    focus: [],
    activate: 0,
    advance: 0,
    preventDefault: 0,
  };

  const handler = createKeyboardHandler({
    state: {
      mode: "resolving",
      randomEventRuntime: {
        stage: "prompt",
      },
    },
    slotCount: 6,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    focusRandomEventChoice: (delta) => calls.focus.push(delta),
    activateRandomEventChoice: () => {
      calls.activate += 1;
    },
    advanceResolvingFlow: () => {
      calls.advance += 1;
    },
  });

  handler({
    key: "ArrowRight",
    preventDefault: () => {
      calls.preventDefault += 1;
    },
  });

  handler({
    key: "Enter",
    preventDefault: () => {
      calls.preventDefault += 1;
    },
  });

  assert.deepEqual(calls.focus, [1]);
  assert.equal(calls.activate, 1);
  assert.equal(calls.advance, 0);
  assert.ok(calls.preventDefault >= 2);
});

test("keyboard handler does not fall back when random-event hook is missing", () => {
  const windowObject = loadScripts(["src/app/keyboard-controls.js"]);
  const { createKeyboardHandler } = windowObject.GAME_RUNTIME;
  const calls = {
    advance: 0,
  };

  const handler = createKeyboardHandler({
    state: {
      mode: "resolving",
      randomEventRuntime: {
        stage: "prompt",
      },
    },
    slotCount: 6,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    advanceResolvingFlow: () => {
      calls.advance += 1;
    },
  });

  handler({
    key: "Enter",
    preventDefault: () => {},
  });

  assert.equal(calls.advance, 0);
});

test("keyboard handler does not route random-event keys outside resolving mode", () => {
  const windowObject = loadScripts(["src/app/keyboard-controls.js"]);
  const { createKeyboardHandler } = windowObject.GAME_RUNTIME;
  const calls = {
    focus: 0,
    activate: 0,
  };

  const handler = createKeyboardHandler({
    state: {
      mode: "planning",
      randomEventRuntime: {
        stage: "prompt",
      },
    },
    slotCount: 6,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    setSlot: () => {},
    cycleSelectedActivity: () => {},
    assignActivity: () => {},
    startDay: () => {},
    focusRandomEventChoice: () => {
      calls.focus += 1;
    },
    activateRandomEventChoice: () => {
      calls.activate += 1;
    },
  });

  handler({
    key: "ArrowRight",
    preventDefault: () => {},
  });

  handler({
    key: "Enter",
    preventDefault: () => {},
  });

  assert.equal(calls.focus, 0);
  assert.equal(calls.activate, 0);
});

test("keyboard handler confirms random-event result on enter/space", () => {
  const windowObject = loadScripts(["src/app/keyboard-controls.js"]);
  const { createKeyboardHandler } = windowObject.GAME_RUNTIME;
  const calls = {
    focus: 0,
    activate: 0,
    confirm: 0,
    advance: 0,
  };

  const handler = createKeyboardHandler({
    state: {
      mode: "resolving",
      randomEventRuntime: {
        stage: "result",
      },
    },
    slotCount: 6,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    focusRandomEventChoice: () => {
      calls.focus += 1;
    },
    activateRandomEventChoice: () => {
      calls.activate += 1;
    },
    confirmRandomEventResult: () => {
      calls.confirm += 1;
    },
    advanceResolvingFlow: () => {
      calls.advance += 1;
    },
  });

  handler({
    key: "ArrowRight",
    preventDefault: () => {},
  });

  handler({
    key: "Enter",
    preventDefault: () => {},
  });

  handler({
    key: " ",
    preventDefault: () => {},
  });

  assert.equal(calls.focus, 0);
  assert.equal(calls.activate, 0);
  assert.equal(calls.confirm, 2);
  assert.equal(calls.advance, 0);
});

test("keyboard handler blocks unrelated keys when random-event modal is active", () => {
  const windowObject = loadScripts(["src/app/keyboard-controls.js"]);
  const { createKeyboardHandler } = windowObject.GAME_RUNTIME;
  const calls = {
    toggleStats: 0,
    toggleAutoplay: 0,
  };

  const handler = createKeyboardHandler({
    state: {
      mode: "resolving",
      randomEventRuntime: {
        stage: "prompt",
      },
    },
    slotCount: 6,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    toggleStatsPanel: () => {
      calls.toggleStats += 1;
    },
    toggleResolvingAutoplay: () => {
      calls.toggleAutoplay += 1;
    },
  });

  handler({
    key: "i",
    preventDefault: () => {},
  });

  handler({
    key: "p",
    preventDefault: () => {},
  });

  assert.equal(calls.toggleStats, 0);
  assert.equal(calls.toggleAutoplay, 0);
});
