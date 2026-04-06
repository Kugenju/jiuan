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
    prompt: {
      speakerKey: "course",
      title: "随机事件 · 课后加讲",
      body: "散课前，先生忽然补了一段延伸讲解，正好把你先前卡住的地方接上了。",
    },
    logBody: "课后临时加讲让你补上了关键一环。",
    choices: [
      {
        id: "note",
        label: "记下补充笔记",
        note: "先生临时补了几句关键脉络，你额外记下一条要点。",
        rewardTemplate: "insight_small",
      },
      {
        id: "ask",
        label: "追问关键细节",
        note: "你趁机追问了细节，把关键环节记得更清楚。",
        rewardTemplate: "insight_small",
      },
    ],
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
    prompt: {
      speakerKey: "routine",
      title: "随机事件 · 食堂风声",
      body: "隔壁桌的人压低声音谈起院内近况，你不动声色地把关键词全记了下来。",
    },
    logBody: "食堂闲谈里夹着一条对你有用的消息。",
    choices: [
      {
        id: "chat",
        label: "顺势攀谈",
        note: "你在饭桌上听到了一条院内传闻，还顺势多聊了几句。",
        rewardTemplate: "insight_friend",
      },
      {
        id: "listen",
        label: "默默记下",
        note: "你把关键词记在心里，准备晚些时候再整理。",
        rewardTemplate: "insight_small",
      },
    ],
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
    prompt: {
      speakerKey: "assignment",
      title: "随机事件 · 题解顿悟",
      body: "纸页翻到一半时，你忽然意识到几条分散的思路其实能拼成同一个答案。",
    },
    logBody: "作业中的一次顿悟把白天的学习彻底沉淀了。",
    choices: [
      {
        id: "push",
        label: "顺势推演",
        effect: {
          stats: { memory: 1 },
        },
        effectSummary: "记忆+1",
        skillBonus: {
          source: "latestCourseSkill",
          fallbackSource: "mainFocusSkill",
          amount: 1,
          noteTemplate: "一道关键题突然想通，{skill} 额外 +{amount}。",
          fallbackNote: "虽然没有锁定具体学科，但这次顿悟依然把记忆再推高了一截。",
        },
      },
      {
        id: "hold",
        label: "先整理笔记",
        note: "你把关键线索整理成笔记，准备明天再推演。",
        rewardTemplate: "memory_small",
      },
    ],
  },
];

Object.assign(window.GAME_DATA, {
  RANDOM_EVENTS,
});
