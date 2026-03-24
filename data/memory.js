window.GAME_DATA = window.GAME_DATA || {};

const MEMORY_FRAGMENT_TYPES = {
  anchor: {
    label: "灵台锚片",
    accent: "#f0c36c",
    slot: "locked-node",
    shape: "polygon(50% 0%, 84% 12%, 100% 50%, 84% 88%, 50% 100%, 16% 88%, 0% 50%, 16% 12%)",
    scale: 1.02,
    desc: "点亮灰域节点，让长期记忆有地方落脚。",
  },
  schema: {
    label: "结构纹片",
    accent: "#7fc8ff",
    slot: "node",
    zone: "math",
    shape: "polygon(24% 6%, 76% 6%, 100% 50%, 76% 94%, 24% 94%, 0% 50%)",
    scale: 1,
    desc: "来自课程梳理出的知识骨架，只能嵌入数术区或灵台核心，适合定型为术式楼或悟理阁。",
    affinity: { ability: 1, reasoning: 1 },
  },
  focus: {
    label: "专注纹片",
    accent: "#a995ff",
    slot: "node",
    zoneFromSkill: true,
    fallbackZone: "sigil",
    shape: "polygon(50% 0%, 90% 22%, 100% 62%, 62% 100%, 18% 88%, 0% 34%)",
    scale: 0.96,
    desc: "携带一门主修方向，只能落在对应分区或灵台核心，可把碎片推成明确的修行建筑。",
    affinity: { ability: 2 },
  },
  echo: {
    label: "回响纹片",
    accent: "#ef8f85",
    slot: "node",
    zone: "craft",
    shape: "polygon(50% 0%, 100% 22%, 88% 84%, 34% 100%, 0% 44%)",
    scale: 0.94,
    desc: "来自作业、复盘与顿悟的回声，只能嵌入炼器区或灵台核心，容易沉成悟理阁。",
    affinity: { reasoning: 2, boost: 1 },
  },
  calm: {
    label: "养神纹片",
    accent: "#63d3b1",
    slot: "node",
    zone: "dao",
    shape: "polygon(22% 0%, 82% 12%, 100% 56%, 74% 100%, 24% 92%, 0% 40%)",
    scale: 0.98,
    desc: "由休整、体修与情绪回稳沉出的片段，只能嵌入道法区或灵台核心，适合养神台。",
    affinity: { boost: 2, ability: 1 },
  },
  link: {
    label: "衔接纹片",
    accent: "#c3a7ff",
    slot: "edge",
    shape: "polygon(12% 46%, 28% 12%, 70% 0%, 100% 30%, 86% 82%, 44% 100%, 0% 72%)",
    scale: 1.08,
    desc: "架在已成型建筑之间，把知识脉络真正连通。",
  },
};

const MEMORY_BUILD_RULES = {
  nodeCapacity: 2,
  randomDrawsBase: 2,
  randomDrawsMax: 4,
  buildingPriority: ["ability", "reasoning", "boost"],
  recipes: [
    { id: "ability_primary", building: "ability", fragments: ["focus", "schema"], hint: "专注 + 结构" },
    { id: "ability_alt", building: "ability", fragments: ["focus", "calm"], hint: "专注 + 养神" },
    { id: "ability_dense", building: "ability", fragments: ["focus", "focus"], hint: "双专注" },
    { id: "reasoning_primary", building: "reasoning", fragments: ["schema", "echo"], hint: "结构 + 回响" },
    { id: "reasoning_alt", building: "reasoning", fragments: ["schema", "schema"], hint: "双结构" },
    { id: "reasoning_dense", building: "reasoning", fragments: ["echo", "echo"], hint: "双回响" },
    { id: "boost_primary", building: "boost", fragments: ["calm", "echo"], hint: "养神 + 回响" },
    { id: "boost_alt", building: "boost", fragments: ["calm", "calm"], hint: "双养神" },
  ],
};

Object.assign(window.GAME_DATA, {
  MEMORY_FRAGMENT_TYPES,
  MEMORY_BUILD_RULES,
});
