const SLOT_GROUPS = Object.freeze([
  { title: "高管", slots: [{ id: "o", label: "COO" }, { id: "f", label: "CFO" }, { id: "m", label: "CMO" }, { id: "t", label: "CTO" }] },
  { title: "学徒", slots: [{ id: "v", label: "COO 学徒" }, { id: "x", label: "CFO 学徒" }, { id: "y", label: "CMO 学徒" }, { id: "z", label: "CTO 学徒" }] },
  { title: "职员", slots: [{ id: "1", label: "职员 1" }, { id: "2", label: "职员 2" }, { id: "3", label: "职员 3" }, { id: "4", label: "职员 4" }, { id: "5", label: "职员 5" }] },
]);

const SKILL_FIELDS = Object.freeze([
  { key: "coo", label: "COO" }, { key: "cfo", label: "CFO" },
  { key: "cmo", label: "CMO" }, { key: "cto", label: "CTO" },
]);

function focusBoardroomSlot(container, slotId) {
  const control = container?.querySelector?.(`[data-slot-id="${slotId}"] > [role="button"]`);
  if (!control || typeof control.focus !== "function") return false;
  control.focus();
  return true;
}

function renderBoardroom(component, overlay, boardroomState, focusSlotId) {
  const container = overlay.querySelector("#sc-slots-container");
  if (!container) return;
  container.replaceChildren();
  let draggedSlotId = null;
  let selectedSlotId = null;
  const rerender = (slotId) => {
    component.renderBoardroom(overlay, boardroomState, slotId);
    component.calculateBoardroomResults(overlay, boardroomState);
  };

  for (const group of SLOT_GROUPS) {
    const groupElement = document.createElement("div");
    groupElement.className = "sc-slots-group";
    const title = document.createElement("div");
    title.className = "sc-slots-title";
    title.textContent = group.title;
    const grid = document.createElement("div");
    grid.className = "sc-slots-grid";
    groupElement.append(title, grid);

    for (const slot of group.slots) {
      const slotElement = document.createElement("div");
      slotElement.dataset.slotId = slot.id;
      slotElement.ondragover = (event) => event.preventDefault();
      slotElement.ondragenter = (event) => { event.preventDefault(); slotElement.classList.add("dragover"); };
      slotElement.ondragleave = () => slotElement.classList.remove("dragover");
      slotElement.ondrop = (event) => {
        event.preventDefault();
        slotElement.classList.remove("dragover");
        if (!draggedSlotId || draggedSlotId === slot.id) return;
        const previous = boardroomState[draggedSlotId];
        boardroomState[draggedSlotId] = boardroomState[slot.id];
        boardroomState[slot.id] = previous;
        rerender(slot.id);
      };

      const executive = boardroomState[slot.id];
      if (!executive) {
        const empty = document.createElement("div");
        empty.className = "sc-exec-card-empty";
        empty.textContent = `空 ${slot.label} 席`;
        empty.setAttribute("role", "button");
        empty.setAttribute("aria-label", `向 ${slot.label} 席位添加或移动高管`);
        empty.tabIndex = 0;
        const activate = () => {
          if (selectedSlotId === null) {
            boardroomState[slot.id] = { name: "自定义高管", skills: { coo: 0, cfo: 0, cmo: 0, cto: 0 } };
          } else {
            boardroomState[slot.id] = boardroomState[selectedSlotId];
            boardroomState[selectedSlotId] = null;
            selectedSlotId = null;
          }
          rerender(slot.id);
        };
        empty.onclick = (event) => { event.stopPropagation(); activate(); };
        empty.onkeydown = (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activate();
        };
        slotElement.append(empty);
        grid.append(slotElement);
        continue;
      }

      const card = document.createElement("div");
      card.className = "sc-exec-card";
      card.setAttribute("draggable", "true");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `选择 ${slot.label} 席位的 ${executive.name}`);
      card.setAttribute("aria-pressed", "false");
      card.tabIndex = 0;
      card.ondragstart = () => { draggedSlotId = slot.id; card.classList.add("dragged"); };
      card.ondragend = () => { draggedSlotId = null; card.classList.remove("dragged"); };
      const activateCard = () => {
        if (selectedSlotId === null) {
          selectedSlotId = slot.id;
          card.classList.add("selected");
          card.setAttribute("aria-pressed", "true");
        } else if (selectedSlotId === slot.id) {
          selectedSlotId = null;
          card.classList.remove("selected");
          card.setAttribute("aria-pressed", "false");
        } else {
          const previous = boardroomState[selectedSlotId];
          boardroomState[selectedSlotId] = boardroomState[slot.id];
          boardroomState[slot.id] = previous;
          selectedSlotId = null;
          rerender(slot.id);
        }
      };
      card.onclick = (event) => {
        if (event.target.tagName === "INPUT" || event.target.tagName === "BUTTON") return;
        event.stopPropagation();
        activateCard();
      };
      card.onkeydown = (event) => {
        if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        activateCard();
      };

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "sc-card-remove";
      remove.textContent = "移除";
      remove.setAttribute("aria-label", `移除 ${slot.label} 席位的 ${executive.name}`);
      remove.onclick = (event) => { event.stopPropagation(); boardroomState[slot.id] = null; rerender(slot.id); };
      const role = document.createElement("div");
      role.className = "sc-card-role";
      role.textContent = slot.label;
      const name = document.createElement("input");
      name.type = "text";
      name.className = "sc-card-name-input";
      name.setAttribute("aria-label", `${slot.label} 高管名称`);
      name.value = executive.name;
      name.onchange = () => { executive.name = name.value; };
      const skills = document.createElement("div");
      skills.className = "sc-card-skills";
      for (const field of SKILL_FIELDS) {
        const row = document.createElement("div");
        row.className = "sc-card-skill-row";
        const label = document.createElement("span");
        label.className = "sc-card-skill-label";
        label.textContent = field.label;
        const input = document.createElement("input");
        input.type = "number";
        input.className = "sc-card-skill-input";
        input.min = "0";
        input.step = "1";
        input.value = executive.skills[field.key];
        input.setAttribute("aria-label", `${executive.name} ${field.label} 点数`);
        input.onfocus = () => card.setAttribute("draggable", "false");
        input.onblur = () => card.setAttribute("draggable", "true");
        input.onchange = () => {
          const value = Math.max(0, parseInt(input.value) || 0);
          input.value = value;
          executive.skills[field.key] = value;
          component.calculateBoardroomResults(overlay, boardroomState);
        };
        row.append(label, input);
        skills.append(row);
      }
      card.append(remove, role, name, skills);
      slotElement.append(card);
      grid.append(slotElement);
    }
    container.append(groupElement);
  }
  if (focusSlotId !== undefined) focusBoardroomSlot(container, focusSlotId);
}

module.exports = { focusBoardroomSlot, renderBoardroom };
