const { failure, success } = require("./result.js");
const { runWorkerTask } = require("./worker.js");

module.exports = { failure, runWorkerTask, success };
