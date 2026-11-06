import test from "node:test";
import assert from "node:assert/strict";
import { GoogleAuth } from "../public/google-auth.mjs";
function harness() {
  let callback,
    timeout,
    cleared = 0;
  const environment = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient(config) {
            callback = config.callback;
            return { requestAccessToken() {} };
          },
        },
      },
    },
  };
  const auth = new GoogleAuth(
    { clientId: "test-client" },
    {
      environment,
      schedule: (fn) => {
        timeout = fn;
        return 1;
      },
      cancelTimer: () => cleared++,
    },
  );
  return {
    auth,
    environment,
    respond: (r) => callback(r),
    expire: () => timeout(),
    get cleared() {
      return cleared;
    },
  };
}
test("disconnect cancels an outstanding OAuth request and ignores its late callback", async () => {
  const h = harness(),
    pending = h.auth.authorize();
  h.auth.disconnect();
  h.respond({ access_token: "FAKE_TEST_ONLY", expires_in: 3600 });
  await assert.rejects(pending, (error) => error.cancelled);
  assert.equal(h.auth.token, null);
  assert.throws(() => h.auth.getToken(), /Войдите/);
});
test("a cancelled old authorization cannot replace a later successful session", async () => {
  const h = harness(),
    first = h.auth.authorize(),
    old = h.respond;
  let previous;
  // Capture the callback before the SDK installs the next request.
  h.environment.google.accounts.oauth2.initTokenClient = (config) => {
    previous = config.callback;
    return { requestAccessToken() {} };
  };
  const second = h.auth.authorize();
  await assert.rejects(first, (e) => e.cancelled);
  previous({ access_token: "SECOND_TEST_ONLY", expires_in: 3600 });
  await second;
  old({ access_token: "LATE_TEST_ONLY", expires_in: 3600 });
  assert.equal(h.auth.getToken(), "SECOND_TEST_ONLY");
});
test("SDK initialization failure and timeout clear the pending operation", async () => {
  const h = harness();
  h.environment.google.accounts.oauth2.initTokenClient = () => {
    throw new Error("SDK failed");
  };
  await assert.rejects(h.auth.authorize(), /SDK failed/);
  assert.ok(h.cleared > 0);
  assert.equal(h.auth.cancelAuth, null);
  const slow = harness(),
    request = slow.auth.authorize();
  slow.expire();
  await assert.rejects(request, /не завершил вход/);
  assert.equal(slow.auth.token, null);
});
test("authorization uses basic identity and only the selected Drive file and token stays in memory until disconnect", async () => {
  const h = harness();
  let config;
  h.environment.google.accounts.oauth2.initTokenClient = (c) => {
    config = c;
    return { requestAccessToken() {} };
  };
  const promise = h.auth.authorize();
  config.callback({ access_token: "FAKE_TEST_ONLY", expires_in: 3600 });
  await promise;
  assert.equal(config.scope, "openid email profile https://www.googleapis.com/auth/drive.file");
  assert.equal(config.include_granted_scopes, false);
  h.auth.disconnect();
  assert.equal(h.auth.token, null);
});
