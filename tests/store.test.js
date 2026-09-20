const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function flakyStorage(failAfter) {
  const m = new Map();
  let writes = 0;
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => (m.has(k) ? m.get(k) : null),
           setItem: (k, v) => { if (failAfter != null && writes >= failAfter) throw new Error("QuotaExceeded"); writes++; m.set(k, String(v)); },
           removeItem: (k) => m.delete(k), snapshot: () => JSON.stringify([...m.entries()]), arm: (n) => { failAfter = n; writes = 0; } };
}
function load(storage) {
  const ctx = vm.createContext({ localStorage: storage, sessionStorage: flakyStorage(), console });
  for (const f of ["data.js", "core/store.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  return (expr) => vm.runInContext(expr, ctx);
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("ok  - " + name); } catch (e) { console.error("FAIL- " + name + "\n" + e.stack); process.exitCode = 1; } }

test("save() returns true and writes every table", () => {
  const st = flakyStorage(null);
  const get = load(st);
  assert.strictEqual(get("Store.save()"), true);
  assert.strictEqual(st.length, get("Object.keys(Store.tables()).length"));
});

test("save() rolls back all keys written in the call when a write throws", () => {
  const st = flakyStorage(null);
  const get = load(st);
  get("Store.save()");
  const before = st.snapshot();
  get("LABOUR.push({id:99,name:'X'})");
  st.arm(5);
  assert.strictEqual(get("Store.save()"), false);
  st.arm(null);
  assert.strictEqual(st.snapshot(), before);
});

test("save() rollback removes keys that did not exist before", () => {
  const st = flakyStorage(3);
  const get = load(st);
  assert.strictEqual(get("Store.save()"), false);
  assert.strictEqual(st.length, 0);
});

console.log(passed + " passed");
