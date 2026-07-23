// SPDX-License-Identifier: AGPL-3.0-or-later
const { failure, success } = require("./result.js");

function getBrowserWorkerDependencies(options) {
  return {
    BlobCtor: options.BlobCtor ?? globalThis.Blob,
    URLApi: options.URLApi ?? globalThis.URL,
    WorkerCtor: options.WorkerCtor ?? globalThis.Worker,
  };
}

function runWorkerTask(source, payload, options = {}) {
  const { BlobCtor, URLApi, WorkerCtor } = getBrowserWorkerDependencies(options);
  const timeoutMs = options.timeoutMs ?? 15_000;

  if (typeof BlobCtor !== "function" || typeof WorkerCtor !== "function" || !URLApi?.createObjectURL || !URLApi?.revokeObjectURL) {
    return Promise.resolve(failure("WORKER_UNAVAILABLE", "Web Workers are unavailable in this environment."));
  }

  let objectUrl;
  try {
    const blob = new BlobCtor([source], { type: "application/javascript" });
    objectUrl = URLApi.createObjectURL(blob);
  } catch {
    return Promise.resolve(failure("WORKER_SETUP_FAILED", "Unable to create a Worker script."));
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;
    let worker;

    const cleanup = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      worker?.terminate?.();
      URLApi.revokeObjectURL(objectUrl);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    try {
      worker = new WorkerCtor(objectUrl);
      worker.onmessage = ({ data }) => {
        if (data === undefined || data === null) {
          finish(failure("MALFORMED_WORKER_MESSAGE", "Worker returned no result."));
          return;
        }
        finish(success(data));
      };
      worker.onerror = () => finish(failure("WORKER_EXECUTION_FAILED", "Worker execution failed."));
      timeoutId = setTimeout(() => finish(failure("WORKER_TIMEOUT", "Worker did not finish in time.")), timeoutMs);
      worker.postMessage(payload);
    } catch {
      finish(failure("WORKER_SETUP_FAILED", "Unable to start a Worker."));
    }
  });
}

module.exports = { runWorkerTask };
