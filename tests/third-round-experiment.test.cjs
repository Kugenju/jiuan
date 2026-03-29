const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "..");

async function loadExperimentModule() {
  const moduleUrl = pathToFileURL(path.join(REPO_ROOT, "scripts", "third-round-experiment.mjs")).href;
  return import(`${moduleUrl}?t=${Date.now()}`);
}

test("third round experiment exposes 4-week templates and payload builder", async () => {
  const experiment = await loadExperimentModule();

  assert.equal(experiment.TOTAL_WEEKS, 4);
  assert.deepEqual(
    experiment.TEMPLATES.map((template) => template.id),
    ["full-course-4w", "full-part-time-4w", "full-training-4w", "balanced-4w"]
  );

  const payload = experiment.buildExperimentPayload(
    [
      {
        template: "full-course-4w",
        label: "全课业-4周",
        description: "连续四周用课业填满自由时段",
        weeks: [
          { week: 1, rank: "中上品", dominantRoute: "study" },
          { week: 2, rank: "中中品", dominantRoute: "study" },
          { week: 3, rank: "中下品", dominantRoute: "study" },
          { week: 4, rank: "下上品", dominantRoute: "study" },
        ],
        finalState: {
          week: 4,
          resources: { spirit: 8, insight: 18, coins: 12 },
          stats: { fatigue: 7, aura: 2 },
          skills: { math: 8, dao: 2 },
          summary: { rank: "下上品" },
          memory: {
            board: [],
            bridges: [],
          },
        },
      },
    ],
    "2026-03-29T10:00:00.000Z"
  );

  assert.equal(payload.generatedAt, "2026-03-29T10:00:00.000Z");
  assert.equal(payload.templates[0].weeks.length, 4);
  assert.equal(payload.templates[0].final.week, 4);
  assert.equal(payload.templates[0].final.weeklySettlement, "下上品");
});

test("策划案整合包含多周策略验证章节", () => {
  const planningDoc = fs.readFileSync(path.join(REPO_ROOT, "策划案整合.md"), "utf8");

  assert.match(planningDoc, /## 多周策略验证/);
  assert.match(planningDoc, /固定课表下的 4 周连续实验/);
  assert.match(planningDoc, /routeStress/);
  assert.match(planningDoc, /第 1 周亮眼，第 2-3 周开始变钝/);
});
