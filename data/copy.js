window.GAME_DATA = window.GAME_DATA || {};

const COPY = {
  initialStory: {
    title: "久安入学通知",
    body: "战乱后的第二个春天，你在久安城外看见太学院重新开门。想进道院，先从这里读起。",
    speaker: "旁白",
  },
  introLog: {
    title: "策划解读",
    body: "本 demo 聚焦一周养成：日程编排、属性成长、夜间记忆构筑、人物事件和周结算。",
  },
  runStartStory: {
    title: "太学院开学周",
    body: "先在久安站稳脚跟。先排好一周固定课程，再安排每天六个关键时段，白天收拢悟道点，晚上把灵块拼进长期记忆。",
    speaker: "教习司",
  },
  runStartLog: {
    title: "入学完成",
    body: "你进入太学院第一周。课程、工坊、社交与修行都要自己安排。",
  },
  weekStartStory(week) {
    return {
      title: `第 ${week} 周开始`,
      body: "课表沿用上周安排，本周只考验你如何分配自由时段，以及极端策略还能撑多久。",
      speaker: "教习司",
    };
  },
  incompleteSchedule: {
    title: "日程未满",
    body: "今天的可自由安排时段还没有填满。固定课程会自动带入，其余时段仍需你手动安排。",
    speaker: "教习司",
  },
  memoryPendingSummary: "夜间灵块尚未生成。",
  archetypeChosen(name, summary) {
    return {
      title: "入学测评完成",
      body: `你决定以“${name}”的方式开始这七天。${summary}`,
    };
  },
  dayStart(day) {
    return {
      title: `第 ${day} 天开始`,
      body: "日程开始运转。每经过一个时段，系统会结算属性、技能与人物事件。",
      speaker: "课表法阵",
    };
  },
  dayFlowOpening(day) {
    return `第 ${day} 天的课铃响起，你按着排好的时段逐步推进今日计划。`;
  },
  dayFlowLead(slotName, activityName) {
    return `【${slotName}】你前往「${activityName}」，准备开始这一段安排。`;
  },
  dayFlowLeadTitle(slotName) {
    return `${slotName} · 起段`;
  },
  dayFlowSegmentTitle(slotName, index, total) {
    return `${slotName} · 剧情 ${index + 1}/${total}`;
  },
  dayFlowPlaceholder(slotName, activityName) {
    return `【${slotName}】关于「${activityName}」的细化剧情暂未补全，这里先用占位文案承接流程。`;
  },
  dayFlowResult(slotName, activityName, notes) {
    return {
      title: `${slotName} · ${activityName} · 结算`,
      body: notes?.trim()
        ? `【${slotName}】「${activityName}」阶段结算完成。（结算回响：${notes.trim()}）`
        : `【${slotName}】「${activityName}」阶段结算完成。`,
    };
  },
  dayFlowOutro(slotName) {
    return `【${slotName}】这一段告一段落，你准备切入下一个时段。`;
  },
  dayFlowOutroTitle(slotName) {
    return `${slotName} · 收束`;
  },
  dayModifierApplied(title) {
    return `状态「${title}」生效。`;
  },
  dayModifierLog(day, modifier) {
    return {
      title: `第 ${day} 天状态`,
      body: `${modifier.title}：${modifier.body}`,
    };
  },
  dayEndLog: {
    title: "白天结束",
    body: "所有时段结算完毕，准备进入夜间记忆构筑。",
  },
  memoryStart(pieceCount) {
    return {
      title: "夜间记忆构筑",
      body: "把今天积累的灵块塞进长期记忆。灰域节点要先用灵台锚片解锁，彩色纹片只能落到对应分区或灵台核心，衔接纹片专门架在节点之间的边位上。",
      speaker: "记忆系统",
      summary: `今晚生成 ${pieceCount} 枚灵块。`,
    };
  },
  invalidPlacement(typeLabel) {
    return {
      title: "无法落子",
      body: `${typeLabel}不满足摆放规则。请确认节点是否已解锁、分区颜色是否匹配，或该位置是否属于可连接边位。`,
      speaker: "记忆系统",
    };
  },
  emptyNightFinish: {
    title: "夜修未完成",
    body: "至少放置一枚灵块再结束夜晚，否则这一天的知识没有沉淀下来。",
    speaker: "记忆系统",
  },
  nightLog(day, body) {
    return {
      title: `第 ${day} 夜`,
      body,
    };
  },
  nightSummary(day, body) {
    return {
      title: `第 ${day} 夜结算`,
      body,
      speaker: "记忆系统",
    };
  },
  nightEffects: {
    baseUnlock: "灵台锚片点亮了一处灰域节点。",
    abilityBoost(skillLabel) {
      return `术式楼将 ${skillLabel} 的修行又推进了一重。`;
    },
    boostRecover: "养神台安抚心神，化去了一段疲惫。",
    reasoningBreakthrough: "悟理阁让白日疑题在夜里豁然贯通。",
    bridgeLink: "衔接塔在两座建筑之间牵起了知识脉络。",
    resonance(count) {
      return `术式楼与悟理阁经由衔接塔共鸣 ${count} 次，额外凝成 ${count} 点灵力。`;
    },
  },
  summary: {
    defaultMajorBeat: "这一周你仍在铺垫人脉和学业。",
    clueMajorBeat: "你又向失踪舍友的线索推进了一步。",
    title(week) {
      return `第 ${week} 周结算`;
    },
    body(rank, bestSkillLabel, payload = {}) {
      const routeLabels = {
        study: "课业",
        work: "打工",
        training: "修炼",
        balanced: "均衡",
      };
      const routeLabel = routeLabels[payload.dominantRoute] || "均衡";
      const routeText =
        payload.dominantRoute === "balanced"
          ? "本周自由时段走的是均衡路线。"
          : `本周自由时段主路线偏向${routeLabel}。`;
      return `你以 ${rank} 的评定结束了第 ${payload.week || 1} 周。当前最强项是 ${bestSkillLabel}。${routeText}`;
    },
    speaker: "太学院",
    logTitle(week) {
      return `第 ${week} 周结算`;
    },
  },
};

Object.assign(window.GAME_DATA, {
  COPY,
});
