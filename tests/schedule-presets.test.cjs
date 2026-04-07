const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadSchedulesData() {
  const context = {
    window: { GAME_DATA: {} },
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  const code = fs.readFileSync(path.join(REPO_ROOT, "data/schedules.js"), "utf8");
  vm.runInNewContext(code, context, { filename: "data/schedules.js" });
  return context.window.GAME_DATA.SCHEDULE_PRESETS || [];
}

test("schedule presets provide a fallback activity for each slot", () => {
  const presets = loadSchedulesData();

  assert.ok(presets.length > 0);
  presets.forEach((preset) => {
    assert.equal(Array.isArray(preset.schedule), true, `${preset.id} should define schedule`);
    assert.equal(preset.schedule.length, 6, `${preset.id} should define all six slots`);
    preset.schedule.forEach((activityId, slotIndex) => {
      assert.ok(activityId, `${preset.id} slot ${slotIndex} should not be empty`);
    });
  });
});
