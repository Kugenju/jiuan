window.GAME_DATA = window.GAME_DATA || {};

const SLOT_NAMES = ["晨课", "午间", "午后", "夜修"];

const SKILL_LABELS = {
  math: "数术",
  sigil: "符法",
  dao: "道法",
  craft: "炼器",
};

const MEMORY_TYPES = {
  base: {
    label: "灵台基座",
    accent: "#f0c36c",
    desc: "用于解锁灰色节点，唤醒识海地脉。",
  },
  ability: {
    label: "术式楼",
    accent: "#89bbff",
    desc: "建在已解锁空节点，强化当天主修能力。",
  },
  boost: {
    label: "养神台",
    accent: "#63d3b1",
    desc: "调息养神，缓解疲惫并稳定心境。",
  },
  reasoning: {
    label: "悟理阁",
    accent: "#ef8f85",
    desc: "梳理白日所学，提升悟性与推演。",
  },
  bridge: {
    label: "衔接塔",
    accent: "#c3a7ff",
    desc: "架设于两座已建节点之间，贯通知识脉络。",
  },
};

const MEMORY_ZONE_META = {
  core: { label: "灵台", color: "#f0c36c" },
  math: { label: "数术区", color: "#7fc8ff" },
  sigil: { label: "符法区", color: "#a995ff" },
  dao: { label: "道法区", color: "#63d3b1" },
  craft: { label: "炼器区", color: "#ef8f85" },
};

const STAT_LABELS = {
  intelligence: "智力",
  memory: "记忆",
  stamina: "体力",
  inspiration: "灵感",
  willpower: "心力",
  aura: "灵力",
  charisma: "魅力",
  cleanliness: "整洁",
  mood: "情绪",
  fatigue: "疲惫",
  selfControl: "自控",
};

const RELATIONSHIP_LABELS = {
  roommate: "舍友缘",
  friend: "朋友",
  mentor: "导师",
  counselor: "辅导员",
};

const RESOURCE_LABELS = {
  coins: "灵石",
  insight: "悟道点",
  spirit: "灵力值",
};

Object.assign(window.GAME_DATA, {
  SLOT_NAMES,
  SKILL_LABELS,
  MEMORY_TYPES,
  MEMORY_ZONE_META,
  STAT_LABELS,
  RELATIONSHIP_LABELS,
  RESOURCE_LABELS,
});
