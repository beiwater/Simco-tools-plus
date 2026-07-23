const { enableFloatingPanelDrag } = require("./automax/floatingPanel.js");

const ROOT_ID = "script_cpt_setting_container";

function ensureSecondaryWindow() {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "false");
  root.innerHTML = `<header id="script_setting_head"><span></span><button type="button" class="btn" aria-label="关闭组件设置">关闭</button></header><div id="script_setting_body"></div>`;
  root.querySelector("#script_setting_head button").addEventListener("click", () => closeSecondaryWindow(root));
  enableFloatingPanelDrag(root, root.querySelector("#script_setting_head"));
  document.body.append(root);
  return root;
}

function resetPosition(root) {
  Object.assign(root.style, { bottom: "auto", left: "50%", right: "auto", top: "50%", transform: "translate(-50%, -50%)" });
}

function openSecondaryWindow({ id, title, content, onClose }) {
  const root = ensureSecondaryWindow();
  const body = root.querySelector("#script_setting_body");
  root.dataset.secondaryWindowId = id;
  root.__secondaryWindowOnClose = onClose;
  root.querySelector("#script_setting_head > span").textContent = title;
  root.setAttribute("aria-label", title);
  body.replaceChildren(content);
  resetPosition(root);
  root.hidden = false;
  root.style.display = "block";
  return { root, body };
}

function closeSecondaryWindow(root = ensureSecondaryWindow()) {
  if (root.hidden) return;
  const onClose = root.__secondaryWindowOnClose;
  root.hidden = true;
  root.style.display = "none";
  root.querySelector("#script_setting_body").replaceChildren();
  delete root.dataset.secondaryWindowId;
  root.__secondaryWindowOnClose = undefined;
  onClose?.();
}

function isSecondaryWindowOpen(id) {
  const root = document.getElementById(ROOT_ID);
  return Boolean(root && !root.hidden && root.dataset.secondaryWindowId === id);
}

module.exports = { closeSecondaryWindow, ensureSecondaryWindow, isSecondaryWindowOpen, openSecondaryWindow };
