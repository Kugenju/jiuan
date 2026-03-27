window.GAME_DATA = window.GAME_DATA || {};

const UI_TEXT = {
  common: {
    close: "关闭",
    unassigned: "未安排",
    dayBadge(day, totalDays) {
      return `第 ${day} / ${totalDays} 天`;
    },
    dayPrefix(day) {
      return `第 ${day} 天`;
    },
  },
  toolbar: {
    statsOpen: "角色状态",
    statsClose: "收起状态",
    progress: "日程进度",
    feedback: "最近反馈",
  },
  speakers: {
    survey: "问卷法阵",
    schedule: "课表法阵",
    course: "课程系统",
    routine: "日程系统",
  },
  statusLine: {
    planning(day, slotName) {
      return `第 ${day} 天自由安排中，当前选中 ${slotName}`;
    },
    resolving(day, progress, autoplay) {
      return `第 ${day} 天剧情推进中：${progress}%${autoplay ? "（自动）" : "（点击）"}`;
    },
    memory(day) {
      return `第 ${day} 夜正在建构记忆`;
    },
    summary: "第一周结算完成",
    menu: "选择入学测评原型后开始",
  },
  canvas: {
    menuTitle: "久安问道录",
    menuSubtitle: "策划案压缩成一周可玩的校园修仙养成 demo",
    menuCards: ["日程编排", "属性成长", "夜间记忆建构", "人物事件"],
    planningTitle(day) {
      return `第 ${day} 天 · 日程编排`;
    },
    planningSubtitle: "白天安排课程与活动，夜里把灵块拼进长期记忆。",
    resolvingTitle(day, activityName) {
      return `第 ${day} 天 · ${activityName}`;
    },
    resolvingSubtitle: "点击推进剧情，或开启自动播放。",
    resolvingSlot(slotName) {
      return `当前时段：${slotName}`;
    },
    memoryTitle: "夜间记忆建构",
    memorySubtitle: "先以灵台锚片解锁灰域节点，再于节点建塔，以衔接塔贯通边位。",
    summaryTitle: "第一周结算",
    summarySubtitle: "从策划案中抽出的核心循环已经跑完一周。",
    summaryBest(skillLabel, level) {
      return `最佳方向：${skillLabel} ${level} 级`;
    },
  },
  quickCards: [
    { key: "coins", hint: "日常花销与打工收入" },
    { key: "insight", hint: "课程与课业沉淀" },
    { key: "spirit", hint: "周结算评级核心" },
  ],
  infoModal: {
    memoryTitle: "灵块类型",
    memoryIntro: "夜间为六边形长期记忆区。灰域节点需先投放灵台锚片解锁，每个节点仅可建一座建筑。",
    memoryRulesTitle: "放置规则",
    memoryRulesBody:
      "灵台锚片只能用于解锁灰域节点。彩色纹片只能落在与自身颜色对应的分区，灵台核心可容纳任意彩色纹片。衔接纹片属于边位建筑，仅可架设在两端节点都已有建筑的相邻边上。",
    progressTitle: "日程进度",
    feedbackTitle: "最近反馈",
  },
  flow: {
    title: "当前进展",
    nowWhatTitle: "现在要做什么",
    menuHint: "先选入学原型，然后开始第一周。",
    planningHint(currentActivityName) {
      return `先选中一个时段，再给它安排活动。当前聚焦：${currentActivityName || "待安排"}。`;
    },
    resolvingHintAuto: "剧情正在自动播放，你也可以随时手动点击推进。",
    resolvingHintClick: "点击右侧剧情卡片或按钮，逐段推进白天流程。",
    memoryHint: "从待放置灵块里挑一块，落到满足规则的位置。",
    summaryHint: "查看本周结果，决定是否重新开始。",
    hotkeys: "快捷键：1-4 选时段，空格填入活动；白天推进阶段按空格/Enter前进，P切自动播放；F 全屏。",
    feedbackPrefix(day, slot, activity) {
      return `最近反馈：第 ${day} 天 ${slot} · ${activity}`;
    },
    feedbackEmptyPrefix: "最近反馈：还没有进行日程结算。",
    feedbackEmptyBody: "当前阶段的提示会显示在这里，帮助你注意到日程推进。",
  },
  planning: {
    resolveTitle: "白天剧情推进",
    resolveNext: "点击推进剧情",
    resolveFinish: "进入夜间构筑",
    resolveAutoOn: "自动播放：开",
    resolveAutoOff: "自动播放：关",
    resolveTip1: "同一时段内会持续追加文本；切换到下一个时段后会从头重新追加。",
    resolveTip2(progress) {
      return `自动播放开启后将按节奏自动推进。当前进度 ${progress}%。`;
    },
    resolveCurrentActivity(name) {
      return `当前时段：${name}`;
    },
    eventTitle: "自由时段安排",
    eventHelp: "先查看一周固定课表，再为今天的自由时段填入活动。",
    eventPicked(name) {
      return name ? `已安排：${name}` : "这个时段还没有安排事件。";
    },
    preparingTitle: "当前准备填入",
    scheduleTitle: "今日自由安排",
    scheduleFilled(filled, total = 0) {
      return total <= 0 ? "今天没有可自由安排的时段。" : `已填写 ${filled} / ${total} 个自由时段。`;
    },
    scheduleHint(filled, total = 0) {
      if (total <= 0) {
        return "今天只有固定课程，可以直接执行当天。";
      }
      return filled === total ? "自由时段已排满，可以直接执行当天。" : "先把今天的自由时段全部填满再执行。";
    },
    clear: "清空日程",
    execute: "执行当天",
  },
  memory: {
    stageTitle: "长期记忆区",
    stageDesc:
      "六边形节点按数术、符法、道法、炼器分区。彩色纹片只能落入对应分区，灵台核心可承接任意彩色纹片；灰域节点需先投放灵台锚片解锁，衔接纹片则架设在节点之间的边位。",
    stageSelectHint: "右栏选择一枚灵块",
    stageCurrentPiece(label) {
      return `当前灵块：${label}`;
    },
    edgeHintOccupied: "衔",
    edgeHintValid: "可",
    edgeHintDefault: "边",
    edgeAria(index) {
      return `记忆边位 ${index + 1}`;
    },
    nodeLockedTitle: "灰域节点",
    nodeUnlockedTitle: "已解锁空位",
    nodeLockedDesc: "投放灵台锚片可解锁",
    nodeEmptyDesc: "可建一座建筑",
    nodeBuiltDesc(day) {
      return `第 ${day} 天建成`;
    },
    nodeAria(index) {
      return `记忆节点 ${index + 1}`;
    },
    panelTitle: "待放置灵块",
    steps: ["步骤 1：抓起一枚灵块。", "步骤 2：拖到左侧六边节点或边位。", "步骤 3：至少放一块，再结束夜晚。"],
    tipsTitle: "当前放置提示",
    tips: [
      "右栏只保留灵块托盘和操作按钮，悬浮灵块可查看文字说明。",
      "彩色纹片只能落在对应颜色分区，灵台核心除外；衔接纹片请点击两节点之间的边位。",
    ],
    helpBtn: "查看灵块类型",
    endBtn: "结束夜晚",
    leftTitle: "夜间构筑",
    leftGoalTitle: "目标",
    leftGoals: [
      "将右侧灵块放入左侧六边形长期记忆区。",
      "先用灵台锚片解锁灰域节点，再建造术式楼/养神台/悟理阁，最后用衔接塔打通边位。",
    ],
    leftProgressTitle: "今夜进度",
    leftPlaced(count) {
      return `已放置：${count}`;
    },
    leftRemain(count) {
      return `剩余：${count}`;
    },
    placedSummary(done, total) {
      return `已放置 ${done} / ${total} 枚灵块。`;
    },
  },
  menu: {
    title: "开始之前",
    badge: "选择入学原型",
    startBtn: "开始第一周",
  },
  summary: {
    panelTitle: "本周结算",
    restartBtn: "重新开始",
    unranked: "未评级",
    resourceBalance(resourceLabel) {
      return `${resourceLabel}结余`;
    },
    bestSkill: "最佳技能",
  },
  log: {
    title: "最近反馈",
    badgeResolving: "请留意这里",
    badgeDefault: "摘要",
    emptyTimeline: "开始执行日程后，这里会用更醒目的方式回放刚刚发生的事。",
    systemTitle: "系统记录",
    latest4: "最新 4 条",
    timelineTitle(day, slot) {
      return `第 ${day} 天 · ${slot}`;
    },
    entryTitle(day, title) {
      return `${day > 0 ? `第 ${day} 天 · ` : ""}${title}`;
    },
  },
  top: {
    title: "角色状态",
    coreStatsTitle: "核心属性",
    externalStatsTitle: "外在状态",
    relationSkillTitle: "关系与技能",
  },
  left: {
    scheduleTitle: "今日时段",
    stepTitleResolving: "剧情推进中",
    stepTitlePlanning: "当前步骤",
    progressTitleResolving: "今日进度",
    progressTitlePlanning: "日程完成度",
    resolvingStep(slotName, progress) {
      return `当前来到 ${slotName}，进度 ${progress}%。`;
    },
    planningStep(slotName) {
      return `先在左侧选择自由时段，再在右侧安排活动。当前时段：${slotName}。`;
    },
    resolvingStepHintAuto: "自动播放已开启，可随时手动点击插入推进。",
    resolvingStepHintClick: "点击右侧剧情卡片或“点击推进剧情”按钮进入下一段。",
    planningStepHint(activityName, slotName) {
      return activityName ? `已安排：${activityName}` : `${slotName} 还没有安排事件。`;
    },
    resolvingProgress(done) {
      return `已完成 ${done} / 4 个时段。`;
    },
    planningProgress(filled, total = 0) {
      return total <= 0 ? "今日无自由时段。" : `已安排 ${filled} / ${total} 个自由时段。`;
    },
    resolvingProgressHint: "需要看角色状态、进度或最近反馈时，使用顶部按钮打开浮窗。",
    planningProgressHint: "下方的进度和反馈已经移出主界面，改为顶部按钮呼出。",
    summaryTitle: "本周结果",
    summaryPending: "待结算",
    resourcesTitle: "资源",
    bootTitle: "开始前",
    bootBadge: "准备阶段",
    bootFlowTitle: "流程",
    bootFlowBody: "先在右侧选择开局原型，再开始第一周。",
    bootOverlayTitle: "浮窗",
    bootOverlayBody: "角色状态、日程进度和最近反馈都从顶部工具栏打开。",
  },
  stateExport: {
    coordinateSystem: { origin: "画布左上角", x: "向右", y: "向下" },
  },
};

Object.assign(window.GAME_DATA, {
  UI_TEXT,
});
