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
const runR = (values, id) => JSON.parse(get(`JSON.stringify(validateRoleForm(${v(values)}, ${id === undefined ? "null" : id}))`));
const okR = { name: "Site Supervisor", level: "3", perms: ["markAttendance"] };
test("role: valid values -> no errors", () => assert.deepStrictEqual(runR(okR), {}));
test("role: name required", () => assert.ok(runR({ ...okR, name: "  " }).name));
test("role: name unique case-insensitively, own record excluded", () => {
  assert.ok(runR({ ...okR, name: "super admin" }).name);
  assert.deepStrictEqual(runR({ ...okR, name: "SUPER ADMIN", level: "0" }, 0), {});
});
test("role: level must be integer 0-3", () => {
  assert.ok(runR({ ...okR, level: "" }).level);
  assert.ok(runR({ ...okR, level: "4" }).level);
  assert.ok(runR({ ...okR, level: "-1" }).level);
  assert.ok(runR({ ...okR, level: "1.5" }).level);
  assert.deepStrictEqual(runR({ ...okR, level: 0 }), {});
});
test("role: roleMatches searches name, level and permission labels", () => {
  const m = (q) => get(`roleMatches(ROLES.find((r) => r.id === 4), ${v(q)})`);
  assert.strictEqual(m("engineer"), true);
  assert.strictEqual(m("l3"), true);
  assert.strictEqual(m("mark attend"), true);
  assert.strictEqual(m("zzz"), false);
  assert.strictEqual(m(""), true);
});
test("mobile: pasted +91 / 0-prefixed formats normalise", () => {
  const n = (x) => get(`normalizeUserMobile(${v(x)})`);
  assert.strictEqual(n("+91 98765 00002"), "9876500002");
  assert.strictEqual(n("098765 00002"), "9876500002");
  assert.strictEqual(n(" 98765-00002 "), "9876500002");
  assert.deepStrictEqual(run({ ...ok, mobile: "+91 90000 00001" }), {});
  assert.ok(run({ ...ok, mobile: "+91 900" }).mobile);
});
test("email: optional, simple format check", () => {
  assert.deepStrictEqual(run({ ...ok, email: "" }), {});
  assert.deepStrictEqual(run({ ...ok, email: "a@b.co" }), {});
  assert.ok(run({ ...ok, email: "not-an-email" }).email);
  assert.ok(run({ ...ok, email: "a b@c.d" }).email);
});
const lock = (values, editing, cur) => get(`userSelfLockout(${v(values)}, ${editing}, ${cur})`);
test("self-lockout: only when editing the signed-in user", () => {
  assert.strictEqual(lock({ roleId: 4 }, 7, 0), null);              // editing someone else
  assert.strictEqual(lock({ roleId: 4 }, null, 0), null);           // new user
  assert.strictEqual(lock({ roleId: "0" }, 0, 0), null);            // Super Admin keeps access
  assert.strictEqual(lock({ roleId: 4 }, 0, 0), "You would lock yourself out");   // level 3
  assert.strictEqual(lock({ roleId: 2 }, 0, 0), "You would lock yourself out");   // level 2
  assert.strictEqual(lock({ roleId: "" }, 0, 0), "You would lock yourself out");   // no role
});
test("self-lockout: role without addEditUsers or inactive is refused", () => {
  const r = get(`(ROLES.push({ id: 90, name: "L1 noperm", level: 1, perms: [], active: true }),
    ROLES.push({ id: 91, name: "L1 off", level: 1, perms: ["addEditUsers"], active: false }),
    [userSelfLockout({ roleId: 90 }, 0, 0), userSelfLockout({ roleId: 91 }, 0, 0)])`);
  assert.deepStrictEqual([...r], ["You would lock yourself out", "You would lock yourself out"]);
  get("ROLES.splice(ROLES.length - 2, 2)");
});
test("role level change: lists active admins that would lose sign-in", () => {
  const r = JSON.parse(get(`(ROLES.push({ id: 95, name: "Tmp", level: 1, perms: [], active: true }),
    USERS.push({ id: 900, name: "NoDept <b>", mobile: "9111111111", roleId: 95, departmentIds: [], siteIds: [], active: true }),
    USERS.push({ id: 901, name: "HasDept", mobile: "9111111112", roleId: 95, departmentIds: [1], siteIds: [], active: true }),
    USERS.push({ id: 902, name: "Inactive", mobile: "9111111113", roleId: 95, departmentIds: [], siteIds: [], active: false }),
    JSON.stringify([roleLevelLockouts(ROLES.find((x) => x.id === 95), 2), roleLevelLockouts(ROLES.find((x) => x.id === 95), 1)]))`));
  assert.deepStrictEqual(r, [["NoDept <b>"], []]);
  get("USERS.splice(USERS.length - 3, 3); ROLES.splice(ROLES.length - 1, 1)");
});
console.log(`${passed} passed`);
