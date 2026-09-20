const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
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

test("UI.tag escapes text and kind; emptyState escapes", () => {
  const { get } = loadCtx(FILES);
  assert.strictEqual(get("UI.tag('<b>x</b>', 'ok')"), '<span class="tag ok">&lt;b&gt;x&lt;/b&gt;</span>');
  assert.strictEqual(get("UI.tag('a')"), '<span class="tag neutral">a</span>');
  assert.strictEqual(get("UI.emptyState('<i>')"), '<div class="ui-empty">&lt;i&gt;</div>');
});

test("UI.getFiltered applies query and initialQuery; unregister removes", () => {
  const { ctx, get } = loadCtx(FILES);
  ctx.rows = [{ n: "Alpha", c: "Pune" }, { n: "Beta", c: "Delhi" }]; ctx.cols = cols;
  get("UI.tableHost({ id: 't', rows: () => rows, columns: cols, initialQuery: 'beta' })");
  const f = get("UI.getFiltered('t')");
  assert.strictEqual(f.rows.length, 1);
  assert.strictEqual(f.rows[0].n, "Beta");
  assert.strictEqual(f.columns.length, 2);
  get("UI.tableHost({ id: 't', rows: () => rows, columns: cols, initialQuery: 'zzz' })"); // re-register keeps prior query
  assert.strictEqual(get("UI.getFiltered('t').rows.length"), 1);
  get("UI.unregister('t')");
  assert.strictEqual(get("UI.getFiltered('t').rows.length"), 0);
});

test("UI.validateField: required, min/max, pattern, custom", () => {
  const { get } = loadCtx(FILES);
  const vf = (f, val) => get("UI.validateField(" + JSON.stringify(f) + ", " + JSON.stringify(val) + ", {})");
  assert.strictEqual(vf({ label: "A", required: true }, ""), "A is required");
  assert.strictEqual(vf({ label: "A" }, ""), null);
  assert.strictEqual(vf({ label: "N", type: "number", min: 1 }, 0), "N must be at least 1");
  assert.strictEqual(vf({ label: "N", type: "number", max: 5 }, 6), "N must be at most 5");
  assert.strictEqual(vf({ label: "N", type: "number", min: 1, max: 5 }, 3), null);
  assert.strictEqual(vf({ label: "P", pattern: "[0-9]{3}" }, "12a"), "P is not in the expected format");
  assert.strictEqual(vf({ label: "P", pattern: "[0-9]{3}" }, "123"), null);
});

test("Store purges orphaned sitegrid.* keys on load and reset (session key kept on load)", () => {
  const { ctx, get } = loadCtx(FILES);
  ctx.localStorage.setItem("sitegrid.v1.USERS", "[]");
  ctx.localStorage.setItem("sitegrid.v0.Whatever", "[]");
  ctx.localStorage.setItem("other.key", "x");
  ctx.localStorage.setItem("sitegrid.v3.USERS", "[]");
  get("Store.storage = localStorage; Store.load()");
  assert.deepStrictEqual(ctx.localStorage.keys().sort(), ["other.key", "sitegrid.v3.USERS"]);
  get("Store.reset(false)");
  assert.deepStrictEqual(ctx.localStorage.keys(), ["other.key"]);
});

test("login option label escapes user and role names", () => {
  const { ctx, get } = loadCtx([...FILES, "core/login.js"]);
  get("var roleName = (id) => id === 1 ? '<script>alert(1)</script>' : '-'");
  ctx.u = { id: 1, name: '<img src=x onerror=alert(1)>', roleId: 1, active: false };
  const out = get("loginOptionLabel(u)");
  assert.ok(!/<img|<script/i.test(out), out);
  assert.ok(out.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(out.includes("&lt;script&gt;") && out.endsWith("(Inactive)"));
});

test("UI.fitDimensions keeps aspect, never upscales", () => {
  const { get } = loadCtx(["core/ui.js"]);
  assert.strictEqual(JSON.stringify(get("UI.fitDimensions(800,400,400)")), '{"width":400,"height":200}');
  assert.strictEqual(JSON.stringify(get("UI.fitDimensions(300,900,400)")), '{"width":133,"height":400}');
  assert.strictEqual(JSON.stringify(get("UI.fitDimensions(200,100,400)")), '{"width":200,"height":100}');
  assert.strictEqual(JSON.stringify(get("UI.fitDimensions(800,400)")), '{"width":800,"height":400}');
});

console.log(passed + " passed");
