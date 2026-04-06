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
    badge: "Random Event",
    promptLabel: "Event Prompt",
    resultLabel: "Event Result",
    chooseHint: "Choose one.",
    continueBtn: "Continue",
    rewardPrefix: "Rewards:",
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

  assert.match(html, /Random Event/);
  assert.match(html, /Event Prompt/);
  assert.match(html, /A note/);
  assert.match(html, /You find a note\./);
  assert.match(html, /Choose one\./);
  assert.match(html, /Accept/);
  assert.match(html, /Ignore/);
  assert.match(html, /choice-card active/);
  assert.doesNotMatch(html, /Rewards/);
  assert.doesNotMatch(html, /Continue/);
});

test("renderRandomEventModalHtml result shows reward summary and continue button", () => {
  const windowObject = loadScripts(["src/app/random-event-view.js"]);
  const { renderRandomEventModalHtml } = windowObject.GAME_RUNTIME;

  const html = renderRandomEventModalHtml({ runtime: createResultRuntime(), uiText: UI_TEXT });

  assert.match(html, /Event Result/);
  assert.match(html, /A note/);
  assert.match(html, /You accept\./);
  assert.match(html, /Rewards/);
  assert.match(html, /Insight \+1/);
  assert.match(html, /Continue/);
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

test("keyboard handler falls back when random-event hook is missing", () => {
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

  assert.equal(calls.advance, 1);
});
