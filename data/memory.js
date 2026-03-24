window.GAME_DATA = window.GAME_DATA || {};

const MEMORY_FRAGMENT_TYPES = {
  anchor: {
    label: "灵台锚片",
    accent: "#f0c36c",
    slot: "locked-node",
    desc: "点亮灰域节点，让长期记忆有地方落脚。",
  },
  schema: {
    label: "结构纹片",
    accent: "#7fc8ff",
    slot: "node",
    desc: "来自课程梳理出的知识骨架，适合定型为术式楼或悟理阁。",
    affinity: { ability: 1, reasoning: 1 },
  },
  focus: {
    label: "专注纹片",
    accent: "#89bbff",
    slot: "node",
    desc: "携带一门主修方向，可把碎片推成明确的修行建筑。",
    affinity: { ability: 2 },
  },
  echo: {
    label: "回响纹片",
    accent: "#ef8f85",
    slot: "node",
    desc: "来自作业、复盘与顿悟的回声，容易沉成悟理阁。",
    affinity: { reasoning: 2, boost: 1 },
  },
  calm: {
    label: "养神纹片",
    accent: "#63d3b1",
    slot: "node",
    desc: "由休整、体修与情绪回稳沉出的片段，适合养神台。",
    affinity: { boost: 2, ability: 1 },
  },
  link: {
    label: "衔接纹片",
    accent: "#c3a7ff",
    slot: "edge",
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
