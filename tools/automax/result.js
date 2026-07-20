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
