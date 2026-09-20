const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function loadCtx() {
  const ctx = vm.createContext({ console });
  ["data.js", "core/store.js", "core/mapping.js", "core/filters.js", "pages/wages.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  });
  return (expr) => vm.runInContext(expr, ctx);
}
function json(get, expr) { return JSON.parse(get(`JSON.stringify(${expr})`)); }
function test(name, fn) { try { fn(); console.log("ok  - " + name); } catch (err) { console.error("FAIL- " + name + "\n" + err.stack); process.exitCode = 1; } }

test("recalcWage counts half days as half a day and derives balance", () => {
  const get = loadCtx();
  const w = json(get, `recalcWage({ wageRate: 750, daysPresent: 24, halfDays: 1, payments: [{ id: 1, date: "2026-09-05", amount: 5000, by: 6 }] })`);
  assert.strictEqual(w.totalPayable, 18375);
  assert.strictEqual(w.advancePaid, 5000);
  assert.strictEqual(w.balancePayable, 13375);
  assert.strictEqual(w.status, "Partially Paid");
  assert.strictEqual(w.paymentDate, "2026-09-05");
});

test("seed wage rows already satisfy the recalc invariants", () => {
  const get = loadCtx();
  const bad = json(get, `WAGES.filter((w) => { const c = recalcWage(JSON.parse(JSON.stringify(w))); return c.totalPayable !== w.totalPayable || c.advancePaid !== w.advancePaid || c.balancePayable !== w.balancePayable || c.status !== w.status; }).map((w) => w.id)`);
  assert.deepStrictEqual(bad, []);
});

test("status moves Pending -> Partially Paid -> Paid as payments are recorded", () => {
  const get = loadCtx();
  const out = json(get, `(() => {
    const w = saveWageRecord({ siteId: 1, labourId: 1, period: "2026-10", wageRate: 100, daysPresent: 10, halfDays: 0 }, null, 6);
    const s0 = w.status;
    saveWagePayment(w, { date: "2026-10-05", amount: 400, mode: "Cash" }, 6, null);
    const s1 = w.status;
    saveWagePayment(w, { date: "2026-10-06", amount: 600, mode: "UPI" }, 6, null);
    const s2 = w.status;
    removeWagePayment(w, w.payments[1].id);
    return { s0, s1, s2, back: w.status, balance: w.balancePayable };
  })()`);
  assert.deepStrictEqual(out, { s0: "Pending", s1: "Partially Paid", s2: "Paid", back: "Partially Paid", balance: 600 });
});

test("overpayment and bad payment fields are rejected; editing releases its own amount", () => {
  const get = loadCtx();
  const out = json(get, `(() => {
    const w = WAGES.find((x) => x.id === 1);
    const over = validateWagePayment(w, { amount: 13376, date: "2026-09-20", mode: "Cash" }, null);
    const ok = validateWagePayment(w, { amount: 13375, date: "2026-09-20", mode: "Cash" }, null);
    const editOk = validateWagePayment(w, { amount: 18375, date: "2026-09-20", mode: "Cash" }, w.payments[0]);
    const bad = validateWagePayment(w, { amount: 0, date: "", mode: "Cheque" }, null);
    return { over, ok, editOk, bad };
  })()`);
  assert.ok(out.over.amount.includes("exceed"));
  assert.deepStrictEqual(out.ok, {});
  assert.deepStrictEqual(out.editOk, {});
  assert.deepStrictEqual(Object.keys(out.bad).sort(), ["amount", "date", "mode"]);
});

test("duplicate labour + site + period is blocked; editing itself is allowed", () => {
  const get = loadCtx();
  const out = json(get, `(() => {
    const dup = validateWageForm({ siteId: 1, labourId: 1, period: "2026-09", wageRate: 750, daysPresent: 5, halfDays: 0 }, WAGES, null);
    const self = validateWageForm({ siteId: 1, labourId: 1, period: "2026-09", wageRate: 750, daysPresent: 24, halfDays: 1 }, WAGES, WAGES[0]);
    const other = validateWageForm({ siteId: 1, labourId: 1, period: "2026-08", wageRate: 750, daysPresent: 5, halfDays: 0 }, WAGES, null);
    return { dup, self, other };
  })()`);
  assert.strictEqual(out.dup._form, "Wage record already exists");
  assert.deepStrictEqual(out.self, {});
  assert.deepStrictEqual(out.other, {});
});

test("wage form validates required fields, site mapping, day limits and payable vs paid", () => {
  const get = loadCtx();
  const out = json(get, `(() => ({
    empty: validateWageForm({}, WAGES, null),
    unmapped: validateWageForm({ siteId: 2, labourId: 1, period: "2026-09", wageRate: 100, daysPresent: 1, halfDays: 0 }, WAGES, null),
    tooMany: validateWageForm({ siteId: 1, labourId: 2, period: "2026-09", wageRate: 100, daysPresent: 31, halfDays: 2 }, WAGES, null),
    lowered: validateWageForm({ siteId: 1, labourId: 1, period: "2026-09", wageRate: 750, daysPresent: 2, halfDays: 0 }, WAGES, WAGES[0]),
  }))()`);
  assert.deepStrictEqual(Object.keys(out.empty).sort(), ["daysPresent", "labourId", "period", "siteId", "wageRate"]);
  assert.strictEqual(out.unmapped.labourId, "Labour is not mapped to this site");
  assert.ok(out.tooMany.halfDays);
  assert.ok(out.lowered._form.includes("cannot be lower"));
});

test("computeDaysFromAttendance matches seed attendance (Suresh 2026-09: 2 present)", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, `computeDaysFromAttendance(1, 1, "2026-09")`), { daysPresent: 2, halfDays: 0 });
  assert.deepStrictEqual(json(get, `computeDaysFromAttendance(8, 1, "2026-09")`), { daysPresent: 1, halfDays: 1 });
  assert.deepStrictEqual(json(get, `computeDaysFromAttendance(1, 1, "2026-08")`), { daysPresent: 0, halfDays: 0 });
});

test("filterWages composes site, labour, month, status and payment date range", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { siteId: "1" }).map((w) => w.id)`), [1, 2, 5]);
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { siteId: "1", labourId: "8" }).map((w) => w.id)`), [5]);
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { month: "2026-09" }).length`), 5);
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { month: "2026-08" }).length`), 0);
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { status: "Pending" }).map((w) => w.id)`), [2, 5]);
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { from: "2026-09-06", to: "2026-09-09" }).map((w) => w.id)`), [4]);
  assert.deepStrictEqual(json(get, `filterWages(WAGES, { from: "2026-09-01" }).map((w) => w.id)`), [1, 3, 4]);
});

test("Filters.labourForSite cascades: mapped labour for a site, all in-scope labour otherwise", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, `Filters.labourForSite(1, [1, 3, 5]).map((l) => l.id).sort()`), [1, 2, 5, 8]);
  assert.deepStrictEqual(json(get, `Filters.labourForSite("", [3]).map((l) => l.id)`), [6]);
  assert.deepStrictEqual(json(get, `Filters.labourForSite("", []).map((l) => l.id)`), []);
});
