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
  dao_debate: {
    id: "dao_debate",
    activityId: "dao_debate_task",
    skill: "dao",
    durationDays: 7,
    weeklyLimit: 1,
    unlockThreshold: 2,
    availableAfterDays: 1,
    topicPool: ["topic_1"],
    hiddenUnlockFlags: ["dao_archive_insight", "dao_counterexample_insight"],
    rounds: {
      maxRounds: 3,
      handSize: 5,
      hiddenCardLimit: 1,
    },
    rewards: {
      skills: { dao: 1 },
      resources: { insight: 1 },
      summaryMark: "dao_debate",
    },
    successRules: {
      convictionTarget: 5,
      maxExposure: 1,
      fallbackConvictionTarget: 4,
      fallbackExposure: 0,
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

const DAO_DEBATE_TOPICS = {
  topic_1: {
    id: "topic_1",
    title: "术可代德否",
    openingPrompt: "若一门术法可救万人，却需修者常年损德折寿，此术当兴还是当禁？",
    openingFollowupType: "press_principle",
  },
};

const DAO_DEBATE_CARDS = {
  uphold_principle: { id: "uphold_principle", label: "守其本义", tag: "principle" },
  weigh_outcomes: { id: "weigh_outcomes", label: "衡量得失", tag: "utility" },
  cite_classic: { id: "cite_classic", label: "援引经典", tag: "authority" },
  personal_witness: { id: "personal_witness", label: "援引亲历", tag: "experience" },
  break_assumption: { id: "break_assumption", label: "指出反例", tag: "counterexample" },
  archive_case_note: {
    id: "archive_case_note",
    label: "道阁案牍",
    tag: "experience",
    hidden: true,
    unlockFlag: "dao_archive_insight",
  },
  counterexample_dossier: {
    id: "counterexample_dossier",
    label: "反证案卷",
    tag: "counterexample",
    hidden: true,
    unlockFlag: "dao_counterexample_insight",
  },
};

const DAO_DEBATE_FOLLOWUPS = {
  press_principle: {
    id: "press_principle",
    label: "逼问义理",
    prompt: "\u903c\u95ee\u4e49\u7406\uff1a\u82e5\u6b64\u7406\u5f53\u771f\u80fd\u7acb\u4f4f\uff0c\u4e3a\u4f55\u5230\u4e86\u773c\u524d\u8fd9\u4e00\u6848\u5c31\u80fd\u4f8b\u5916\uff1f",
  },
  press_utility: {
    id: "press_utility",
    label: "逼问后果",
    prompt: "\u903c\u95ee\u540e\u679c\uff1a\u82e5\u771f\u6309\u6b64\u6cd5\u884c\u4e8b\uff0c\u4ee3\u4ef7\u7531\u8c01\u6765\u627f\u53d7\uff1f",
  },
  press_authority: {
    id: "press_authority",
    label: "逼问依凭",
    prompt: "\u903c\u95ee\u4f9d\u51ed\uff1a\u4f60\u6240\u63f4\u5f15\u7684\u65e7\u4f8b\uff0c\u771f\u80fd\u843d\u5230\u773c\u524d\u8fd9\u4e2a\u5c40\u9762\u4e0a\u5417\uff1f",
  },
  press_evasion: {
    id: "press_evasion",
    label: "逼问回避",
    prompt: "\u903c\u95ee\u56de\u907f\uff1a\u4f60\u65b9\u624d\u907f\u5f00\u4e86\u8981\u5bb3\uff0c\u73b0\u5728\u53ef\u5426\u6b63\u9762\u4f5c\u7b54\uff1f",
  },
};

Object.assign(window.GAME_DATA, {
  TASK_DEFS,
  REFINING_CARD_TYPES,
  REFINING_RECIPE_TABLE,
  DAO_DEBATE_TOPICS,
  DAO_DEBATE_CARDS,
  DAO_DEBATE_FOLLOWUPS,
});
