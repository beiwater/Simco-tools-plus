const INTERACTIVE_SELECTOR = "button, input, select, textarea, a, label, [contenteditable='true']";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function enableFloatingPanelDrag(panel, handle = panel) {
  if (!panel || !handle || handle.dataset.sctDragBound === "true") return;
  handle.dataset.sctDragBound = "true";
  handle.classList.add("sct-floating-drag-handle");

  let drag;
  const finish = (event) => {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    handle.releasePointerCapture?.(drag.pointerId);
    panel.removeAttribute("data-sct-dragging");
    drag = undefined;
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(INTERACTIVE_SELECTOR)) return;
    const rect = panel.getBoundingClientRect();
    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.transform = "none";
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    panel.setAttribute("data-sct-dragging", "true");
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    panel.style.left = `${clamp(event.clientX - drag.offsetX, margin, window.innerWidth - rect.width - margin)}px`;
    panel.style.top = `${clamp(event.clientY - drag.offsetY, margin, window.innerHeight - rect.height - margin)}px`;
  });

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

module.exports = { enableFloatingPanelDrag };
