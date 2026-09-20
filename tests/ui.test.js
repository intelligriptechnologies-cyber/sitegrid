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

const FILES = ["data.js", "core/store.js", "core/ui.js"];
const cols = [{ key: "n", label: "Name", text: (r) => r.n }, { key: "c", label: "City", text: (r) => r.c }];
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, n: "N" + (i + 1), c: "C" }));

test("Store.nextId", () => {
  const { get } = loadCtx(FILES);
  assert.strictEqual(get("Store.nextId([])"), 1);
  assert.strictEqual(get("Store.nextId([{id:3},{id:7}])"), 8);
});

test("UI.filterRows matches across columns, case-insensitive, trims, empty = all", () => {
  const { ctx, get } = loadCtx(FILES);
  ctx.rows = [{ n: "Alpha", c: "Pune" }, { n: "Beta", c: "Delhi" }]; ctx.cols = cols;
  assert.strictEqual(get("UI.filterRows(rows, cols, 'ALP').length"), 1);
  assert.strictEqual(get("UI.filterRows(rows, cols, 'delhi')[0].n"), "Beta");
  assert.strictEqual(get("UI.filterRows(rows, cols, '  pune  ').length"), 1);
  assert.strictEqual(get("UI.filterRows(rows, cols, '').length"), 2);
  assert.strictEqual(get("UI.filterRows(rows, cols, 'zzz').length"), 0);
});

test("UI.paginate pages, ranges, clamping, empty", () => {
  const { ctx, get } = loadCtx(FILES);
  ctx.rows = mk(25);
  assert.strictEqual(get("UI.paginate(rows, 3, 10).pages"), 3);
  assert.strictEqual(get("UI.paginate(rows, 3, 10).rows.length"), 5);
  assert.strictEqual(get("UI.paginate(rows, 3, 10).from"), 21);
  assert.strictEqual(get("UI.paginate(rows, 3, 10).to"), 25);
  assert.strictEqual(get("UI.paginate(rows, 3, 10).total"), 25);
  assert.strictEqual(get("UI.paginate(rows, 0, 10).page"), 1);
  assert.strictEqual(get("UI.paginate(rows, 99, 10).page"), 3);
  ctx.empty = [];
  const p = JSON.parse(get("JSON.stringify(UI.paginate(empty, 1, 10))"));
  assert.deepStrictEqual([p.pages, p.total, p.from, p.to, p.page, p.rows.length], [1, 0, 0, 0, 1, 0]);
});

console.log(passed + " passed");
