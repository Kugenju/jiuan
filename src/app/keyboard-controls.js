(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createKeyboardHandler(context) {
  return (event) => {
    const key = event.key.toLowerCase();
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "a", "b", "f", "i", "p"].includes(key) ||
      event.key === " " ||
      (context.state.mode === "planning" && /^[1-9]$/.test(event.key))
    ) {
      event.preventDefault();
    }

    if (key === "i") {
      context.toggleStatsPanel();
    }

    if (context.state.mode === "planning" && /^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < context.slotCount) {
        context.setSlot(index);
      }
    }

    if (context.state.mode === "menu") {
      if (key === "arrowleft") context.changeArchetype(-1);
      if (key === "arrowright") context.changeArchetype(1);
      if (key === "enter") {
        context.applyArchetypeIfNeeded();
        context.startRun();
      }
    }

    if (context.state.mode === "course_selection") {
      if (key === "enter") context.confirmCourseSelection();
    }

    if (context.state.mode === "planning") {
      if (key === "arrowleft") context.setSlot(context.clamp(context.state.selectedSlot - 1, 0, context.slotCount - 1));
      if (key === "arrowright") {
        context.setSlot(context.clamp(context.state.selectedSlot + 1, 0, context.slotCount - 1));
      }
      if (key === "arrowup") context.cycleSelectedActivity(-1);
      if (key === "arrowdown") context.cycleSelectedActivity(1);
      if (key === " ") context.assignActivity(context.state.selectedActivity);
    }

    if (event.key === "Enter" && context.state.mode === "planning") {
      context.startDay();
    }

    if (context.state.mode === "resolving") {
      if (key === " " || key === "enter") context.advanceResolvingFlow();
      if (key === "p") context.toggleResolvingAutoplay();
    }

    if (context.state.mode === "task") {
      if (key === "arrowleft" || key === "arrowup") context.focusTaskControl(-1);
      if (key === "arrowright" || key === "arrowdown") context.focusTaskControl(1);
      if (key === " " || key === "enter") context.activateTaskControl();
    }

    if (context.state.mode === "memory") {
      if (key === "arrowleft") context.moveMemoryCursor(-1, 0);
      if (key === "arrowright") context.moveMemoryCursor(1, 0);
      if (key === "arrowup") context.moveMemoryCursor(0, -1);
      if (key === "arrowdown") context.moveMemoryCursor(0, 1);
      if (key === "a") context.cycleMemoryPiece(-1);
      if (key === "b") context.cycleMemoryPiece(1);
      if (key === " ") context.placeMemoryPiece(context.state.memory.cursor);
      if (key === "enter") context.endNight();
    }

    if (context.state.mode === "summary" && key === "enter") {
      if (context.state.summary?.canContinue) {
        context.continueWeek();
      } else {
        context.restartGame();
      }
    }

    if (key === "f") {
      context.toggleFullscreen();
    }

    if (event.key === "Escape" && document.fullscreenElement) {
      document.exitFullscreen();
    }
  };
}

Object.assign(window.GAME_RUNTIME, {
  createKeyboardHandler,
});
})();
