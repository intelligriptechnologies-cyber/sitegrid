const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function loadCtx() {
  const ctx = vm.createContext({ console });
  ["data.js", "core/store.js", "core/mapping.js", "pages/attendance.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  });
  return (expr) => vm.runInContext(expr, ctx);
}
function json(get, expr) { return JSON.parse(get(`JSON.stringify(${expr})`)); }
function test(name, fn) { try { fn(); console.log("ok  - " + name); } catch (err) { console.error("FAIL- " + name + "\n" + err.stack); process.exitCode = 1; } }

test("attendanceMonthMatrix groups records by labour and counts half days as half worked", () => {
  const get = loadCtx();
  const matrix = json(get, `attendanceMonthMatrix([
    { labourId: 10, date: "2026-09-01", status: "Present" },
    { labourId: 10, date: "2026-09-02", status: "Half Day" },
    { labourId: 10, date: "2026-09-03", status: "Absent" },
    { labourId: 20, date: "2026-09-05", status: "Leave" },
    { labourId: 10, date: "2026-10-01", status: "Present" }
  ], [10, 20, 30], "2026-09")`);
  assert.deepStrictEqual(matrix, [
    { labourId: 10, days: { 1: "Present", 2: "Half Day", 3: "Absent" }, totals: { Present: 1, "Half Day": 1, Absent: 1, Leave: 0 } },
    { labourId: 20, days: { 5: "Leave" }, totals: { Present: 0, "Half Day": 0, Absent: 0, Leave: 1 } },
    { labourId: 30, days: {}, totals: { Present: 0, "Half Day": 0, Absent: 0, Leave: 0 } }
  ]);
});

test("attendanceMonthMatrix preserves all same-day site statuses so its day cell agrees with totals", () => {
  const get = loadCtx();
  const matrix = json(get, `attendanceMonthMatrix([
    { labourId: 10, siteId: 1, date: "2026-09-04", status: "Present" },
    { labourId: 10, siteId: 5, date: "2026-09-04", status: "Half Day" }
  ], [10], "2026-09")`);
  assert.deepStrictEqual(matrix, [{
    labourId: 10,
    days: { 4: "Present / Half Day" },
    totals: { Present: 1, "Half Day": 1, Absent: 0, Leave: 0 }
  }]);
});

test("upsertAttendance adds new records and updates a matching labour site and date", () => {
  const get = loadCtx();
  const result = json(get, `(() => {
    const original = ATTENDANCE.length;
    const first = upsertAttendance([{ date: "2026-09-20", siteId: 1, labourId: 1, status: "Present", checkIn: "08:00", checkOut: "17:00", remarks: "on time" }], 7);
    const second = upsertAttendance([
      { date: "2026-09-20", siteId: 1, labourId: 1, status: "Half Day", checkIn: "08:00", checkOut: "12:00", remarks: "left early" },
      { date: "2026-09-20", siteId: 1, labourId: 2, status: "Absent", checkIn: "", checkOut: "", remarks: "no show" }
    ], 9);
    const rows = ATTENDANCE.filter(a => a.date === "2026-09-20").sort((a, b) => a.labourId - b.labourId);
    return { original, first, second, count: ATTENDANCE.length, rows };
  })()`);
  assert.deepStrictEqual(result.first, { added: 1, updated: 0 });
  assert.deepStrictEqual(result.second, { added: 1, updated: 1 });
  assert.strictEqual(result.count, result.original + 2);
  assert.deepStrictEqual(result.rows.map((row) => ({ labourId: row.labourId, status: row.status, checkOut: row.checkOut, markedBy: row.markedBy, remarks: row.remarks })), [
    { labourId: 1, status: "Half Day", checkOut: "12:00", markedBy: 9, remarks: "left early" },
    { labourId: 2, status: "Absent", checkOut: "", markedBy: 9, remarks: "no show" }
  ]);
});

test("markableLabour returns only active approved labour mapped to the requested site", () => {
  const get = loadCtx();
  assert.deepStrictEqual(json(get, "markableLabour(1).map(l => l.id)"), [1, 2, 5, 8]);
  assert.deepStrictEqual(json(get, "markableLabour(3).map(l => l.id)"), [6]);
  assert.deepStrictEqual(json(get, "markableLabour(2).map(l => l.id)"), []);
  assert.ok(!json(get, "markableLabour(1).map(l => l.id)").includes(3), "unmapped, pending Manoranjan must not be markable");
});
