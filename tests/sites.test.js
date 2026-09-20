const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function loadCtx(files) {
  const ctx = vm.createContext({ console });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  return (expr) => vm.runInContext(expr, ctx);
}
function test(name, fn) { try { fn(); console.log("ok  - " + name); } catch (e) { console.error("FAIL- " + name + "\n" + e.stack); process.exitCode = 1; } }

const get = loadCtx(["data.js", "core/store.js", "core/ui.js", "core/auth.js", "core/mapping.js", "pages/sites.js"]);
const run = (values, id) => JSON.parse(get(`JSON.stringify(validateSiteForm(${JSON.stringify(values)}, ${id === undefined ? "null" : id}))`));
const ok = { name: "New Tower", departmentId: 1, areaSqft: 30000, lat: 20.3477, lng: 85.8245, startDate: "2026-09-01", endDate: "2027-01-01" };

test("valid values -> no errors", () => assert.deepStrictEqual(run(ok), {}));
test("name required", () => { assert.ok(run({ ...ok, name: "  " }).name); });
test("name unique (case-insensitive), editing own name allowed", () => {
  assert.ok(run({ ...ok, name: "kalinga it annex" }).name);
  assert.deepStrictEqual(run({ ...ok, name: "Kalinga IT Annex" }, 3), {});
  assert.ok(run({ ...ok, name: "Kalinga IT Annex" }, 2).name);
});
test("department required", () => assert.ok(run({ ...ok, departmentId: "" }).departmentId));
test("end date must not precede start date", () => {
  assert.ok(run({ ...ok, startDate: "2026-09-01", endDate: "2026-08-31" }).endDate);
  assert.deepStrictEqual(run({ ...ok, startDate: "2026-09-01", endDate: "2026-09-01" }), {});
  assert.deepStrictEqual(run({ ...ok, endDate: "" }), {});
});
test("lat/lng ranges", () => {
  assert.ok(run({ ...ok, lat: 91 }).lat);
  assert.ok(run({ ...ok, lat: -90.5 }).lat);
  assert.ok(run({ ...ok, lng: 181 }).lng);
  assert.ok(run({ ...ok, lng: "abc" }).lng);
  assert.deepStrictEqual(run({ ...ok, lat: "", lng: "" }), {});
});
test("area must be > 0", () => {
  assert.ok(run({ ...ok, areaSqft: 0 }).areaSqft);
  assert.ok(run({ ...ok, areaSqft: -5 }).areaSqft);
  assert.deepStrictEqual(run({ ...ok, areaSqft: "" }), {});
});
