const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");

const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

function isImageFile(file) {
  return Boolean(file && (file.type?.startsWith("image/") || IMAGE_EXTENSION.test(file.name || "")));
}

function normalizeBlur(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(32, Math.round(number)));
}

function selectFirstImageFile(files) {
  return Array.from(files || []).find(isImageFile);
}

function imageFileToCssValue(file, Reader = FileReader) {
  return new Promise((resolve, reject) => {
    const reader = new Reader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
        reject(new Error("无法读取这个图片文件"));
        return;
      }
      resolve(`url(${JSON.stringify(reader.result)})`);
    };
    reader.onerror = () => reject(new Error("读取图片文件失败"));
    reader.readAsDataURL(file);
  });
}

function entryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function collectEntryFiles(entry) {
  if (entry.isFile) return [await entryFile(entry)];
  if (!entry.isDirectory) return [];

  const reader = entry.createReader();
  const files = [];
  while (true) {
    const entries = await readDirectoryEntries(reader);
    if (entries.length === 0) return files;
    for (const child of entries) files.push(...await collectEntryFiles(child));
  }
}

async function collectDroppedFiles(dataTransfer) {
  const entries = Array.from(dataTransfer?.items || [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length === 0) return Array.from(dataTransfer?.files || []);

  const files = [];
  for (const entry of entries) files.push(...await collectEntryFiles(entry));
  return files;
}

class customBackgroundImage extends BaseComponent {
  constructor() {
    super();
    this.name = "自定义背景图片";
    this.describe = "可拖入图片、选择图片或文件夹，并保存在当前浏览器中";
    this.enable = false;
    this.tagList = ["个性化"];
  }

  componentData = {
    styleNode: undefined,
  }

  startupFuncList = [this.mainFunc]

  indexDBData = {
    cssText: "",
    imageName: "",
    blurPx: 0,
  }

  cssText = [`
    #setting-container-4 .sct-background-import { display: grid; gap: 8px; margin-bottom: 12px; }
    #setting-container-4 .sct-background-dropzone { align-items: center; background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border: 2px dashed var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 8px; color: var(--fontColor); cursor: pointer; display: flex; flex-direction: column; gap: 8px; justify-content: center; min-height: 120px; padding: 16px; text-align: center; transition: background-color 120ms ease-in-out, border-color 120ms ease-in-out; }
    #setting-container-4 .sct-background-dropzone[data-dragging="true"] { background: var(--sct-enabled, #14541d); border-color: var(--sct-enabled-hover, #339841); }
    #setting-container-4 .sct-background-dropzone:focus-visible, #setting-container-4 button:focus-visible { outline: 2px solid var(--sct-focus, wheat); outline-offset: 2px; }
    #setting-container-4 .sct-background-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    #setting-container-4 .sct-background-actions button { background: var(--sct-control, rgb(76, 76, 76)); color: var(--fontColor); min-height: 36px; }
    #setting-container-4 .sct-background-status { font-size: 12px; line-height: 1.5; margin: 0; overflow-wrap: anywhere; }
    #setting-container-4 table { table-layout: fixed; width: 100%; }
    #setting-container-4 td { overflow-wrap: anywhere; }
    #setting-container-4 textarea { background-color: rgb(34, 34, 34); box-sizing: border-box; color: var(--fontColor); min-height: 120px; resize: vertical; width: 100%; }
    #setting-container-4 .sct-background-blur { align-items: center; display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) 52px; }
    #setting-container-4 .sct-background-blur input[type="range"] { width: 100%; }
    @media (max-width: 480px) {
      #setting-container-4 .sct-background-actions { flex-direction: column; width: 100%; }
      #setting-container-4 table, #setting-container-4 tbody, #setting-container-4 tr, #setting-container-4 td { display: block; width: 100%; }
      #setting-container-4 td { padding-block: 4px; }
    }
    @media (prefers-reduced-motion: reduce) { #setting-container-4 .sct-background-dropzone { transition: none; } }
  `]

  settingUI = () => {
    const mainSetNode = document.createElement("div");
    mainSetNode.id = "setting-container-4";
    mainSetNode.className = "col-sm-12 setting-container";
    mainSetNode.innerHTML = `
      <div>
        <div class="header">自定义背景图片设置</div>
        <div class="container">
          <div class="sct-background-import">
            <div class="sct-background-dropzone" role="button" tabindex="0" aria-label="拖入或选择背景图片" data-dragging="false">
              <strong>把图片或图片文件夹拖到这里</strong>
              <span>图片会保存在当前浏览器中</span>
              <div class="sct-background-actions">
                <button class="btn sct-background-file" type="button">选择图片</button>
                <button class="btn sct-background-folder" type="button">选择文件夹</button>
              </div>
            </div>
            <p class="sct-background-status" aria-live="polite"></p>
            <input class="sct-background-file-input" type="file" accept="image/*" hidden>
            <input class="sct-background-folder-input" type="file" accept="image/*" webkitdirectory multiple hidden>
          </div>
          <table>
            <tr><td>功能</td><td>设置</td></tr>
            <tr><td title="可填写颜色或 HTTPS 图片地址">背景 CSS 内容</td><td><textarea aria-label="背景 CSS 内容"></textarea></td></tr>
            <tr><td title="仅模糊背景图片，不影响页面文字与按钮">高斯模糊</td><td><label class="sct-background-blur"><input type="range" min="0" max="32" step="1" aria-label="背景高斯模糊"><output>0 px</output></label></td></tr>
          </table>
          <button class="btn script_opt_submit" type="button">保存 CSS 内容</button>
        </div>
      </div>`;

    const textarea = mainSetNode.querySelector("textarea");
    const fileInput = mainSetNode.querySelector(".sct-background-file-input");
    const folderInput = mainSetNode.querySelector(".sct-background-folder-input");
    const dropzone = mainSetNode.querySelector(".sct-background-dropzone");
    const blurInput = mainSetNode.querySelector('input[type="range"]');
    const blurOutput = mainSetNode.querySelector("output");
    textarea.value = this.indexDBData.cssText;
    blurInput.value = String(normalizeBlur(this.indexDBData.blurPx));
    blurOutput.textContent = `${blurInput.value} px`;
    this.updateStatus(mainSetNode, this.indexDBData.imageName
      ? `已保存在浏览器：${this.indexDBData.imageName}`
      : "支持 PNG、JPEG、WebP、GIF、AVIF 和 SVG；文件夹中使用第一张图片。");

    mainSetNode.querySelector("button.script_opt_submit").addEventListener("click", () => this.settingSubmitHandle());
    blurInput.addEventListener("input", () => { blurOutput.textContent = `${blurInput.value} px`; });
    mainSetNode.querySelector("button.sct-background-file").addEventListener("click", (event) => {
      event.stopPropagation();
      fileInput.click();
    });
    mainSetNode.querySelector("button.sct-background-folder").addEventListener("click", (event) => {
      event.stopPropagation();
      folderInput.click();
    });
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      fileInput.click();
    });
    for (const eventName of ["dragenter", "dragover"]) {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.dataset.dragging = "true";
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.dataset.dragging = "false";
      });
    }
    dropzone.addEventListener("drop", async (event) => this.importFiles(await collectDroppedFiles(event.dataTransfer), mainSetNode));
    fileInput.addEventListener("change", () => this.importFiles(fileInput.files, mainSetNode));
    folderInput.addEventListener("change", () => this.importFiles(folderInput.files, mainSetNode));
    return mainSetNode;
  }

  updateStatus(root, message) {
    root.querySelector(".sct-background-status").textContent = message;
  }

  async importFiles(files, root) {
    const file = selectFirstImageFile(files);
    if (!file) {
      this.updateStatus(root, "没有找到可用的图片文件。");
      return;
    }

    this.updateStatus(root, `正在读取：${file.name}`);
    try {
      this.indexDBData.cssText = await imageFileToCssValue(file);
      this.indexDBData.imageName = file.name;
      root.querySelector("textarea").value = this.indexDBData.cssText;
      await tools.indexDB_updateIndexDBData();
      this.mainFunc();
      this.updateStatus(root, `已保存在浏览器：${file.name}`);
    } catch (error) {
      this.updateStatus(root, error instanceof Error ? error.message : "图片导入失败");
    }
  }

  async settingSubmitHandle() {
    const root = document.querySelector("div#setting-container-4");
    const itemValue = root.querySelector("textarea").value.trim();
    const urlReg = /^https:\/\/[\w.-]+\.[a-zA-Z]{2,}/;
    const colorValid = tools.hexArgbCheck(itemValue);

    if (itemValue === "" || colorValid) {
      this.indexDBData.cssText = itemValue;
    } else if (urlReg.test(itemValue)) {
      this.indexDBData.cssText = `url(${JSON.stringify(itemValue)})`;
    } else if (itemValue.startsWith("url(\"data:image/")) {
      this.indexDBData.cssText = itemValue;
    } else {
      tools.alert("内容不正确，允许颜色、HTTPS 图片地址或导入的本地图片。");
      return;
    }
    this.indexDBData.imageName = "";
    this.indexDBData.blurPx = normalizeBlur(root.querySelector('input[type="range"]').value);
    await tools.indexDB_updateIndexDBData();
    this.mainFunc();
    tools.alert("更改已提交");
  }

  mainFunc() {
    const nowNode = document.querySelector("style[sct_cpt='customBackgroundImage']");
    if (nowNode) nowNode.remove();
    if (this.indexDBData.cssText === "") return;

    const newNode = document.createElement("style");
    newNode.setAttribute("sct_cpt", "customBackgroundImage");
    newNode.setAttribute("type", "text/css");
    const blur = normalizeBlur(this.indexDBData.blurPx);
    newNode.textContent = blur === 0
      ? `div#root div#page>div { background: ${this.indexDBData.cssText} no-repeat center top !important; background-size: cover !important; }`
      : `div#root div#page>div { background: transparent !important; isolation: isolate; position: relative; }
         div#root div#page>div::before { background: ${this.indexDBData.cssText} no-repeat center top; background-size: cover; content: ""; filter: blur(${blur}px); inset: -${blur}px; pointer-events: none; position: absolute; z-index: 0; }
         div#root div#page>div > * { position: relative; z-index: 1; }`;
    this.componentData.styleNode = newNode;
    document.head.appendChild(newNode);
  }
}

new customBackgroundImage();

module.exports = {
  collectDroppedFiles,
  imageFileToCssValue,
  isImageFile,
  normalizeBlur,
  selectFirstImageFile,
};
