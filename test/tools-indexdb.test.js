const assert = require("node:assert/strict");
const test = require("node:test");

const { tools } = require("../tools/tools.js");

test("IndexedDB writes reject instead of hanging while the connection is not ready", async () => {
  const originalOpenFlag = tools.dbOpenFlag;
  const originalOpenTime = tools.dbOpenTime;
  tools.dbOpenFlag = true;
  tools.dbOpenTime = 0;

  try {
    await assert.rejects(tools.indexDB_addData({ id: "test" }), /数据库尚未就绪/);
    await assert.rejects(tools.indexDB_updateData({ id: "test" }), /数据库尚未就绪/);
  } finally {
    tools.dbOpenFlag = originalOpenFlag;
    tools.dbOpenTime = originalOpenTime;
  }
});
