// SPDX-License-Identifier: AGPL-3.0-or-later
function success(value) {
  return { ok: true, value };
}

function failure(code, message) {
  return {
    ok: false,
    error: { code, message },
  };
}

module.exports = { failure, success };
