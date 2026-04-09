const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: { GAME_DATA: {}, GAME_RUNTIME: {} },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(REPO_ROOT, file);
    vm.runInNewContext(fs.readFileSync(fullPath, "utf8"), context, { filename: fullPath });
  });

  return context.window;
}

test("renderDaoDebateTaskPanelHtml localizes card tag copy without leaking internal enum values", () => {
  const windowObject = loadScripts(["data/ui.js", "src/app/dao-debate-view.js"]);
  const { buildDaoDebateTaskPanelState, renderDaoDebateTaskPanelHtml } = windowObject.GAME_RUNTIME;
  const taskText = windowObject.GAME_DATA.UI_TEXT.task;

  const panelState = buildDaoDebateTaskPanelState({
    activity: { name: "\u9053\u6cd5\u8bba\u8fa9", summary: "summary" },
    task: { attemptCount: 1 },
    session: {
      roundIndex: 2,
      maxRounds: 3,
      conviction: 2,
      exposure: 1,
      currentPrompt: { title: "\u672f\u53ef\u4ee3\u5fb7\u5426", body: "\u8ffd\u95ee\u6587\u672c" },
      hand: [
        { id: "uphold_principle", label: "\u5b88\u5176\u672c\u4e49", tag: "principle" },
        { id: "cite_classic", label: "\u63f4\u5f15\u7ecf\u5178", tag: "authority" },
      ],
      history: [{ roundIndex: 1, scoreType: "strong", cardId: "weigh_outcomes" }],
    },
    taskText,
  });

  const html = renderDaoDebateTaskPanelHtml(panelState);
  assert.equal(panelState.roundText, "\u7b2c 2 / 3 \u8f6e");
  assert.equal(panelState.convictionText, "\u7acb\u8bba 2");
  assert.equal(panelState.exposureText, "\u7834\u7efd 1");
  assert.match(html, /\u9053\u6cd5\u8bba\u8fa9/);
  assert.match(html, /\u8ffd\u95ee\u6587\u672c/);
  assert.match(html, /守义/);
  assert.match(html, /引经/);
  assert.doesNotMatch(html, /<small>principle<\/small>/);
  assert.doesNotMatch(html, /<small>authority<\/small>/);
  assert.match(html, /data-task-control="debate-card"/);
  assert.match(html, /data-debate-card="uphold_principle"/);
});

test("renderDaoDebateTaskPanelHtml escapes text content and data attributes", () => {
  const windowObject = loadScripts(["src/app/dao-debate-view.js"]);
  const { buildDaoDebateTaskPanelState, renderDaoDebateTaskPanelHtml } = windowObject.GAME_RUNTIME;

  const panelState = buildDaoDebateTaskPanelState({
    activity: { name: "<script>\u9053\u8bba</script>", summary: "summary" },
    task: { attemptCount: 1 },
    session: {
      roundIndex: 1,
      maxRounds: 3,
      conviction: 3,
      exposure: 0,
      currentPrompt: {
        title: "\"\u6807\u9898\" <b>\u8ffd\u95ee</b>",
        body: "<img src=x onerror=alert(1)> & '\u8ffd\u95ee'",
      },
      hand: [
        {
          id: "card\" onclick=\"alert(1)",
          label: "<Guard & Gather>",
          tag: "principle",
        },
      ],
    },
    taskText: {
      daoDebateRound: () => "1/3",
      daoConviction: () => "\u7acb\u8bba <3",
      daoExposure: () => "\u7834\u7efd >0",
      attemptCount: () => "attempt:\"1\"",
      daoDebateTag: () => "\u5b88\u4e49 & \u5f15\u7ecf",
    },
  });

  const html = renderDaoDebateTaskPanelHtml(panelState);
  assert.match(html, /&lt;script&gt;道论&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>道论<\/script>/);
  assert.match(html, /&quot;标题&quot; &lt;b&gt;追问&lt;\/b&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &#39;追问&#39;/);
  assert.match(html, /&lt;Guard &amp; Gather&gt;/);
  assert.match(html, /data-debate-card="card&quot; onclick=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /data-debate-card="card" onclick="alert\(1\)"/);
});

test("renderDaoDebateTaskPanelHtml can disable card controls during staged reveal", () => {
  const windowObject = loadScripts(["data/ui.js", "src/app/dao-debate-view.js"]);
  const { buildDaoDebateTaskPanelState, renderDaoDebateTaskPanelHtml } = windowObject.GAME_RUNTIME;
  const taskText = windowObject.GAME_DATA.UI_TEXT.task;

  const panelState = buildDaoDebateTaskPanelState({
    activity: { name: "\u9053\u6cd5\u8bba\u8fa9", summary: "summary" },
    task: { attemptCount: 1 },
    session: {
      roundIndex: 1,
      maxRounds: 3,
      conviction: 0,
      exposure: 0,
      currentPrompt: { title: "t", body: "b" },
      hand: [{ id: "uphold_principle", label: "\u5b88\u5176\u672c\u4e49", tag: "principle" }],
    },
    taskText,
    controlsDisabled: true,
  });

  const html = renderDaoDebateTaskPanelHtml(panelState);
  assert.equal(panelState.controlsDisabled, true);
  assert.match(html, /data-task-control="debate-card"/);
  assert.match(html, /disabled/);
});
