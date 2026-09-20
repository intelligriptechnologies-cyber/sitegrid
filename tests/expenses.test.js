const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function loadCtx() {
  const ctx = vm.createContext({ console });
  ["data.js", "core/store.js", "core/auth.js", "core/mapping.js", "core/filters.js", "pages/expenses.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  });
  return (expr) => vm.runInContext(expr, ctx);
}
function json(get, expr) { return JSON.parse(get(`JSON.stringify(${expr})`)); }
function test(name, fn) { try { fn(); console.log("ok  - " + name); } catch (err) { console.error("FAIL- " + name + "\n" + err.stack); process.exitCode = 1; } }

test("filterExpenses composes site, labour, month, date range, status and category", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, `filterExpenses(EXPENSES, { siteId: "1" }).map((e) => e.id)`), [1, 2, 6]);
  assert.deepStrictEqual(json(get, `filterExpenses(EXPENSES, { labourId: "1" }).map((e) => e.id)`), [6]);
  assert.deepStrictEqual(json(get, `filterExpenses(EXPENSES, { month: "2026-08" }).map((e) => e.id)`), [6]);
  assert.deepStrictEqual(json(get, `filterExpenses(EXPENSES, { from: "2026-09-15", to: "2026-09-15" }).map((e) => e.id)`), [3, 4]);
  assert.deepStrictEqual(json(get, `filterExpenses(EXPENSES, { status: "Pending" }).map((e) => e.id)`), [3, 6]);
  assert.deepStrictEqual(json(get, `filterExpenses(EXPENSES, { category: "Transport" }).map((e) => e.id)`), [1, 5]);
});

test("expenseTotalsByStatus totals equal the EXPENSES sums", () => {
  const get = loadCtx();
  const t = json(get, `expenseTotalsByStatus(EXPENSES)`);
  assert.deepStrictEqual(t, { Approved: 3500, Pending: 5000, Rejected: 0, Total: 8500 });
  assert.strictEqual(t.Total, json(get, `EXPENSES.reduce((s, e) => s + e.amount, 0)`));
});

test("canEditExpense: own or admin, never once Approved", () => {
  const get = loadCtx();
  assert.strictEqual(get(`canEditExpense(USERS.find((u) => u.id === 6), { paidBy: 6, status: "Pending" })`), true);
  assert.strictEqual(get(`canEditExpense(USERS.find((u) => u.id === 6), { paidBy: 7, status: "Pending" })`), false);
  assert.strictEqual(get(`canEditExpense(USERS.find((u) => u.id === 2), { paidBy: 7, status: "Rejected" })`), true);
  assert.strictEqual(get(`canEditExpense(USERS.find((u) => u.id === 2), { paidBy: 7, status: "Approved" })`), false);
});

test("canDecideExpense: needs permission, Pending, and not your own", () => {
  const get = loadCtx();
  const u = `USERS.find((x) => x.id === 3)`;
  assert.strictEqual(get(`canDecideExpense(${u}, { paidBy: 6, status: "Pending" }, true)`), true);
  assert.strictEqual(get(`canDecideExpense(${u}, { paidBy: 3, status: "Pending" }, true)`), false);
  assert.strictEqual(get(`canDecideExpense(${u}, { paidBy: 6, status: "Approved" }, true)`), false);
  assert.strictEqual(get(`canDecideExpense(${u}, { paidBy: 6, status: "Pending" }, false)`), false);
});

test("validateExpenseForm requires fields, positive amount and mapped labour", () => {
  const get = loadCtx();
  assert.deepStrictEqual(Object.keys(json(get, `validateExpenseForm({})`)).sort(), ["amount", "category", "date", "description", "siteId"]);
  assert.deepStrictEqual(json(get, `validateExpenseForm({ date: "2026-09-20", siteId: 1, category: "Fuel", amount: 10, description: "x", labourId: 1 })`), {});
  assert.strictEqual(json(get, `validateExpenseForm({ date: "2026-09-20", siteId: 3, category: "Fuel", amount: 10, description: "x", labourId: 1 })`).labourId, "Labour is not mapped to this site");
  assert.ok(json(get, `validateExpenseForm({ date: "2026-09-20", siteId: 1, category: "Fuel", amount: -5, description: "x" })`).amount);
});

test("approve, reject and resubmit transitions", () => {
  const get = loadCtx();
  const out = json(get, `(() => {
    const e = saveExpense({ date: "2026-09-20", siteId: 1, category: "Fuel", amount: 300, description: "Diesel" }, null, 6);
    const created = e.status;
    decideExpense(e, false, 3, "No bill");
    const rejected = { status: e.status, reason: e.rejectionReason, by: e.rejectedBy };
    saveExpense({ date: "2026-09-20", siteId: 1, category: "Fuel", amount: 300, description: "Diesel with bill" }, e, 6);
    const resubmitted = { status: e.status, reason: e.rejectionReason };
    decideExpense(e, true, 3);
    return { created, rejected, resubmitted, approved: { status: e.status, by: e.approvedBy } };
  })()`);
  assert.strictEqual(out.created, "Pending");
  assert.deepStrictEqual(out.rejected, { status: "Rejected", reason: "No bill", by: 3 });
  assert.deepStrictEqual(out.resubmitted, { status: "Pending" });
  assert.deepStrictEqual(out.approved, { status: "Approved", by: 3 });
});
