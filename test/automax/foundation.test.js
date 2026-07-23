const assert = require("node:assert/strict");
const test = require("node:test");

const { runWorkerTask } = require("../../tools/automax");

function createWorkerEnvironment({ onPostMessage, onConstruct } = {}) {
  const state = { revoked: [], terminated: 0, posted: [] };

  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }

  class FakeWorker {
    constructor(url) {
      this.url = url;
      onConstruct?.(this, state);
    }

    postMessage(payload) {
      state.posted.push(payload);
      onPostMessage?.(this, payload, state);
    }

    terminate() {
      state.terminated += 1;
    }
  }

  return {
    state,
    BlobCtor: FakeBlob,
    WorkerCtor: FakeWorker,
    URLApi: {
      createObjectURL(blob) {
        assert.equal(blob.options.type, "application/javascript");
        return "blob:automax-test";
      },
      revokeObjectURL(url) {
        state.revoked.push(url);
      },
    },
  };
}

test("resolves a worker result and releases its Blob URL exactly once", async () => {
  const environment = createWorkerEnvironment({
    onPostMessage(worker, payload) {
      queueMicrotask(() => worker.onmessage({ data: { total: payload.quantity * 2 } }));
    },
  });

  const result = await runWorkerTask("self.onmessage = () => {};", { quantity: 3 }, {
    ...environment,
    timeoutMs: 100,
  });

  assert.deepEqual(result, { ok: true, value: { total: 6 } });
  assert.deepEqual(environment.state.posted, [{ quantity: 3 }]);
  assert.deepEqual(environment.state.revoked, ["blob:automax-test"]);
  assert.equal(environment.state.terminated, 1);
});

test("returns an explicit failure for a malformed worker message", async () => {
  const environment = createWorkerEnvironment({
    onPostMessage(worker) {
      queueMicrotask(() => worker.onmessage({ data: undefined }));
    },
  });

  const result = await runWorkerTask("self.onmessage = () => {};", {}, {
    ...environment,
    timeoutMs: 100,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "MALFORMED_WORKER_MESSAGE");
  assert.deepEqual(environment.state.revoked, ["blob:automax-test"]);
  assert.equal(environment.state.terminated, 1);
});

test("returns a recoverable result when Workers are unavailable", async () => {
  const result = await runWorkerTask("self.onmessage = () => {};", {}, {
    BlobCtor: undefined,
    WorkerCtor: undefined,
    URLApi: undefined,
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "WORKER_UNAVAILABLE",
      message: "Web Workers are unavailable in this environment.",
    },
  });
});
