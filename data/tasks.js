window.GAME_DATA = window.GAME_DATA || {};

const TASK_DEFS = {
  artifact_refining: {
    id: "artifact_refining",
    activityId: "artifact_refining_task",
    skill: "craft",
    durationDays: 3,
    weeklyLimit: 1,
    rounds: {
      maxRounds: 3,
      refreshMode: "replace_used_only",
      refreshPool: "base_refining_pool",
    },
    rewards: {
      skills: { craft: 1 },
      resources: { spirit: 1, insight: 1 },
      summaryMark: "artifact_refining",
    },
    objective: {
      id: "spirit_needle_blank",
      name: "聚灵针胚",
      scoreTarget: 3,
      materialRequirements: { xuantie: 1, lingshi: 1 },
    },
  },
};

const REFINING_CARD_TYPES = {
  xuantie: { id: "xuantie", label: "玄铁", category: "material" },
  lingshi: { id: "lingshi", label: "灵石", category: "material" },
  mujing: { id: "mujing", label: "木精", category: "material" },
  guanxing: { id: "guanxing", label: "观星", category: "ability" },
  lingduan: { id: "lingduan", label: "灵锻", category: "ability" },
};

// Recipe keys are the three resolved material ids sorted lexicographically and joined by '|'; duplicates show up as repeated ids.
const REFINING_RECIPE_TABLE = {
  "lingshi|xuantie|xuantie": 3,
  "xuantie|xuantie|xuantie": 1,
};

Object.assign(window.GAME_DATA, {
  TASK_DEFS,
  REFINING_CARD_TYPES,
  REFINING_RECIPE_TABLE,
});
