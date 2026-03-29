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
    const fullPath = path.join(process.cwd(), file);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(code, context, { filename: fullPath });
  });

  return context.window;
}

test("summary copy and ui text support dynamic multiweek labels", () => {
  const windowObject = loadScripts(["data/copy.js", "data/ui.js"]);
  const { COPY, UI_TEXT } = windowObject.GAME_DATA;

  assert.equal(COPY.summary.title(2, 4), "第 2 周结算");
  assert.match(
    COPY.summary.body("中上品", "数术", { week: 2, totalWeeks: 4, dominantRoute: "study" }),
    /第 2 周/
  );
  assert.equal(UI_TEXT.statusLine.summary(3), "第 3 周结算完成");
  assert.equal(UI_TEXT.summary.panelTitle(2, 4), "第 2 周结算");
  assert.equal(UI_TEXT.summary.continueBtn(3, 4), "进入第 4 周");
  assert.equal(UI_TEXT.summary.continueBtn(4, 4), "查看总评");
});
