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
    shape: "polygon(8% 8%, 92% 8%, 92% 24%, 76% 24%, 76% 76%, 92% 76%, 92% 92%, 8% 92%, 8% 76%, 24% 76%, 24% 24%, 8% 24%)",
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
    shape: "polygon(50% 0%, 100% 40%, 70% 40%, 70% 100%, 30% 100%, 30% 40%, 0% 40%)",
    scale: 0.94,
    desc: "携带一门主修方向，只能落在对应分区或灵台核心，可把碎片推成明确的修行建筑。",
    affinity: { ability: 2 },
  },
  echo: {
    label: "回响纹片",
    accent: "#ef8f85",
    slot: "node",
    zone: "craft",
    shape: "polygon(50% 0%, 61% 18%, 84% 6%, 80% 30%, 100% 50%, 80% 70%, 84% 94%, 61% 82%, 50% 100%, 39% 82%, 16% 94%, 20% 70%, 0% 50%, 20% 30%, 16% 6%, 39% 18%)",
    scale: 0.92,
    desc: "来自作业、复盘与顿悟的回声，只能嵌入炼器区或灵台核心，容易沉成悟理阁。",
    affinity: { reasoning: 2, boost: 1 },
  },
  calm: {
    label: "养神纹片",
    accent: "#63d3b1",
    slot: "node",
    zone: "dao",
    shape: "polygon(50% 2%, 72% 12%, 86% 34%, 82% 62%, 64% 86%, 50% 100%, 36% 86%, 18% 62%, 14% 34%, 28% 12%)",
    scale: 0.98,
    desc: "由休整、体修与情绪回稳沉出的片段，只能嵌入道法区或灵台核心，适合养神台。",
    affinity: { boost: 2, ability: 1 },
  },
  link: {
    label: "衔接纹片",
    accent: "#c3a7ff",
    slot: "edge",
    shape: "polygon(0% 50%, 18% 34%, 34% 34%, 50% 18%, 66% 34%, 82% 34%, 100% 50%, 82% 66%, 66% 66%, 50% 82%, 34% 66%, 18% 66%)",
    scale: 1.04,
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
