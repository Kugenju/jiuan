window.GAME_DATA = window.GAME_DATA || {};

const ACTIVITIES = [
  {
    id: "math_class",
    name: "上数术课",
    tone: "study",
    kind: "course",
    summary: "用推演和拆解稳步提升数术、智力与记忆。",
    storySegments: [
      "黑板上的算式层层展开，先生没有直接给答案，而是逼着整堂课都从前提往下推。",
      "当你把几个关键步骤连起来时，原本生硬的公式忽然变成了可以反复调动的工具。",
    ],
    scene: "lecture",
    skill: "math",
    preferred: [1, 3],
    effects: {
      stats: { intelligence: 1, memory: 1 },
      skills: { math: 1 },
      resources: { insight: 1 },
    },
    preferredEffects: {
      stats: { intelligence: 1 },
      skills: { math: 1 },
    },
    notes: {
      base: "数术理解更稳了，记忆与悟道点同步增长。",
      preferred: "这个时段的推演效率更高，额外获得智力与数术成长。",
    },
  },
  {
    id: "sigil_class",
    name: "上符法课",
    tone: "study",
    kind: "course",
    summary: "把符纹当作可执行逻辑，推进符法、灵感和心力。",
    storySegments: [
      "符纸铺开后，授课先生只讲起承转合的规律，让你们自己补完剩下的变化。",
      "你盯着那些重复又细微变形的线条，慢慢意识到符法本质上是写给世界执行的程序。",
    ],
    scene: "lecture",
    skill: "sigil",
    preferred: [1, 3],
    effects: {
      stats: { inspiration: 1, willpower: 1 },
      skills: { sigil: 1 },
      resources: { insight: 1 },
    },
    preferredEffects: {
      stats: { inspiration: 1 },
      skills: { sigil: 1 },
    },
    notes: {
      base: "符纹抽象能力上升，灵感与心力一起增长。",
      preferred: "状态顺手时修习符法，额外获得灵感与符法成长。",
    },
  },
  {
    id: "dao_seminar",
    name: "上道法研讨",
    tone: "study",
    kind: "course",
    summary: "偏世界观与术理，稳步提升道法、记忆与心力。",
    storySegments: [
      "经堂里今天辩的是术在器先还是意在术先，高年级弟子一句比一句锋利。",
      "你没有急着接话，只把不同说法压进心里来回比较，课后再看时脉络已经清楚了不少。",
    ],
    scene: "seminar",
    skill: "dao",
    preferred: [1, 4],
    effects: {
      stats: { willpower: 1, memory: 1 },
      skills: { dao: 1 },
      resources: { insight: 1 },
    },
    preferredEffects: {
      stats: { willpower: 1 },
      skills: { dao: 1 },
    },
    notes: {
      base: "术理与世界观被重新梳理，记忆和道法都更扎实。",
      preferred: "这个时段更适合沉思，额外获得心力与道法成长。",
    },
  },
  {
    id: "workshop",
    name: "去炼器工坊",
    tone: "study",
    kind: "course",
    summary: "偏实作的课程模块，产出高，但也更消耗体力。",
    storySegments: [
      "工坊的火一开，空气里全是金铁与热油的味道，谁都得先学会在嘈杂里稳住手。",
      "你把草图和材料一一对照，失败几次后终于让部件咬合到位，那一刻的成就感相当直接。",
    ],
    scene: "workshop",
    skill: "craft",
    preferred: [3, 4],
    effects: {
      stats: { inspiration: 1, stamina: -1, fatigue: 2 },
      skills: { craft: 1 },
      resources: { spirit: 1 },
    },
    preferredEffects: {
      skills: { craft: 1, sigil: 1 },
    },
    notes: {
      base: "工坊实作逼着你把想法落地，也明显拉高了疲惫。",
      preferred: "在合适时段进工坊，额外带动炼器与符法成长。",
    },
  },
  {
    id: "homework",
    name: "做课业",
    tone: "study",
    kind: "assignment",
    summary: "把白天课程沉淀成可调用的成果，稳住记忆、自控与悟道点。",
    storySegments: [
      "回到桌前后，白天听过的内容还在脑子里相互打架，你只能一条条誊写下来重新梳理。",
      "等墨迹铺满纸页，浮在表面的印象才慢慢沉到底层，变成下次还能调出来的东西。",
    ],
    scene: "desk",
    preferred: [4, 5],
    effects: {
      stats: { memory: 1, selfControl: 1 },
      resources: { insight: 2 },
    },
    preferredEffects: {
      stats: { memory: 1 },
    },
    assignment: {
      skillSource: "latestCourseSkill",
      fallbackSkillSource: "mainFocusSkill",
      amount: 1,
      noteTemplate: "课业把白天内容固化下来，{skill} 额外 +{amount}。",
      fallbackNote: "虽然今天没有明确主课，但课业依然让理解更加扎实。",
    },
    notes: {
      base: "课业让当天知识真正沉淀下来。",
      preferred: "傍晚和夜修更适合收束课程内容，记忆提升更稳定。",
    },
  },
  {
    id: "cafeteria",
    name: "去食堂",
    tone: "life",
    kind: "routine",
    summary: "恢复体力与情绪，也常常能在饭桌上听到新消息。",
    storySegments: [
      "食堂的蒸汽和人声总是一股脑涌上来，你刚坐下就被隔壁桌的闲谈吸走了注意力。",
      "学院里流动得最快的从来不是课表，而是饭桌上的消息。",
    ],
    scene: "cafeteria",
    preferred: [2, 4],
    effects: {
      stats: { stamina: 2, mood: 1, fatigue: -1 },
      resources: { coins: -2 },
      relationships: { roommate: 1 },
    },
    notes: {
      base: "热饭和闲聊让你恢复了体力，也顺手经营了舍友关系。",
      preferred: "在饭点去食堂最有效率，恢复感更明显。",
    },
  },
  {
    id: "wash",
    name: "洗漱整备",
    tone: "life",
    kind: "routine",
    summary: "提升整洁，稳住魅力、心力和下一段节奏。",
    storySegments: [
      "你把衣袍上的灰抖净，又顺手整理了桌角和床铺，宿舍那股乱糟糟的气息总算压下去一些。",
      "看似最不起眼的整理，反而像是在替自己重新收拢边界。",
    ],
    scene: "dorm",
    preferred: [0, 5],
    effects: {
      stats: { cleanliness: 2, charisma: 1, willpower: 1 },
    },
    notes: {
      base: "整备之后，整洁、魅力和心力都更稳定了。",
      preferred: "在起始或收束时段整备，状态维持得更久。",
    },
  },
  {
    id: "training",
    name: "去操场修炼",
    tone: "body",
    kind: "routine",
    summary: "消耗身体换取更稳的灵力、情绪与训练节奏。",
    storySegments: [
      "操场的地面还留着白天的热气，站桩和吐纳看似单调，但一点节奏乱了就会立刻散掉。",
      "等汗意真正浮上来时，身体和情绪反而一起被拉回了正轨。",
    ],
    scene: "training",
    preferred: [3, 4],
    effects: {
      stats: { stamina: 1, aura: 1, fatigue: 1, mood: 1 },
      relationships: { roommate: 1 },
    },
    notes: {
      base: "操场修炼抬高了身体与灵力下限，也带来一点疲劳。",
      preferred: "午后到傍晚训练状态最好，收益更顺畅。",
    },
  },
  {
    id: "game_hall",
    name: "打游戏",
    tone: "body",
    kind: "routine",
    summary: "能快速回情绪，但也会明显抬高疲惫并压低自控。",
    storySegments: [
      "街角的游戏厅总是最先亮灯，投影和夸张音效混在一起，像是把人短暂拽离学院秩序。",
      "你明知这种痛快来得太快也走得太快，可连胜落下时还是忍不住想再待一局。",
    ],
    scene: "arcade",
    preferred: [4, 5],
    effects: {
      stats: { mood: 2, fatigue: 2, selfControl: -1 },
      resources: { coins: -3 },
    },
    notes: {
      base: "短期情绪恢复明显，但自控和疲惫也在波动。",
      preferred: "夜里娱乐更上头，情绪反馈更强但代价也更高。",
    },
  },
  {
    id: "walk_city",
    name: "久安城闲逛",
    tone: "social",
    kind: "routine",
    summary: "提升灵感和人际线索，也更容易撞上可继续扩展的剧情钩子。",
    storySegments: [
      "久安城的巷口总能听见摊贩叫卖和修士议价混成一片，慢慢走总会捡到些课堂外的线索。",
      "离开学院围墙后，城市像一本更大的课本，每一页都写着人与事的温度。",
    ],
    scene: "city",
    preferred: [2, 4],
    effects: {
      stats: { inspiration: 1, mood: 1 },
      resources: { coins: -1 },
      relationships: { friend: 1 },
    },
    notes: {
      base: "在久安城搜集见闻，灵感和朋友线索都在增长。",
      preferred: "这个时段出门更容易遇见人和事。",
    },
  },
  {
    id: "part_time",
    name: "去打工",
    tone: "social",
    kind: "routine",
    summary: "赚灵石，但会抬高疲惫，适合资源紧张时兜底。",
    storySegments: [
      "柜台后的账册压得厚重，跑腿、清点、记账都不难，难的是在催促里依然不出错。",
      "这份辛苦换来的不只是灵石，也是一种更现实的提醒。",
    ],
    scene: "job",
    preferred: [2, 4],
    effects: {
      resources: { coins: 6 },
      stats: { fatigue: 2, selfControl: 1 },
      relationships: { counselor: 1 },
    },
    notes: {
      base: "打工赚到了一笔灵石，但疲惫也明显抬高了。",
      preferred: "这个时段更容易接到合适的活，收益感更强。",
    },
  },
];

Object.assign(window.GAME_DATA, {
  ACTIVITIES,
});
