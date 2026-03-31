const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: {
      GAME_DATA: {},
      GAME_RUNTIME: {},
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

test("renderWeeklyTimetableModalHtml wraps read-only timetable content in modal shell", () => {
  const windowObject = loadScripts(["src/app/info-modal-view.js"]);
  const { renderWeeklyTimetableModalHtml } = windowObject.GAME_RUNTIME;

  const html = renderWeeklyTimetableModalHtml({
    title: "本周完整课表",
    closeLabel: "关闭",
    timetableHtml: '<div class="weekly-timetable-shell"><div class="week-cell fixed">丹器导论</div></div>',
  });

  assert.match(html, /本周完整课表/);
  assert.match(html, /overlay-modal-timetable/);
  assert.match(html, /weekly-timetable-modal/);
  assert.match(html, /weekly-timetable-modal-body/);
  assert.match(html, /id="info-close-btn"/);
  assert.match(html, /weekly-timetable-shell/);
});
