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

test('background mode requests Google identity without a Drive file permission',async()=>{
 let requested;
 const auth=new GoogleAuth({clientId:'fixture',identityOnly:true},{environment:{google:{accounts:{oauth2:{initTokenClient:config=>({requestAccessToken:()=>{requested=config;config.callback({access_token:'fixture-token',expires_in:3600})}})}}}}});
 await auth.authorize();assert.equal(requested.scope,'openid email profile');assert.equal(requested.scope.includes('drive.file'),false);auth.disconnect();
});

test('personal mode verifies the Google profile directly without a Firebase session and refuses unverified identity',async()=>{
 const h=harness();h.auth.token='fixture';h.auth.expiresAt=Date.now()+60000;
 const profile=await h.auth.profile(async(url,options)=>{assert.equal(url,'https://www.googleapis.com/oauth2/v3/userinfo');assert.equal(options.headers.Authorization,'Bearer fixture');return {ok:true,json:async()=>({email:'owner@example.test',email_verified:true})}});
 assert.equal(profile.email,'owner@example.test');
 await assert.rejects(h.auth.profile(async()=>({ok:true,json:async()=>({email:'owner@example.test',email_verified:false})})),/не подтвердил/);
});

test('verified session restores across pages, respects expiry, keeps account hint and explicit logout clears it',async()=>{
 const saved=new Map(),localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 let requestConfig,requested;
 const environment={localStorage,google:{accounts:{oauth2:{initTokenClient:c=>{requestConfig=c;return {requestAccessToken:options=>{requested=options;c.callback({access_token:'fixture-persistent',expires_in:3600})}}}}}}};
 const first=new GoogleAuth({clientId:'persistent-test'},{environment});await first.authorize();assert.equal(saved.size,0,'unverified authorization is never persisted');first.remember('owner@example.test');
 const next=new GoogleAuth({clientId:'persistent-test'},{environment});assert.equal(next.getToken(),'fixture-persistent');assert.equal(next.rememberedEmail,'owner@example.test');
 next.invalidate();assert.throws(()=>next.getToken(),e=>e.auth);assert.equal(next.rememberedEmail,'owner@example.test');await next.authorize();assert.equal(requestConfig.login_hint,'owner@example.test');assert.equal(requested.prompt,'');
 next.remember();next.disconnect();assert.equal(saved.size,0);assert.equal(new GoogleAuth({clientId:'persistent-test'},{environment}).rememberedEmail,'');
});
test('identity-only cached grant cannot be restored as a Drive permission and revoked tokens are never reused',()=>{
 const saved=new Map(),environment={localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}};
 const a=new GoogleAuth({clientId:'scope-test',identityOnly:true},{environment});a.token='identity-fixture';a.expiresAt=Date.now()+60000;a.remember('owner@example.test');
 const b=new GoogleAuth({clientId:'scope-test',identityOnly:false},{environment});assert.throws(()=>b.getToken(),e=>e.auth);assert.equal(b.rememberedEmail,'owner@example.test');
 a.invalidate();assert.throws(()=>new GoogleAuth({clientId:'scope-test',identityOnly:true},{environment}).getToken(),e=>e.auth);
});
test('a revoked grant is invalidated while its remembered verified account survives for renewal',async()=>{
 const saved=new Map(),environment={localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}};
 const a=new GoogleAuth({clientId:'revoked-test'},{environment});a.token='revoked-fixture';a.expiresAt=Date.now()+60000;a.remember('owner@example.test');
 await assert.rejects(a.profile(async()=>({ok:false,status:401,json:async()=>({error:'revoked'})})),e=>e.auth);
 assert.equal(a.rememberedEmail,'owner@example.test');assert.throws(()=>a.getToken(),e=>e.auth);assert.equal(new GoogleAuth({clientId:'revoked-test'},{environment}).rememberedEmail,'owner@example.test');
});
