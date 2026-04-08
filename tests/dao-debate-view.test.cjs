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

test("renderDaoDebateTaskPanelHtml shows prompt, scores, and playable card buttons", () => {
  const windowObject = loadScripts(["src/app/dao-debate-view.js"]);
  const { buildDaoDebateTaskPanelState, renderDaoDebateTaskPanelHtml } = windowObject.GAME_RUNTIME;

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
    taskText: {
      daoDebateRound: (current, max) => `${current}/${max}`,
      daoConviction: (value) => `\u7acb\u8bba:${value}`,
      daoExposure: (value) => `\u7834\u7efd:${value}`,
      attemptCount: (value) => `attempt:${value}`,
    },
  });

  const html = renderDaoDebateTaskPanelHtml(panelState);
  assert.equal(panelState.roundText, "2/3");
  assert.equal(panelState.convictionText, "\u7acb\u8bba:2");
  assert.equal(panelState.exposureText, "\u7834\u7efd:1");
  assert.match(html, /\u9053\u6cd5\u8bba\u8fa9/);
  assert.match(html, /\u8ffd\u95ee\u6587\u672c/);
  assert.match(html, /data-task-control="debate-card"/);
  assert.match(html, /data-debate-card="uphold_principle"/);
});
