window.GAME_DATA = window.GAME_DATA || {};

const RANDOM_EVENTS = [
  {
    id: "course_followup",
    title: "课后加讲",
    timing: "after",
    chance: 0.3,
    oncePerDay: false,
    condition: {
      activityKinds: ["course"],
      maxStats: { fatigue: 5 },
    },
    effect: {
      resources: { insight: 1 },
    },
    note: "先生临时补了几句关键脉络，你额外记下一条要点，悟道点 +1。",
    logBody: "课后临时加讲让你补上了关键一环。",
    story: {
      speakerKey: "course",
      title: "随机事件 · 课后加讲",
      body: "散课前，先生忽然补了一段延伸讲解，正好把你先前卡住的地方接上了。",
    },
  },
  {
    id: "cafeteria_rumor",
    title: "食堂风声",
    timing: "after",
    chance: 0.45,
    oncePerDay: true,
    condition: {
      activityIds: ["cafeteria"],
      minDay: 2,
    },
    effect: {
      resources: { insight: 1 },
      relationships: { friend: 1 },
    },
    note: "你在饭桌上听到了一条院内传闻，悟道点 +1，朋友关系 +1。",
    logBody: "食堂闲谈里夹着一条对你有用的消息。",
    story: {
      speakerKey: "routine",
      title: "随机事件 · 食堂风声",
      body: "隔壁桌的人压低声音谈起院内近况，你不动声色地把关键词全记了下来。",
    },
  },
  {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    timing: "after",
    chance: 0.4,
    oncePerDay: false,
    condition: {
      activityKinds: ["assignment"],
      minKinds: { course: 1 },
    },
    effect: {
      stats: { memory: 1 },
    },
    skillBonus: {
      source: "latestCourseSkill",
      fallbackSource: "mainFocusSkill",
      amount: 1,
      noteTemplate: "一道关键题突然想通，{skill} 额外 +{amount}。",
      fallbackNote: "虽然没有锁定具体学科，但这次顿悟依然把记忆再推高了一截。",
    },
    note: "你在作业里补全了白天漏掉的一环，记忆 +1。",
    logBody: "作业中的一次顿悟把白天的学习彻底沉淀了。",
    story: {
      speakerKey: "assignment",
      title: "随机事件 · 题解顿悟",
      body: "纸页翻到一半时，你忽然意识到几条分散的思路其实能拼成同一个答案。",
    },
  },
];

Object.assign(window.GAME_DATA, {
  RANDOM_EVENTS,
});
