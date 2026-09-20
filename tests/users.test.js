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
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("ok  - " + name); } catch (e) { console.error("FAIL- " + name + "\n" + e.stack); process.exitCode = 1; } }

const get = loadCtx(["data.js", "core/store.js", "core/ui.js", "core/auth.js", "pages/users.js"]);
const v = (o) => JSON.stringify(o);
const run = (values, id) => JSON.parse(get(`JSON.stringify(validateUserForm(${v(values)}, ${id === undefined ? "null" : id}))`));
const ok = { name: "Test User", mobile: "9000000001", roleId: 4, departmentIds: [1] };

test("valid values -> no errors", () => assert.deepStrictEqual(run(ok), {}));
test("mobile must be 10 digits", () => {
  assert.ok(run({ ...ok, mobile: "12345" }).mobile);
  assert.ok(run({ ...ok, mobile: "98765000011" }).mobile);
  assert.ok(run({ ...ok, mobile: "98765abcde" }).mobile);
});
test("duplicate mobile names the other user", () => {
  assert.strictEqual(run({ ...ok, mobile: "9876500002" }).mobile, "Mobile number already registered to Sunita Patnaik");
});
test("editing own record keeps its mobile without duplicate error", () => {
  assert.deepStrictEqual(run({ ...ok, mobile: "9876500007" }, 7), {});
  assert.ok(run({ ...ok, mobile: "9876500007" }, 8).mobile);
});
test("non-admin role needs a department", () => {
  assert.strictEqual(run({ ...ok, departmentIds: [] }).departmentIds, "Select at least one department — otherwise this user cannot sign in");
  assert.ok(run({ ...ok, roleId: 2, departmentIds: [] }).departmentIds);
});
test("admin/owner roles ignore departments", () => {
  assert.deepStrictEqual(run({ ...ok, roleId: 0, departmentIds: [] }), {});
  assert.deepStrictEqual(run({ ...ok, roleId: 1, departmentIds: [] }), {});
});
test("name and role required", () => {
  assert.ok(run({ ...ok, name: "  " }).name);
  assert.ok(run({ ...ok, roleId: "" }).roleId);
});
console.log(`${passed} passed`);
