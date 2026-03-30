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
    const fullPath = path.join(process.cwd(), file);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(code, context, { filename: fullPath });
  });

  return context.window;
}

test("detectDominantRoute finds study/work/training or balanced", () => {
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

test("updateRouteStress adjusts and clamps stresses with balanced recovery", () => {
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

test("getRouteStressPenaltyProfile returns the designed tiered penalties", () => {
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
