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

const get = loadCtx(["data.js", "core/store.js", "core/ui.js", "core/auth.js", "core/mapping.js", "pages/manpower.js"]);
const J = (expr) => JSON.parse(get(`JSON.stringify(${expr})`));
const ok = { name: "Test Worker", aadhaar: "999988887777", phone: "9556100099", skill: "Mason", wageRate: 700 };
const run = (v, id) => J(`validateLabourForm(${JSON.stringify(v)}, ${id === undefined ? "null" : id})`);

test("valid values -> no errors", () => assert.deepStrictEqual(run(ok), {}));
test("name and skill required", () => {
  assert.ok(run({ ...ok, name: " " }).name);
  assert.ok(run({ ...ok, skill: "" }).skill);
});
test("aadhaar must be 12 digits", () => {
  assert.ok(run({ ...ok, aadhaar: "12345" }).aadhaar);
  assert.ok(run({ ...ok, aadhaar: "23456789012a" }).aadhaar);
  assert.ok(run({ ...ok, aadhaar: "" }).aadhaar);
});
test("aadhaar duplicate vs non-rejected others, message preserved", () => {
  assert.match(run({ ...ok, aadhaar: "234567890124" }).aadhaar, /Duplicate Aadhaar — already registered as Bijay Kumar Sahoo \(Labour ID 2\)\./);
  assert.deepStrictEqual(run({ ...ok, aadhaar: "234567890124" }, 2), {}); // editing self
  // labour 4 (rejected) shares 234567890123 with labour 1; labour 4 itself is rejected so ignored as a duplicate source
  assert.deepStrictEqual(J(`(LABOUR.push({id:99,name:"R",aadhaar:"111122223333",approvalStatus:"Rejected"}), validateLabourForm(${JSON.stringify({ ...ok, aadhaar: "111122223333" })}, null))`), {});
});
test("phone must be 10 digits", () => {
  assert.ok(run({ ...ok, phone: "12345" }).phone);
  assert.ok(run({ ...ok, phone: "" }).phone);
});
test("wage must be > 0", () => {
  assert.ok(run({ ...ok, wageRate: "" }).wageRate);
  assert.ok(run({ ...ok, wageRate: 0 }).wageRate);
  assert.ok(run({ ...ok, wageRate: -5 }).wageRate);
});
test("filterManpower: none/active/site/unmapped and composition", () => {
  const ids = (o) => J(`filterManpower(LABOUR, ${JSON.stringify(o)}).map(l=>l.id)`);
  assert.strictEqual(ids({}).length, 9); // 8 seed + pushed test row
  assert.deepStrictEqual(ids({ unmappedOnly: true }).filter((i) => i !== 99), [3]);
  assert.deepStrictEqual(ids({ siteId: 1 }).sort(), [1, 2, 5, 8]);
  assert.deepStrictEqual(ids({ siteId: 1, activeOnly: true }).sort(), [1, 2, 5, 8]);
  assert.ok(ids({ activeOnly: true }).every((i) => J(`LABOUR.find(l=>l.id==${i}).active`)));
  assert.deepStrictEqual(ids({ siteId: 5 }), [5]);
  assert.deepStrictEqual(ids({ siteId: "" , activeOnly: false }).length, 9);
});
test("canDeleteLabour blocks attendance / wage / approval records", () => {
  assert.strictEqual(J("canDeleteLabour(1)").ok, false);   // attendance
  assert.match(J("canDeleteLabour(1)").reason, /attendance/i);
  assert.strictEqual(J("canDeleteLabour(3)").ok, false);   // approval record only
  assert.strictEqual(J("canDeleteLabour(3)").ok, false);
  assert.deepStrictEqual(J("canDeleteLabour(500)"), { ok: true, reason: "" });
});
test("deleteLabourRecords removes labour, mappings and biometrics", () => {
  get(`(LABOUR.push({id:500,name:"T",aadhaar:"1",approvalStatus:"Approved",active:true,siteId:null}), mapLabourToSites(500,[1,2]), BIOMETRICS.push({id:1,labourId:500,label:"a",imageDataUrl:"x",hash:"h",capturedOn:"d"}), deleteLabourRecords(500))`);
  assert.strictEqual(J("LABOUR.some(l=>l.id===500)"), false);
  assert.strictEqual(J("LABOUR_SITES.some(r=>r.labourId===500)"), false);
  assert.strictEqual(J("BIOMETRICS.length"), 0);
});
