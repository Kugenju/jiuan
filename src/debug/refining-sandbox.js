(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const DEBUG_STAGE_LAYOUT = {
  boardOrigin: { x: 56, y: 168 },
  cardSize: { width: 126, height: 92 },
  cardGap: { x: 18, y: 18 },
  triangleSlots: [
    { x: 650, y: 186, width: 136, height: 86 },
    { x: 566, y: 336, width: 136, height: 86 },
    { x: 734, y: 336, width: 136, height: 86 },
  ],
};

const PRESET_LABELS = {
  success_basic: "稳定成功",
  failure_basic: "稳定失败",
  guanxing_demo: "观星案例",
  lingduan_demo: "灵锻案例",
};

function createSeededRng(seed = 1) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toSeedNumber(seed) {
  const value = Number(seed);
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(Math.abs(value)));
}

function getCardLabel(type) {
  const meta = window.GAME_DATA?.REFINING_CARD_TYPES?.[type];
  return meta?.label || type || "";
}

function getRequirementText(taskDef) {
  const requirements = Object.entries(taskDef?.objective?.materialRequirements || {});
  return requirements.map(([type, count]) => `${count} x ${getCardLabel(type)}`).join(" / ");
}

function formatRecipeKey(recipeKey) {
  if (!recipeKey) {
    return "未结算";
  }
  return recipeKey
    .split("|")
    .filter(Boolean)
    .map((type) => getCardLabel(type))
    .join(" + ");
}

function createPresetAttempt(taskDef, types) {
  const runtime = window.GAME_RUNTIME || {};
  const attempt = runtime.createRefiningAttemptState(taskDef, () => 0);
  attempt.deck = (types || []).map((type, index) => ({
    id: `card-${index}`,
    type,
    revealed: false,
    used: false,
  }));
  attempt.slots = [null, null, null];
  attempt.revealsRemaining = 3;
  attempt.selectedCardId = null;
  attempt.result = null;
  return attempt;
}

function createRefiningSandboxController({ taskDef, presets }) {
  const runtime = window.GAME_RUNTIME || {};
  let activeRng = createSeededRng(1);

  function isTerminalStatus(status) {
    return status === "success" || status === "failure";
  }

  function createSession(seed, presetId = null) {
    activeRng = createSeededRng(seed);
    const session = runtime.createRefiningSessionState(taskDef, activeRng);
    if (presetId) {
      session.attempt = createPresetAttempt(taskDef, presets?.[presetId] || []);
    }
    return session;
  }

  let sandboxState = {
    seed: 1,
    presetId: null,
    session: createSession(1),
    result: null,
    status: "idle",
  };

  function clearResult() {
    sandboxState.result = null;
    if (sandboxState.session?.attempt) {
      sandboxState.session.attempt.result = null;
    }
  }

  return {
    restartFromSeed(seed) {
      const nextSeed = toSeedNumber(seed);
      sandboxState = {
        seed: nextSeed,
        presetId: null,
        session: createSession(nextSeed),
        result: null,
        status: "idle",
      };
      return sandboxState.session.attempt;
    },
    restartFromPreset(presetId) {
      sandboxState = {
        seed: sandboxState.seed,
        presetId,
        session: createSession(sandboxState.seed, presetId),
        result: null,
        status: "idle",
      };
      return sandboxState.session.attempt;
    },
    revealOrSelectCard(cardId) {
      if (isTerminalStatus(sandboxState.status)) {
        return false;
      }
      const attempt = sandboxState.session?.attempt;
      if (!attempt) {
        return false;
      }
      const card = attempt.deck.find((item) => item.id === cardId);
      if (!card || card.used) {
        return false;
      }
      if (!card.revealed) {
        const revealed = window.GAME_RUNTIME.revealRefiningCard(attempt, cardId);
        if (revealed) {
          attempt.selectedCardId = null;
          clearResult();
        }
        return revealed;
      }
      attempt.selectedCardId = attempt.selectedCardId === cardId ? null : cardId;
      clearResult();
      return true;
    },
    placeSelectedCard(slotIndex) {
      if (isTerminalStatus(sandboxState.status)) {
        return false;
      }
      const attempt = sandboxState.session?.attempt;
      if (!attempt?.selectedCardId) {
        return false;
      }
      const placed = window.GAME_RUNTIME.placeRefiningCardInSlot(attempt, attempt.selectedCardId, slotIndex);
      if (!placed) {
        return false;
      }
      attempt.selectedCardId = null;
      clearResult();
      return true;
    },
    resolveCurrentAttempt() {
      if (isTerminalStatus(sandboxState.status)) {
        return {
          status: sandboxState.status,
          session: sandboxState.session,
          result: sandboxState.result,
        };
      }
      const attempt = sandboxState.session?.attempt;
      if (!attempt) {
        return { status: sandboxState.status || "idle", session: sandboxState.session, result: sandboxState.result };
      }
      const result = runtime.resolveRefiningAttempt(attempt, taskDef);
      const outcome = runtime.settleRefiningSession(sandboxState.session, result, taskDef, activeRng);
      sandboxState.session = outcome.session;
      sandboxState.result = result;
      sandboxState.status = outcome.status;
      return {
        ...outcome,
        result,
      };
    },
    getState() {
      return sandboxState;
    },
  };
}

function renderSandboxHtml(state, taskDef, presetEntries) {
  const session = state.session || {};
  const attempt = session.attempt || {};
  const selectedCard = attempt.deck?.find((card) => card.id === attempt.selectedCardId) || null;
  const result = state.result;
  const isTerminal = state.status === "success" || state.status === "failure";
  const roundHistoryHtml = (session.roundResults || [])
    .map(
      (entry) => `
        <div class="task-slot-summary filled">
          <strong>R${entry.roundIndex || 1}</strong>
          <small>积分 ${entry.score || 0}</small>
        </div>
      `
    )
    .join("");
  const presetButtons = presetEntries
    .map(
      ([presetId]) => `
        <button class="ghost-button ${state.presetId === presetId ? "primary" : ""}" data-preset="${presetId}" type="button">
          ${PRESET_LABELS[presetId] || presetId}
        </button>
      `
    )
    .join("");

  return `
    <main class="debug-refining-shell">
      <section class="panel-card debug-refining-stage">
        <div class="panel-title">
          <h2>炼器独立调试</h2>
          <span class="badge">${state.presetId ? PRESET_LABELS[state.presetId] || state.presetId : "随机牌堆"}</span>
        </div>
        <canvas id="debug-refining-canvas" width="960" height="540"></canvas>
      </section>
      <aside class="panel-card debug-refining-panel">
        <div class="panel-title">
          <h2>${taskDef?.objective?.name || "炼器委托"}</h2>
          <span class="badge">目标 ${taskDef?.objective?.scoreTarget || 0} 分</span>
        </div>
        <div class="story-card focus-callout">
          <strong>Seed</strong>
          <div class="debug-seed-row">
            <input id="debug-seed-input" type="number" min="1" step="1" value="${state.seed}" />
            <button class="ghost-button primary" id="debug-seed-restart-btn" type="button">按 Seed 重开</button>
          </div>
          <small>${state.presetId ? "当前正在使用预设牌堆。" : "当前为随机洗牌结果。"}</small>
        </div>
        <div class="story-card">
          <strong>预设牌堆</strong>
          <div class="debug-preset-grid">${presetButtons}</div>
        </div>
        <div class="story-card">
          <strong>轮次进度</strong>
          <small>${session.roundIndex || 1} / ${session.maxRounds || 1}</small>
          <small>累计积分：${session.totalScore || 0}</small>
        </div>
        ${roundHistoryHtml ? `<div class="task-slot-summary-grid">${roundHistoryHtml}</div>` : ""}
        <div class="story-card">
          <strong>当前状态</strong>
          <small>剩余翻牌次数：${attempt.revealsRemaining ?? 0}</small>
          <small>当前选中：${selectedCard ? getCardLabel(selectedCard.type) : "无"}</small>
          <small>材料要求：${getRequirementText(taskDef) || "无"}</small>
        </div>
        <div class="story-card">
          <strong>结算结果</strong>
          <small>${result ? `得分 ${result.score}` : "尚未结算"}</small>
          <small>${result ? formatRecipeKey(result.recipeKey) : "等待放满三张后结算"}</small>
          <small>${result ? (state.status === "continue" ? "进入下一轮" : result.success ? "成功" : "失败") : "点击结算查看结果"}</small>
        </div>
        <div class="action-row">
          <button class="primary" id="debug-confirm-btn" type="button" ${isTerminal ? "disabled" : ""}>结算</button>
        </div>
      </aside>
    </main>
  `;
}

function drawSandboxScene(canvas, state, taskDef) {
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  const session = state.session || {};
  const attempt = session.attempt || {};
  const view = window.GAME_RUNTIME.buildRefiningStageView(attempt, DEBUG_STAGE_LAYOUT);

  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#1a130e");
  background.addColorStop(1, "#0c1624");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(40, 134, 454, 360);
  ctx.strokeStyle = "rgba(137,187,255,0.32)";
  ctx.strokeRect(40, 134, 454, 360);
  ctx.fillStyle = "#edf4ff";
  ctx.font = "22px 'Microsoft YaHei'";
  ctx.fillText("翻牌与选牌", 56, 166);
  ctx.fillStyle = "#9ab1c8";
  ctx.font = "14px 'Microsoft YaHei'";
  ctx.fillText("左侧点击卡牌翻开或选中，右侧点击槽位放入", 56, 194);
  ctx.fillText(`当前 ${session.roundIndex || 1}/${session.maxRounds || 1} 轮  累计积分 ${session.totalScore || 0}`, 56, 216);

  view.cards.forEach((card) => {
    ctx.fillStyle = card.isUsed
      ? "rgba(99,211,177,0.18)"
      : card.revealed
        ? "rgba(137,187,255,0.18)"
        : "rgba(255,255,255,0.08)";
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.strokeStyle = card.isSelected ? "#f0c36c" : card.isUsed ? "rgba(99,211,177,0.54)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = card.isSelected ? 3 : 1.5;
    ctx.strokeRect(card.x, card.y, card.width, card.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#edf4ff";
    ctx.font = card.revealed ? "18px 'Microsoft YaHei'" : "30px 'Microsoft YaHei'";
    ctx.fillText(card.revealed ? getCardLabel(card.type) : "?", card.x + card.width / 2, card.y + 40);
    ctx.fillStyle = card.isUsed ? "#63d3b1" : card.revealed ? "#b6c9df" : "#9ab1c8";
    ctx.font = "12px 'Microsoft YaHei'";
    ctx.fillText(card.isUsed ? "已放置" : card.revealed ? "再次点击选中" : "点击翻开", card.x + card.width / 2, card.y + 68);
    ctx.textAlign = "left";
  });

  const slotCenters = view.slots.map((slot) => ({
    x: slot.x + slot.width / 2,
    y: slot.y + slot.height / 2,
  }));
  if (slotCenters.length === 3) {
    ctx.strokeStyle = "rgba(240,195,108,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(slotCenters[0].x, slotCenters[0].y);
    ctx.lineTo(slotCenters[1].x, slotCenters[1].y);
    ctx.lineTo(slotCenters[2].x, slotCenters[2].y);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(528, 134, 360, 360);
  ctx.strokeStyle = "rgba(240,195,108,0.28)";
  ctx.strokeRect(528, 134, 360, 360);
  ctx.fillStyle = "#f0c36c";
  ctx.font = "22px 'Microsoft YaHei'";
  ctx.fillText("三角牌阵", 548, 166);
  ctx.fillStyle = "#edf4ff";
  ctx.font = "18px 'Microsoft YaHei'";
  ctx.fillText(taskDef?.objective?.name || "炼器委托", 548, 198);
  ctx.fillStyle = "#9ab1c8";
  ctx.font = "14px 'Microsoft YaHei'";
  ctx.fillText(getRequirementText(taskDef) || "无材料要求", 548, 226);

  view.slots.forEach((slot) => {
    const cardLabel = slot.cardId ? getCardLabel(attempt.deck.find((card) => card.id === slot.cardId)?.type) : null;
    ctx.fillStyle = slot.cardId ? "rgba(99,211,177,0.24)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
    ctx.strokeStyle = slot.cardId ? "rgba(99,211,177,0.6)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
    ctx.fillStyle = "#edf4ff";
    ctx.font = "14px 'Microsoft YaHei'";
    ctx.fillText(`槽位 ${slot.index + 1}`, slot.x + 16, slot.y + 26);
    ctx.font = "18px 'Microsoft YaHei'";
    ctx.fillText(cardLabel || "待放置", slot.x + 16, slot.y + 56);
  });

  ctx.fillStyle = "rgba(8,18,29,0.68)";
  ctx.fillRect(548, 444, 312, 30);
  ctx.fillStyle = "#edf4ff";
  ctx.font = "14px 'Microsoft YaHei'";
  const selectedCard = attempt.deck?.find((card) => card.id === attempt.selectedCardId) || null;
  ctx.fillText(selectedCard ? `当前选中：${getCardLabel(selectedCard.type)}` : "点击左侧卡牌开始操作", 560, 464);
}

function mountRefiningSandbox(root, options = {}) {
  if (!root) {
    return null;
  }

  const taskDef = options.taskDef || window.GAME_DATA?.TASK_DEFS?.artifact_refining;
  const presets = options.presets || window.GAME_RUNTIME.createRefiningPresetDecks();
  const presetEntries = Object.entries(presets);
  const controller = createRefiningSandboxController({ taskDef, presets });
  controller.restartFromSeed(options.seed || Math.floor(Math.random() * 100000) + 1);

  function render() {
    const state = controller.getState();
    root.innerHTML = renderSandboxHtml(state, taskDef, presetEntries);
    const canvas = root.querySelector("#debug-refining-canvas");
    drawSandboxScene(canvas, state, taskDef);

    root.querySelector("#debug-seed-restart-btn")?.addEventListener("click", () => {
      const seedInput = root.querySelector("#debug-seed-input");
      controller.restartFromSeed(seedInput?.value || state.seed);
      render();
    });
    root.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        controller.restartFromPreset(button.dataset.preset);
        render();
      });
    });
    root.querySelector("#debug-confirm-btn")?.addEventListener("click", () => {
      controller.resolveCurrentAttempt();
      render();
    });
    canvas?.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      const view = window.GAME_RUNTIME.buildRefiningStageView(controller.getState().session?.attempt, DEBUG_STAGE_LAYOUT);
      const target = window.GAME_RUNTIME.hitTestRefiningStage(view, x, y);
      if (!target) {
        return;
      }
      if (target.kind === "card") {
        controller.revealOrSelectCard(target.id);
      } else if (target.kind === "slot") {
        controller.placeSelectedCard(target.index);
      }
      render();
    });
  }

  render();
  return {
    controller,
    render,
  };
}

if (typeof document !== "undefined" && typeof document.querySelector === "function") {
  const root = document.querySelector("#refining-debug-app");
  if (root) {
    mountRefiningSandbox(root);
  }
}

Object.assign(window.GAME_RUNTIME, {
  createSeededRng,
  createRefiningSandboxController,
  mountRefiningSandbox,
});
})();
