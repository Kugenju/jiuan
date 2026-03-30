import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStaticServer } from "./lib/static-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "tmp", "third-round-experiment-results.json");

export const TOTAL_WEEKS = 4;

export const TEMPLATES = [
  {
    id: "full-course-4w",
    label: "全课业-4周",
    pattern: ["homework"],
    description: "连续四周用课业填满自由时段",
  },
  {
    id: "full-part-time-4w",
    label: "全打工-4周",
    pattern: ["part_time"],
    description: "连续四周用打工填满自由时段",
  },
  {
    id: "full-training-4w",
    label: "全修炼-4周",
    pattern: ["training"],
    description: "连续四周用修炼填满自由时段",
  },
  {
    id: "balanced-4w",
    label: "均衡混排-4周",
    pattern: ["homework", "training", "part_time", "walk_city"],
    description: "连续四周走均衡路线",
  },
];

const SELECT_TEMPLATE_IDS = process.env.TEMPLATES
  ? process.env.TEMPLATES.split(",").map((entry) => entry.trim()).filter(Boolean)
  : null;

function getSelectedTemplates() {
  if (!SELECT_TEMPLATE_IDS?.length) {
    return TEMPLATES;
  }
  return TEMPLATES.filter((template) => SELECT_TEMPLATE_IDS.includes(template.id));
}

async function getState(page) {
  const text = await page.evaluate(() => window.render_game_to_text());
  return JSON.parse(text);
}

async function getMode(page) {
  const state = await getState(page);
  return state.mode;
}

function snapshotFields(state) {
  return {
    day: state.day,
    week: state.week,
    mode: state.mode,
    resources: state.resources,
    stats: state.stats,
    skills: state.skills,
    summary: state.summary,
    rank: state.summary?.rank ?? null,
  };
}

function analyzeMemory(state) {
  const structures = state.memory.board.filter((node) => Boolean(node.structure));
  const structureTotals = structures.reduce(
    (acc, node) => {
      if (!node.structure) {
        return acc;
      }
      acc.total += 1;
      acc.byType[node.structure] = (acc.byType[node.structure] || 0) + 1;
      return acc;
    },
    { total: 0, byType: {} }
  );
  const bridgeCount = state.memory.bridges.filter(Boolean).length;
  return {
    structureTotals,
    bridgeCount,
  };
}

function normalizeBestSkill(summary, skills) {
  if (Array.isArray(summary?.bestSkill)) {
    const [skill, level] = summary.bestSkill;
    return { skill, level };
  }
  const best = Object.entries(skills || {}).sort((a, b) => b[1] - a[1])[0] || [];
  return { skill: best[0] ?? null, level: best[1] ?? 0 };
}

function getRouteStressSnapshot(state) {
  return state.route_stress || state.routeStress || null;
}

function buildWeekRecord(summaryState) {
  return {
    week: summaryState.week,
    rank: summaryState.summary?.rank ?? null,
    dominantRoute: summaryState.summary?.dominantRoute ?? null,
    routeStress: getRouteStressSnapshot(summaryState),
    resources: summaryState.resources,
    stats: summaryState.stats,
    skills: summaryState.skills,
  };
}

export function buildExperimentPayload(templateResults, generatedAt = new Date().toISOString()) {
  return {
    generatedAt,
    templates: templateResults.map((templateResult) => {
      const memoryLens = analyzeMemory(templateResult.finalState);
      const finalState = templateResult.finalState;
      const bestSkill = normalizeBestSkill(finalState.summary, finalState.skills);
      return {
        template: templateResult.template,
        label: templateResult.label,
        description: templateResult.description,
        weeks: templateResult.weeks,
        final: {
          weeklySettlement: finalState.summary?.rank ?? null,
          fatigue: finalState.stats.fatigue,
          aura: finalState.stats.aura,
          spirit: finalState.resources.spirit,
          insight: finalState.resources.insight,
          coins: finalState.resources.coins,
          bestSkill,
          summary: finalState.summary,
          buildingStats: memoryLens.structureTotals,
          bridgeCount: memoryLens.bridgeCount,
          week: finalState.week,
        },
        snapshots: templateResult.snapshots,
      };
    }),
  };
}

async function fillSchedule(page, pattern) {
  await page.waitForSelector("#left-panel button[data-left-slot]", { timeout: 20000 });
  const slotInfos = await page.$$eval("#left-panel button[data-left-slot]", (slots) =>
    slots
      .map((slot) => ({
        index: Number(slot.getAttribute("data-left-slot")),
        fixed: slot.classList.contains("fixed"),
      }))
      .sort((a, b) => a.index - b.index)
  );
  let pointer = 0;
  for (const slot of slotInfos) {
    if (slot.fixed) {
      continue;
    }
    const activityId = pattern[pointer % pattern.length];
    pointer += 1;
    await page.click(`#left-panel button[data-left-slot="${slot.index}"]`);
    await page.click(`[data-activity="${activityId}"]`);
  }
}

async function advanceDay(page) {
  while (true) {
    await page.waitForSelector("#resolve-next-btn", { timeout: 20000 });
    await page.click("#resolve-next-btn");
    await page.waitForTimeout(200);
    const mode = await getMode(page);
    if (mode !== "resolving") {
      return mode;
    }
  }
}

async function waitForPlanningOrSummary(page) {
  await page.waitForTimeout(200);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const mode = await getMode(page);
    if (mode === "planning" || mode === "summary") {
      return mode;
    }
    await page.waitForTimeout(200);
  }
  throw new Error("Timed out waiting for planning or summary mode after ending night");
}

async function placeMemoryPiece(page) {
  const pieceIds = await page.$$eval("[data-piece]:not([disabled])", (pieces) =>
    pieces.map((piece) => piece.getAttribute("data-piece")).filter(Boolean)
  );

  for (const pieceId of pieceIds) {
    await page.click(`[data-piece="${pieceId}"]`);
    await page.waitForTimeout(100);
    const state = await getState(page);
    const validNode = state.memory.valid_nodes?.[0];
    if (validNode) {
      await page.click(`[data-memory-node="${validNode.id}"]`);
      await page.waitForTimeout(150);
      return true;
    }
    const validEdge = state.memory.valid_edges?.[0];
    if (validEdge) {
      await page.click(`[data-memory-edge="${validEdge.id}"]`);
      await page.waitForTimeout(150);
      return true;
    }
  }

  return false;
}

export async function continueIntoNextWeek(page) {
  await page.waitForSelector("#continue-week-btn", { timeout: 20000 });
  await page.click("#continue-week-btn");
  await page.waitForSelector(".planning-shell", { timeout: 20000 });
}

export async function runTemplate(page, template, serverUrl) {
  console.log(`\nRunning template ${template.label} (${template.id})`);
  await page.goto(serverUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#start-btn", { timeout: 20000 });
  await page.click('button[data-archetype="scholar"]');
  await page.click("#start-btn");
  await page.waitForSelector(".course-selection-shell", { timeout: 20000 });
  await page.click('button[data-course-id="formation_topology"]');
  await page.waitForFunction(
    () => {
      const btn = document.querySelector("#confirm-course-selection-btn");
      return Boolean(btn) && !btn.disabled;
    },
    { timeout: 20000 }
  );
  await page.click("#confirm-course-selection-btn");
  await page.waitForSelector(".planning-shell", { timeout: 20000 });

  const snapshots = {};
  const weeks = [];
  while (true) {
    await fillSchedule(page, template.pattern);
    await page.waitForTimeout(100);
    await page.click("#execute-btn");
    const mode = await advanceDay(page);
    if (mode !== "memory") {
      throw new Error(`Expected memory mode after resolving day, got ${mode}`);
    }
    const state = await getState(page);
    if ([1, 3, 5, 7].includes(state.day)) {
      snapshots[`week${state.week}-day${state.day}`] = snapshotFields(state);
    }
    const placed = await placeMemoryPiece(page);
    if (!placed) {
      throw new Error(`Could not find a valid memory placement for week ${state.week} day ${state.day}`);
    }
    await page.click("#end-night-btn");
    const nextMode = await waitForPlanningOrSummary(page);

    if (nextMode === "summary") {
      const summaryState = await getState(page);
      weeks.push(buildWeekRecord(summaryState));

      if ((summaryState.summary?.canContinue ?? false) === false) {
        return {
          template: template.id,
          label: template.label,
          description: template.description,
          weeks,
          snapshots,
          finalState: summaryState,
        };
      }

      await continueIntoNextWeek(page);
    }
  }
}

export async function run() {
  const staticServer = await startStaticServer({ rootDir: ROOT_DIR });
  try {
    console.log(`Static server listening on ${staticServer.url}`);
    const browser = await chromium.launch({ headless: true });
    const templateResults = [];
    try {
      for (const template of getSelectedTemplates()) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
        const page = await context.newPage();
        try {
          templateResults.push(await runTemplate(page, template, staticServer.url));
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }

    const payload = buildExperimentPayload(templateResults);
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
    console.log(`\nExperiment data written to ${OUTPUT_PATH}`);
  } finally {
    await staticServer.close();
  }
}

function isDirectExecution() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(new URL(import.meta.url));
}

if (isDirectExecution()) {
  run().catch((error) => {
    console.error("Experiment failed", error);
    process.exit(1);
  });
}
