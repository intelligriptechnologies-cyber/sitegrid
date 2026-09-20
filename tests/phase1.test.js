const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
           removeItem: (k) => m.delete(k), keys: () => [...m.keys()] };
}
function loadCtx(files) {
  const ctx = vm.createContext({ localStorage: fakeStorage(), sessionStorage: fakeStorage(), console });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  return { ctx, get: (expr) => vm.runInContext(expr, ctx) };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("ok  - " + name); } catch (e) { console.error("FAIL- " + name + "\n" + e.stack); process.exitCode = 1; } }

const FILES = ["data.js", "core/store.js", "core/auth.js"].filter((f) => fs.existsSync(path.join(root, f)));

test("seed: every user has departmentIds, none has departmentId", () => {
  const { get } = loadCtx(["data.js"]);
  assert.strictEqual(get("USERS.every(u => Array.isArray(u.departmentIds) && !('departmentId' in u))"), true);
  assert.strictEqual(get("USERS.filter(u => u.roleId >= 2).every(u => u.departmentIds.length >= 1)"), true);
  assert.strictEqual(get("USERS.filter(u => u.roleId <= 1).every(u => u.departmentIds.length === 0)"), true);
  assert.strictEqual(get("USERS.some(u => u.departmentIds.length > 1)"), true, "need one multi-dept demo user");
});

test("store: save then load restores mutated rows in place", () => {
  const { get } = loadCtx(["data.js", "core/store.js"]);
  get("Store.save()");
  get("USERS[0].name = 'Changed'; USERS.push({id: 99, name: 'Temp'})");
  get("Store.save()");
  get("USERS[0].name = 'Other'; USERS.length = 1");
  assert.strictEqual(get("Store.load()"), true);
  assert.strictEqual(get("USERS[0].name"), "Changed");
  assert.strictEqual(get("USERS.some(u => u.id === 99)"), true);
});

test("store: works without storage", () => {
  const { get } = loadCtx(["data.js", "core/store.js"]);
  get("Store.storage = null");
  assert.strictEqual(get("Store.save()"), false);
  assert.strictEqual(get("Store.load()"), false);
});

test("store: reset clears keys", () => {
  const { get, ctx } = loadCtx(["data.js", "core/store.js"]);
  get("Store.save()");
  assert.ok(ctx.localStorage.keys().length > 0);
  get("Store.reset(false)");
  assert.strictEqual(ctx.localStorage.keys().length, 0);
});

/* AUTH_TESTS_MARKER */

console.log(`${passed} passed`);
