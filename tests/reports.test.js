const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function loadCtx() {
  const ctx = vm.createContext({ console });
  ["data.js", "core/store.js", "core/mapping.js", "core/filters.js", "pages/reports.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  });
  return (expr) => vm.runInContext(expr, ctx);
}
function json(get, expr) { return JSON.parse(get(`JSON.stringify(${expr})`)); }
function test(name, fn) { try { fn(); console.log("ok  - " + name); } catch (err) { console.error("FAIL- " + name + "\n" + err.stack); process.exitCode = 1; } }
const ALL = "{ siteIds: [1, 2, 3, 4, 5], now: \"2026-09-20\" }";

test("every catalog report builds with columns, rows and no throw", () => {
  const get = loadCtx();
  const ids = json(get, `REPORT_CATALOG.map((r) => r.id)`);
  assert.strictEqual(ids.length, 8);
  ids.forEach((id) => {
    const r = json(get, `buildReport("${id}", {}, ${ALL})`);
    assert.ok(r.title && r.columns.length && Array.isArray(r.rows), id);
  });
});

test("attendance summary for 2026-09 site 1 matches the seed", () => {
  const get = loadCtx();
  const rows = json(get, `buildReport("attendance", { siteId: "1", month: "2026-09" }, ${ALL}).rows`);
  const by = Object.fromEntries(rows.map((r) => [r.labour, r]));
  assert.deepStrictEqual([by["Suresh Rout"].present, by["Suresh Rout"].absent], [2, 0]);
  assert.deepStrictEqual([by["Bijay Kumar Sahoo"].present, by["Bijay Kumar Sahoo"].absent], [1, 1]);
  assert.deepStrictEqual([by["Golak Bihari Jena"].present, by["Golak Bihari Jena"].half, by["Golak Bihari Jena"].worked], [1, 1, 1.5]);
  assert.strictEqual(by["Dilip Pradhan"].present, 0);
});

test("attendance summary respects the date range and scope", () => {
  const get = loadCtx();
  const one = json(get, `buildReport("attendance", { siteId: "1", from: "2026-09-16", to: "2026-09-16" }, ${ALL}).rows.find((r) => r.labour === "Suresh Rout")`);
  assert.strictEqual(one.present, 1);
  const scoped = json(get, `buildReport("attendance", {}, { siteIds: [3], now: "2026-09-20" }).rows.map((r) => r.labour)`);
  assert.deepStrictEqual(scoped, ["Chittaranjan Das"]);
});

test("wage statement footer balance equals the sum of balances, with outstanding-by-site notes", () => {
  const get = loadCtx();
  const r = json(get, `buildReport("wages", {}, ${ALL})`);
  assert.strictEqual(r.footer.balance, 13375 + 17600 + 0 + 6820 + 16340);
  assert.strictEqual(r.footer.balance, json(get, `WAGES.reduce((s, w) => s + w.balancePayable, 0)`));
  assert.ok(r.notes.some((n) => n.includes("Riverside Residency Tower 1")));
  assert.strictEqual(json(get, `buildReport("wages", { month: "2026-08" }, ${ALL}).rows.length`), 0);
});

test("petty cash by category totals equal the EXPENSES sums per status", () => {
  const get = loadCtx();
  const r = json(get, `buildReport("petty-cash", {}, ${ALL})`);
  const sums = json(get, `expenseSumsForTest()`.replace("expenseSumsForTest()", `({ Approved: EXPENSES.filter((e) => e.status === "Approved").reduce((s, e) => s + e.amount, 0), Pending: EXPENSES.filter((e) => e.status === "Pending").reduce((s, e) => s + e.amount, 0), Rejected: EXPENSES.filter((e) => e.status === "Rejected").reduce((s, e) => s + e.amount, 0) })`));
  assert.deepStrictEqual([r.footer.approved, r.footer.pending, r.footer.rejected], [sums.Approved, sums.Pending, sums.Rejected]);
  const siteTotal = r.rows.filter((x) => x.group === "By site").reduce((s, x) => s + x.total, 0);
  assert.strictEqual(siteTotal, r.footer.total);
});

test("headcount counts equal LABOUR counts and unmapped labour is listed", () => {
  const get = loadCtx();
  const r = json(get, `buildReport("headcount", {}, ${ALL})`);
  const unmapped = r.rows.filter((x) => x.site === "Unmapped").reduce((s, x) => s + x.total, 0);
  assert.strictEqual(unmapped, json(get, `LABOUR.filter((l) => isUnmapped(l.id)).length`));
  const site1 = r.rows.filter((x) => x.site === "Riverside Residency Tower 1").reduce((s, x) => s + x.total, 0);
  assert.strictEqual(site1, json(get, `siteLabourIds(1).length`));
  assert.strictEqual(r.footer.active + r.footer.inactive, r.footer.total);
  assert.ok(r.notes[0].startsWith("Biometric coverage: 0%"));
});

test("material summary groups by site, category and material", () => {
  const get = loadCtx();
  const r = json(get, `buildReport("materials", { siteId: "1" }, ${ALL})`);
  assert.deepStrictEqual(r.rows.map((x) => [x.category, x.material, x.quantity]), [["Client Provided", "TMT Steel Bars", 12], ["Company Provided", "Cement (OPC 53)", 500]]);
});

test("approvals aging buckets use the injected now", () => {
  const get = loadCtx();
  const r = json(get, `buildReport("approvals-aging", {}, { siteIds: [1, 2, 3, 4, 5], now: "2026-09-20", requests: [
    { title: "a", type: "General", siteId: 1, requestedBy: 7, requestDate: "2026-09-19 09:00", status: "Pending" },
    { title: "b", type: "General", siteId: 1, requestedBy: 7, requestDate: "2026-09-15 09:00", status: "Resubmitted" },
    { title: "c", type: "General", siteId: null, requestedBy: 7, requestDate: "2026-09-01 09:00", status: "Review Requested" },
    { title: "d", type: "General", siteId: 1, requestedBy: 7, requestDate: "2026-09-01 09:00", status: "Approved" }
  ] })`);
  assert.deepStrictEqual(r.rows.map((x) => [x.title, x.age, x.bucket]), [["c", 19, "8+ days"], ["b", 5, "3–7 days"], ["a", 1, "0–2 days"]]);
  assert.strictEqual(r.notes[0], "Buckets — 0–2 days: 1 · 3–7 days: 1 · 8+ days: 1");
});

test("labour approval report counts by status and unknown ids throw", () => {
  const get = loadCtx();
  const r = json(get, `buildReport("labour-approval", {}, ${ALL})`);
  assert.deepStrictEqual(r.rows, [{ status: "Approved", count: 5 }, { status: "Pending", count: 2 }, { status: "Rejected", count: 1 }]);
  assert.throws(() => get(`buildReport("nope", {}, ${ALL})`));
});
