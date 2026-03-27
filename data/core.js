window.GAME_DATA = window.GAME_DATA || {};

const SLOT_DEFS = [
  {
    id: "dawn",
    label: "晨起",
    timeLabel: "卯时（05:00-07:00）",
    futureLabel: "卯时起身",
  },
  {
    id: "morning_class",
    label: "晨课",
    timeLabel: "辰时（07:00-09:00）",
    futureLabel: "辰时早课",
  },
  {
    id: "midday",
    label: "午间",
    timeLabel: "巳时（09:00-11:00）",
    futureLabel: "巳时课业",
  },
  {
    id: "afternoon",
    label: "午后",
    timeLabel: "午时-未时（11:00-15:00）",
    futureLabel: "午未修习",
  },
  {
    id: "dusk",
    label: "傍晚",
    timeLabel: "申时-酉时（15:00-19:00）",
    futureLabel: "申酉行务",
  },
  {
    id: "night",
    label: "夜修",
    timeLabel: "戌时-亥时（19:00-23:00）",
    futureLabel: "戌亥夜修",
  },
];

const SLOT_NAMES = SLOT_DEFS.map((slot) => slot.futureLabel || slot.label);

const ACTIVITY_KIND_LABELS = {
  course: "课程",
  assignment: "作业",
  routine: "日常",
};

const SKILL_LABELS = {
  math: "数术",
  sigil: "符法",
  dao: "道法",
  craft: "炼器",
  herbal: "灵物",
  formation: "阵法",
};

const SKILL_ZONE_MAP = {
  math: "math",
  sigil: "sigil",
  dao: "dao",
  craft: "craft",
  herbal: "dao",
  formation: "sigil",
};

const COURSE_CATEGORY_LABELS = {
  required_common: "通识必修",
  required_major: "专业必修",
  elective: "专业选修",
};

const MEMORY_TYPES = {
  base: {
    label: "灵台基座",
    accent: "#f0c36c",
    desc: "用于解锁灰色节点，唤醒识海中的长期记忆区。",
  },
  ability: {
    label: "术式楼",
    accent: "#89bbff",
    desc: "建在已解锁的空节点上，强化当天主修方向。",
  },
  boost: {
    label: "养神台",
    accent: "#63d3b1",
    desc: "调息养神，缓解疲惫并稳定心境。",
  },
  reasoning: {
    label: "悟理阁",
    accent: "#ef8f85",
    desc: "梳理白天所学，提升悟性与推演能力。",
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
  roommate: "舍友线",
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
  SLOT_DEFS,
  SLOT_NAMES,
  ACTIVITY_KIND_LABELS,
  SKILL_LABELS,
  SKILL_ZONE_MAP,
  COURSE_CATEGORY_LABELS,
  MEMORY_TYPES,
  MEMORY_ZONE_META,
  STAT_LABELS,
  RELATIONSHIP_LABELS,
  RESOURCE_LABELS,
});
