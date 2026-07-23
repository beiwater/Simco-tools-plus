const assert = require("node:assert/strict");
const test = require("node:test");

const {
  collectDroppedFiles,
  imageFileToCssValue,
  selectFirstImageFile,
} = require("../components/customBackgroundImage.js");
const { componentList, tools } = require("../tools/tools.js");

test("selects the first supported image from a file or folder selection", () => {
  // Given
  const files = [
    { name: "notes.txt", type: "text/plain" },
    { name: "background.webp", type: "image/webp" },
    { name: "other.png", type: "image/png" },
  ];

  // When
  const selected = selectFirstImageFile(files);

  // Then
  assert.equal(selected.name, "background.webp");
});

test("converts an image file into a browser-persistable CSS value", async () => {
  // Given
  const file = { name: "背景图.png", type: "image/png" };
  class FakeFileReader {
    readAsDataURL(receivedFile) {
      assert.strictEqual(receivedFile, file);
      this.result = "data:image/png;base64,aGVsbG8=";
      queueMicrotask(() => this.onload());
    }
  }

  // When
  const cssValue = await imageFileToCssValue(file, FakeFileReader);

  // Then
  assert.equal(cssValue, 'url("data:image/png;base64,aGVsbG8=")');
});

test("collects image candidates recursively from a dropped folder", async () => {
  // Given
  const image = { name: "nested.jpg", type: "image/jpeg" };
  const text = { name: "readme.txt", type: "text/plain" };
  const fileEntry = (file) => ({
    isDirectory: false,
    isFile: true,
    file(resolve) { resolve(file); },
  });
  let readCount = 0;
  const folderEntry = {
    isDirectory: true,
    isFile: false,
    createReader() {
      return {
        readEntries(resolve) {
          readCount += 1;
          resolve(readCount === 1 ? [fileEntry(text), fileEntry(image)] : []);
        },
      };
    },
  };
  const dataTransfer = {
    files: [],
    items: [{ webkitGetAsEntry: () => folderEntry }],
  };

  // When
  const files = await collectDroppedFiles(dataTransfer);

  // Then
  assert.deepEqual(files, [text, image]);
});

test("imports a local image, persists it, and applies it immediately", async () => {
  // Given
  const component = componentList.customBackgroundImage;
  const originalDocument = global.document;
  const originalFileReader = global.FileReader;
  const originalPersist = tools.indexDB_updateIndexDBData;
  const originalData = { ...component.indexDBData };
  const status = { textContent: "" };
  const textarea = { value: "" };
  const appended = [];
  const root = {
    querySelector(selector) {
      return selector === "textarea" ? textarea : status;
    },
  };
  class FakeFileReader {
    readAsDataURL() {
      this.result = "data:image/webp;base64,YmFja2dyb3VuZA==";
      queueMicrotask(() => this.onload());
    }
  }
  global.FileReader = FakeFileReader;
  global.document = {
    head: { appendChild(node) { appended.push(node); } },
    querySelector() { return null; },
    createElement() {
      return {
        setAttribute() {},
        textContent: "",
      };
    },
  };
  let persistCount = 0;
  tools.indexDB_updateIndexDBData = async () => { persistCount += 1; };

  try {
    // When
    await component.importFiles([{ name: "background.webp", type: "image/webp" }], root);

    // Then
    assert.equal(component.indexDBData.imageName, "background.webp");
    assert.equal(component.indexDBData.cssText, 'url("data:image/webp;base64,YmFja2dyb3VuZA==")');
    assert.equal(textarea.value, component.indexDBData.cssText);
    assert.equal(status.textContent, "已保存在浏览器：background.webp");
    assert.equal(persistCount, 1);
    assert.equal(appended.length, 1);
  } finally {
    component.indexDBData = originalData;
    tools.indexDB_updateIndexDBData = originalPersist;
    global.FileReader = originalFileReader;
    global.document = originalDocument;
  }
});
