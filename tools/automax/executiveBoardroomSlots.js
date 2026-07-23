const SLOT_GROUPS = Object.freeze([
  { title: "高管", slots: [{ id: "o", label: "COO" }, { id: "f", label: "CFO" }, { id: "m", label: "CMO" }, { id: "t", label: "CTO" }] },
  { title: "学徒", slots: [{ id: "v", label: "COO 学徒" }, { id: "x", label: "CFO 学徒" }, { id: "y", label: "CMO 学徒" }, { id: "z", label: "CTO 学徒" }] },
  { title: "职员", slots: [{ id: "1", label: "职员 1" }, { id: "2", label: "职员 2" }, { id: "3", label: "职员 3" }, { id: "4", label: "职员 4" }, { id: "5", label: "职员 5" }] },
]);

const SKILL_FIELDS = Object.freeze([
  { key: "coo", label: "COO", color: "#2196F3" },
  { key: "cfo", label: "CFO", color: "#ff9800" },
  { key: "cmo", label: "CMO", color: "#e91e63" },
  { key: "cto", label: "CTO", color: "#9c27b0" },
]);

function renderBoardroom(component, overlay, boardroomState) {
  const leftContainer = overlay.querySelector("#sc-slots-container");
  if (!leftContainer) return;
  leftContainer.replaceChildren();
  let draggedSlotId = null;
  let selectedSlotId = null;
  const rerender = () => {
    component.renderBoardroom(overlay, boardroomState);
    component.calculateBoardroomResults(overlay, boardroomState);
  };

  for (const group of SLOT_GROUPS) {
    const groupElement = document.createElement("div");
    groupElement.className = "sc-slots-group";
    const title = document.createElement("div");
    title.className = "sc-slots-title";
    title.textContent = group.title;
    groupElement.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "sc-slots-grid";

    for (const slot of group.slots) {
      const slotElement = document.createElement("div");
      slotElement.dataset.slotId = slot.id;
      slotElement.ondragover = (event) => { event.preventDefault(); };
      slotElement.ondragenter = (event) => {
        event.preventDefault();
        slotElement.classList.add("dragover");
      };
      slotElement.ondragleave = () => { slotElement.classList.remove("dragover"); };
      slotElement.ondrop = (event) => {
        event.preventDefault();
        slotElement.classList.remove("dragover");
        if (!draggedSlotId || draggedSlotId === slot.id) return;
        const previous = boardroomState[draggedSlotId];
        boardroomState[draggedSlotId] = boardroomState[slot.id];
        boardroomState[slot.id] = previous;
        rerender();
      };
      slotElement.onclick = (event) => {
        if (selectedSlotId === null || boardroomState[slot.id]) return;
        event.stopPropagation();
        const previous = boardroomState[selectedSlotId];
        boardroomState[selectedSlotId] = boardroomState[slot.id];
        boardroomState[slot.id] = previous;
        selectedSlotId = null;
        rerender();
      };

      const executive = boardroomState[slot.id];
      if (!executive) {
        const empty = document.createElement("div");
        empty.className = "sc-exec-card-empty";
        empty.textContent = `空 ${slot.label} 席`;
        empty.onclick = (event) => {
          if (selectedSlotId !== null) return;
          event.stopPropagation();
          boardroomState[slot.id] = {
            name: "自定义高管",
            skills: { coo: 0, cfo: 0, cmo: 0, cto: 0 },
          };
          rerender();
        };
        slotElement.appendChild(empty);
        grid.appendChild(slotElement);
        continue;
      }

      const card = document.createElement("div");
      card.className = "sc-exec-card";
      card.setAttribute("draggable", "true");
      card.ondragstart = () => {
        draggedSlotId = slot.id;
        card.classList.add("dragged");
      };
      card.ondragend = () => {
        draggedSlotId = null;
        card.classList.remove("dragged");
      };
      card.onclick = (event) => {
        if (event.target.tagName === "INPUT") return;
        event.stopPropagation();
        if (selectedSlotId === null) {
          selectedSlotId = slot.id;
          card.classList.add("selected");
          return;
        }
        if (selectedSlotId === slot.id) {
          selectedSlotId = null;
          card.classList.remove("selected");
          return;
        }
        const previous = boardroomState[selectedSlotId];
        boardroomState[selectedSlotId] = boardroomState[slot.id];
        boardroomState[slot.id] = previous;
        selectedSlotId = null;
        rerender();
      };

      const close = document.createElement("span");
      close.innerHTML = "&times;";
      close.style.cssText = "position:absolute; top:2px; right:6px; cursor:pointer; font-size:14px; font-weight:bold; color:var(--sct-control-hover, rgb(114, 114, 114));";
      close.onclick = (event) => {
        event.stopPropagation();
        boardroomState[slot.id] = null;
        rerender();
      };
      card.appendChild(close);

      const role = document.createElement("div");
      role.style.cssText = "font-size: 9px; color: var(--sct-control-hover, rgb(114, 114, 114)); text-align: center; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;";
      role.textContent = slot.label;
      card.appendChild(role);

      const name = document.createElement("input");
      name.type = "text";
      name.style.cssText = "font-weight:bold; font-size:12px; margin-bottom:8px; text-align:center; width:100%; border:none; background:transparent; color:var(--fontColor);";
      name.value = executive.name;
      name.onchange = () => { executive.name = name.value; };
      card.appendChild(name);

      const skills = document.createElement("div");
      skills.className = "sc-card-skills";
      for (const field of SKILL_FIELDS) {
        const row = document.createElement("div");
        row.className = "sc-card-skill-row";
        const label = document.createElement("span");
        label.className = "sc-card-skill-label";
        label.style.color = field.color;
        label.textContent = field.label;
        const input = document.createElement("input");
        input.type = "number";
        input.className = "sc-card-skill-input";
        input.min = "0";
        input.step = "1";
        input.value = executive.skills[field.key];
        input.onfocus = () => card.setAttribute("draggable", "false");
        input.onblur = () => card.setAttribute("draggable", "true");
        input.onchange = () => {
          const value = Math.max(0, parseInt(input.value) || 0);
          input.value = value;
          executive.skills[field.key] = value;
          component.calculateBoardroomResults(overlay, boardroomState);
        };
        row.append(label, input);
        skills.appendChild(row);
      }
      card.appendChild(skills);
      slotElement.appendChild(card);
      grid.appendChild(slotElement);
    }
    groupElement.appendChild(grid);
    leftContainer.appendChild(groupElement);
  }
}

module.exports = { renderBoardroom };
