const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function loadCtx() {
  const ctx = vm.createContext({ console });
  ["data.js", "core/store.js", "core/filters.js", "pages/resources.js", "pages/materials.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  });
  return (expr) => vm.runInContext(expr, ctx);
}
function json(get, expr) { return JSON.parse(get(`JSON.stringify(${expr})`)); }
function test(name, fn) { try { fn(); console.log("ok  - " + name); } catch (err) { console.error("FAIL- " + name + "\n" + err.stack); process.exitCode = 1; } }

test("seed migration keeps site 1 tools and safety quantities from the old text entries", () => {
  const get = loadCtx();
  assert.strictEqual(json(get, `TOOLS.filter((t) => t.siteId === 1 && t.name === "Concrete mixer").reduce((s, t) => s + t.quantity, 0)`), 4);
  assert.strictEqual(json(get, `SAFETY_EQUIPMENT.filter((t) => t.siteId === 1 && t.name === "Harness").reduce((s, t) => s + t.quantity, 0)`), 15);
  assert.ok(json(get, `TOOLS.every((t) => t.siteId && t.name && typeof t.quantity === "number" && ITEM_CONDITIONS.includes(t.condition))`));
});

test("validateItemForm requires site, name, non-negative quantity and a known condition", () => {
  const get = loadCtx();
  assert.deepStrictEqual(Object.keys(json(get, `validateItemForm({})`)).sort(), ["condition", "name", "quantity", "siteId"]);
  assert.deepStrictEqual(json(get, `validateItemForm({ siteId: 1, name: "Drill", quantity: 0, condition: "Good" })`), {});
  assert.ok(json(get, `validateItemForm({ siteId: 1, name: "Drill", quantity: -1, condition: "Good" })`).quantity);
});

test("saveItem adds with a new id and edits in place, stamping updater", () => {
  const get = loadCtx();
  const out = json(get, `(() => {
    const before = TOOLS.length;
    const row = saveItem(TOOLS, { siteId: 2, name: "Hammer", quantity: 5, unit: "Nos", condition: "Good" }, null, 6, "2026-09-20");
    const edited = saveItem(TOOLS, { siteId: 2, name: "Hammer", quantity: 7, unit: "Nos", condition: "Needs repair" }, row, 8, "2026-09-21");
    return { added: TOOLS.length - before, quantity: edited.quantity, by: edited.updatedBy, on: edited.updatedOn, same: TOOLS.filter((t) => t.id === row.id).length };
  })()`);
  assert.deepStrictEqual(out, { added: 1, quantity: 7, by: 8, on: "2026-09-21", same: 1 });
});

test("filterItems narrows by site", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, `filterItems(TOOLS, { siteId: "3" }).map((t) => t.name)`), ["Cable drum", "Conduit pipe", "Drilling machine"]);
  assert.strictEqual(json(get, `filterItems(TOOLS, {}).length`), 15);
});

test("filterMaterials composes site, category, month and date range", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, `filterMaterials(MATERIALS, { siteId: "1" }).map((m) => m.id)`), [1, 2]);
  assert.deepStrictEqual(json(get, `filterMaterials(MATERIALS, { category: "Client Provided" }).map((m) => m.id)`), [2, 4, 6]);
  assert.deepStrictEqual(json(get, `filterMaterials(MATERIALS, { month: "2026-01" }).map((m) => m.id)`), [6]);
  assert.deepStrictEqual(json(get, `filterMaterials(MATERIALS, { from: "2026-09-05", to: "2026-09-06" }).map((m) => m.id)`), [3, 4]);
});

test("validateMaterialForm requires every field and a positive quantity", () => {
  const get = loadCtx();
  assert.deepStrictEqual(Object.keys(json(get, `validateMaterialForm({})`)).sort(), ["category", "date", "name", "providedBy", "quantity", "siteId", "unit"]);
  assert.deepStrictEqual(json(get, `validateMaterialForm({ siteId: 1, name: "Sand", category: "Company Provided", quantity: 2, unit: "Tonnes", providedBy: "Vendor", date: "2026-09-20" })`), {});
  assert.ok(json(get, `validateMaterialForm({ siteId: 1, name: "Sand", category: "Company Provided", quantity: 0, unit: "T", providedBy: "V", date: "2026-09-20" })`).quantity);
});
