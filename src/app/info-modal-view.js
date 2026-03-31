(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function renderWeeklyTimetableModalHtml(input = {}) {
  return `
    <div class="weekly-timetable-modal overlay-modal-timetable">
      <div class="panel-title">
      <h2>${input.title || ""}</h2>
      <button class="drawer-close" id="info-close-btn" type="button">${input.closeLabel || ""}</button>
      </div>
      <div class="modal-body weekly-timetable-modal weekly-timetable-modal-body">
        ${input.timetableHtml || ""}
      </div>
    </div>
  `;
}

Object.assign(window.GAME_RUNTIME, {
  renderWeeklyTimetableModalHtml,
});
})();
