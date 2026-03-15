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
    label: "基座块",
    accent: "#f0c36c",
    desc: "只能放在最底层，用来稳定长期记忆。",
  },
  ability: {
    label: "能力块",
    accent: "#89bbff",
    desc: "需要建立在已有记忆上，强化主要修习能力。",
  },
  boost: {
    label: "增益块",
    accent: "#63d3b1",
    desc: "贴靠任意已有块体，恢复状态并稳定情绪。",
  },
  reasoning: {
    label: "推理块",
    accent: "#ef8f85",
    desc: "需要承托，用来整理白天遇到的问题。",
  },
  bridge: {
    label: "衔接块",
    accent: "#c3a7ff",
    desc: "在同一层连接相邻记忆区域，形成跨学科联结。",
  },
};

Object.assign(window.GAME_DATA, {
  SLOT_NAMES,
  SKILL_LABELS,
  MEMORY_TYPES,
});
