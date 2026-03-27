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

test("时段元数据包含时辰与时间描述", () => {
  const windowObject = loadScripts(["data/core.js"]);
  const { SLOT_NAMES, SLOT_DEFS } = windowObject.GAME_DATA;

  assert.ok(Array.isArray(SLOT_DEFS));
  assert.equal(SLOT_DEFS.length, SLOT_NAMES.length);
  assert.deepEqual(
    Array.from(SLOT_DEFS, (slot) => slot.id),
    ["dawn", "morning_class", "midday", "afternoon", "dusk", "night"]
  );
  assert.equal(SLOT_DEFS[0].label, "晨起");
  assert.match(SLOT_DEFS[0].timeLabel, /卯时/);
  assert.match(SLOT_DEFS[5].timeLabel, /戌时/);
});

test("渐进迁移阶段默认展示时辰化时段名，但保留旧简称", () => {
  const windowObject = loadScripts(["data/core.js"]);
  const { SLOT_NAMES, SLOT_DEFS } = windowObject.GAME_DATA;

  assert.equal(SLOT_NAMES[0], "卯时起身");
  assert.equal(SLOT_NAMES[1], "辰时早课");
  assert.equal(SLOT_NAMES[2], "巳时课业");
  assert.equal(SLOT_NAMES[3], "午未修习");
  assert.equal(SLOT_NAMES[4], "申酉行务");
  assert.equal(SLOT_NAMES[5], "戌亥夜修");
  assert.equal(SLOT_DEFS[0].label, "晨起");
  assert.equal(SLOT_DEFS[0].futureLabel, SLOT_NAMES[0]);
});

test("课程协议区分通识必修、专业必修和选修", () => {
  const windowObject = loadScripts(["data/core.js", "data/activities.js", "data/schedules.js"]);
  const { COURSE_CATALOG, COURSE_SELECTION_BLOCKS } = windowObject.GAME_DATA;

  assert.ok(Array.isArray(COURSE_CATALOG));
  assert.ok(COURSE_CATALOG.some((course) => course.category === "required_common"));
  assert.ok(COURSE_CATALOG.some((course) => course.category === "required_major"));
  assert.ok(COURSE_CATALOG.some((course) => course.category === "elective"));

  assert.ok(Array.isArray(COURSE_SELECTION_BLOCKS.commonRequired));
  assert.ok(Array.isArray(COURSE_SELECTION_BLOCKS.scholar));
  assert.ok(COURSE_SELECTION_BLOCKS.scholar.some((block) => block.category === "elective"));
});

test("固定必修课会预填，未选完选修前不能确认课表", () => {
  const windowObject = loadScripts([
    "data/core.js",
    "data/activities.js",
    "data/schedules.js",
    "src/domain/schedule.js",
  ]);
  const { COURSE_SELECTION_BLOCKS } = windowObject.GAME_DATA;
  const { cloneCourseSelectionBlocks, isCourseSelectionComplete } = windowObject.GAME_RUNTIME;

  const blocks = cloneCourseSelectionBlocks(COURSE_SELECTION_BLOCKS, "mechanist", "scholar");
  const fixedBlocks = blocks.filter((block) => block.selectionMode === "fixed");
  const chooseBlocks = blocks.filter((block) => block.selectionMode === "choose-one");

  assert.ok(fixedBlocks.length > 0);
  assert.ok(chooseBlocks.length > 0);
  assert.ok(fixedBlocks.every((block) => block.selectedCourseId));
  assert.equal(isCourseSelectionComplete(blocks), false);

  chooseBlocks.forEach((block) => {
    block.selectedCourseId = block.options[0];
  });

  assert.equal(isCourseSelectionComplete(blocks), true);
});
