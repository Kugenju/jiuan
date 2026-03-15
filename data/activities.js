window.GAME_DATA = window.GAME_DATA || {};

const ACTIVITIES = [
  {
    id: "math_class",
    name: "上数术课",
    tone: "study",
    summary: "基础理论模块，稳步提升数术与智力。",
    storySegments: [
      "讲席前的黑板已经写满了层层拆开的算式，先生不急着给答案，只让你们先辨认每一步为何成立。",
      "你跟着推了两轮，忽然发现原本看着枯燥的数术，其实正像一套稳固心神的骨架，把零散知识一点点卡进正确的位置。",
    ],
    scene: "lecture",
    skill: "math",
    preferred: [0, 2],
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
      base: "数术理解提升，记忆与悟道都有收获。",
      preferred: "这个时段更适合推演，额外获得智力与数术成长。",
    },
  },
  {
    id: "sigil_class",
    name: "上符法课",
    tone: "study",
    summary: "把符纹理解成可执行逻辑，推动符法与灵感。",
    storySegments: [
      "案上铺开的符纸还带着新晾过的纤维香气，授课先生用细笔一点点拆开符纹的起承转合。",
      "你盯着那些重复又微妙变化的线条，慢慢意识到符法并不只是临摹，而是在纸上写出一段可以被世界执行的秩序。",
    ],
    scene: "lecture",
    skill: "sigil",
    preferred: [0, 2],
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
      base: "符纹抽象能力上升，灵感与心力一并增长。",
      preferred: "在顺手的时段修习，额外获得灵感与符法成长。",
    },
  },
  {
    id: "dao_seminar",
    name: "上道法研讨",
    tone: "study",
    summary: "偏世界观与术理，对悟性、心力和道法都有帮助。",
    storySegments: [
      "经堂里今日辩的是“术在器先，还是意在术先”，几位高年弟子一句比一句锋利，听得新生们不敢轻易接话。",
      "你没有急着争辩，只把几种说法压在心里来回比较，等到课后再看时，原本混乱的念头已经隐约排出了一条线。",
    ],
    scene: "seminar",
    skill: "dao",
    preferred: [0, 3],
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
      base: "术理与世界观被重新梳理，记忆和道法都更稳。",
      preferred: "这个时段更适合沉思，额外获得心力与道法成长。",
    },
  },
  {
    id: "workshop",
    name: "去炼器工坊",
    tone: "study",
    summary: "实践技能模块，偏炼器和符法，容易疲惫但出成果。",
    storySegments: [
      "工坊的炉火一开，空气里就全是铁屑、热油和旧木架被烘出来的焦味，谁都得先学会在这种嘈杂里稳住手。",
      "你把草图和材料一一对照，失败了两次后终于让部件咬合到位，那一瞬间的成就感比任何夸奖都更直接。",
    ],
    scene: "workshop",
    skill: "craft",
    preferred: [2, 3],
    effects: {
      stats: { inspiration: 1, stamina: -1, fatigue: 2 },
      skills: { craft: 1 },
      resources: { spirit: 1 },
    },
    preferredEffects: {
      skills: { craft: 1, sigil: 1 },
    },
    notes: {
      base: "工坊实作逼着你把想法落地，也明显增加了疲惫。",
      preferred: "在合适时段进工坊，额外带动炼器与符法成长。",
    },
  },
  {
    id: "homework",
    name: "做课业",
    tone: "study",
    summary: "把当天课堂内容固化成悟道点，稳定记忆和自控。",
    storySegments: [
      "回到案前后，白天听过的内容还在脑子里互相打架，你只好一条条誊写下来，逼自己重新梳理次序。",
      "墨迹渐渐铺满纸页，原本浮在表面的印象也慢慢沉到底层，像是终于肯在心里结成能反复调用的东西。",
    ],
    scene: "desk",
    preferred: [3],
    effects: {
      stats: { memory: 1, selfControl: 1 },
      resources: { insight: 2 },
    },
    special: {
      type: "focusSkillBonus",
      amount: 1,
      noteTemplate: "课业把白天内容固化，{skill}额外 +1。",
      fallbackNote: "课业让基础认知更扎实，记忆、自控与悟道点都有提升。",
    },
  },
  {
    id: "cafeteria",
    name: "去食堂",
    tone: "life",
    summary: "恢复体力与情绪，也能在饭桌上打听消息。",
    storySegments: [
      "食堂的蒸气和人声总是一起扑过来，刚坐下时你还只想着填饱肚子，没一会儿就被隔壁桌的闲谈吸去了注意。",
      "学院里真正流动最快的从来不是课表，而是饭桌上的消息，你一边扒饭一边听，往往能捞到些课堂上没有的风向。",
    ],
    scene: "cafeteria",
    preferred: [1],
    effects: {
      stats: { stamina: 2, mood: 1, fatigue: -1 },
      resources: { coins: -2 },
      relationships: { roommate: 1 },
    },
    notes: {
      base: "热饭和闲谈让你恢复体力，也顺手经营了舍友关系。",
      preferred: "午间去食堂最有效率，恢复感更明显。",
    },
  },
  {
    id: "wash",
    name: "洗漱整备",
    tone: "life",
    summary: "提升整洁，稳住魅力与心力。",
    storySegments: [
      "你把衣袖上的灰抖净，又把桌角和床铺简单收拾了一遍，宿舍那股乱哄哄的气息总算被压下去不少。",
      "看似最不起眼的整理，反而像是在替自己重新收拢边界，等屋里顺眼起来，人的心也跟着安定了些。",
    ],
    scene: "dorm",
    preferred: [1, 3],
    effects: {
      stats: { cleanliness: 2, charisma: 1, willpower: 1 },
    },
    notes: {
      base: "整理仪容后，整洁、魅力和心力都更稳定。",
      preferred: "这个时段整备更顺手，状态维持得更久。",
    },
  },
  {
    id: "training",
    name: "去操场修炼",
    tone: "body",
    summary: "消耗体力换取更稳定的灵力与情绪。",
    storySegments: [
      "操场的石地还留着白天的热气，站桩和吐纳看似单调，可只要一个呼吸乱掉，整套节奏就会立刻散开。",
      "等汗意真正浮上来时，你反而能感觉到身体和情绪一起被拉回正轨，像有根绷紧的弦终于调到了合适的位置。",
    ],
    scene: "training",
    preferred: [2],
    effects: {
      stats: { stamina: 1, aura: 1, fatigue: 1, mood: 1 },
      relationships: { roommate: 1 },
    },
    notes: {
      base: "操场修炼抬高了身体与灵力下限，也带来一点疲劳。",
      preferred: "午后锻炼状态最好，修炼收益更顺畅。",
    },
  },
  {
    id: "game_hall",
    name: "打游戏",
    tone: "body",
    summary: "能快速回情绪，但会抬高疲惫并压低自控。",
    storySegments: [
      "街角的游戏厅总是最先亮灯，法器投影和夸张音效混在一起，仿佛能把人从学院那套规矩里暂时扯出去。",
      "你明知道这种痛快来得太快，也走得太快，可当连胜的那几秒落下来时，还是会忍不住想再多待一局。",
    ],
    scene: "arcade",
    preferred: [3],
    effects: {
      stats: { mood: 2, fatigue: 2, selfControl: -1 },
      resources: { coins: -3 },
    },
    notes: {
      base: "短期情绪恢复明显，但自控和疲惫也在波动。",
      preferred: "夜里娱乐更上头，情绪反馈更强但代价不小。",
    },
  },
  {
    id: "walk_city",
    name: "久安城闲逛",
    tone: "social",
    summary: "提升灵感和人际关系，也更容易触发剧情线索。",
    storySegments: [
      "久安城的巷口总能听见摊贩叫卖和修士议价混成一片，你顺着人流慢慢走，很容易就捡到一些不经意露出来的线索。",
      "有些消息只有离开学院围墙后才会显形，城市像一张更大的课本，翻开的每一页都写着人与事的温度。",
    ],
    scene: "city",
    preferred: [1, 2],
    effects: {
      stats: { inspiration: 1, mood: 1 },
      resources: { coins: -1 },
      relationships: { friend: 1 },
    },
    notes: {
      base: "在久安城的街巷里搜集见闻，灵感和朋友线索都在增长。",
      preferred: "这个时段出门更容易遇见人和事。",
    },
  },
  {
    id: "part_time",
    name: "去打工",
    tone: "social",
    summary: "赚灵石，但会增加疲惫，适合资源紧张时兜底。",
    storySegments: [
      "柜台后的账册压得厚重，跑腿、清点、记账都不算难，难的是在别人催促时依然不出差错。",
      "你知道这份辛苦换来的并不只是灵石，还有一种更现实的提醒：在学院之外，很多人连犯错的余裕都没有。",
    ],
    scene: "job",
    preferred: [1, 2],
    effects: {
      resources: { coins: 6 },
      stats: { fatigue: 2, selfControl: 1 },
      relationships: { counselor: 1 },
    },
    notes: {
      base: "打工赚到一笔灵石，但疲惫也明显抬高了。",
      preferred: "这个时段更容易接到合适的活，收益感更强。",
    },
  },
];

Object.assign(window.GAME_DATA, {
  ACTIVITIES,
});
