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

Object.assign(window.GAME_DATA, {
  SLOT_NAMES,
  SKILL_LABELS,
  MEMORY_TYPES,
});
