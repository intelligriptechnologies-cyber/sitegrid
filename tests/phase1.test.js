const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
           removeItem: (k) => m.delete(k), keys: () => [...m.keys()] };
}
function loadCtx(files) {
  const ctx = vm.createContext({ localStorage: fakeStorage(), sessionStorage: fakeStorage(), console });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  return { ctx, get: (expr) => vm.runInContext(expr, ctx) };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("ok  - " + name); } catch (e) { console.error("FAIL- " + name + "\n" + e.stack); process.exitCode = 1; } }

const FILES = ["data.js", "core/store.js", "core/auth.js"].filter((f) => fs.existsSync(path.join(root, f)));

test("seed: every user has departmentIds, none has departmentId", () => {
  const { get } = loadCtx(["data.js"]);
  assert.strictEqual(get("USERS.every(u => Array.isArray(u.departmentIds) && !('departmentId' in u))"), true);
  assert.strictEqual(get("USERS.filter(u => u.roleId >= 2).every(u => u.departmentIds.length >= 1)"), true);
  assert.strictEqual(get("USERS.filter(u => u.roleId <= 1).every(u => u.departmentIds.length === 0)"), true);
  assert.strictEqual(get("USERS.some(u => u.departmentIds.length > 1)"), true, "need one multi-dept demo user");
});

test("store: save then load restores mutated rows in place", () => {
  const { get } = loadCtx(["data.js", "core/store.js"]);
  get("Store.save()");
  get("USERS[0].name = 'Changed'; USERS.push({id: 99, name: 'Temp'})");
  get("Store.save()");
  get("USERS[0].name = 'Other'; USERS.length = 1");
  assert.strictEqual(get("Store.load()"), true);
  assert.strictEqual(get("USERS[0].name"), "Changed");
  assert.strictEqual(get("USERS.some(u => u.id === 99)"), true);
});

test("store: works without storage", () => {
  const { get } = loadCtx(["data.js", "core/store.js"]);
  get("Store.storage = null");
  assert.strictEqual(get("Store.save()"), false);
  assert.strictEqual(get("Store.load()"), false);
});

test("store: reset clears keys", () => {
  const { get, ctx } = loadCtx(["data.js", "core/store.js"]);
  get("Store.save()");
  assert.ok(ctx.localStorage.keys().length > 0);
  get("Store.reset(false)");
  assert.strictEqual(ctx.localStorage.keys().length, 0);
});

function auth() { return loadCtx(FILES); }

test("auth: unknown mobile denied with exact message", () => {
  const { get } = auth();
  assert.deepStrictEqual(JSON.parse(get("JSON.stringify(Auth.requestOtp('9999999999'))")), { ok: false, error: "Contact Admin to configure access" });
});
test("auth: malformed / empty mobile denied", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.requestOtp('123').ok"), false);
  assert.strictEqual(get("Auth.requestOtp('').ok"), false);
});
test("auth: inactive user denied", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.requestOtp('9876500009').error"), "Contact Admin to configure access");
});
test("auth: non-admin without department denied", () => {
  const { get } = auth();
  get("USERS.find(u => u.id === 6).departmentIds = []");
  assert.strictEqual(get("Auth.requestOtp('9876500006').error"), "Contact Admin to configure access");
});
test("auth: +91 / spaced formats normalise", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.requestOtp('+91 98765 00002').ok"), true);
});
test("auth: wrong OTP rejected, 1111 accepted", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.verifyOtp('9876500002','0000').error"), "Invalid OTP");
  assert.strictEqual(get("Auth.verifyOtp('9876500002','1111').user.id"), 2);
});
test("auth: verifyOtp also denies unregistered numbers", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.verifyOtp('9999999999','1111').error"), "Contact Admin to configure access");
});
test("dept: admin/owner get all active departments, default null (All)", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.allowedDepartments(USERS[0]).length"), 3);
  assert.strictEqual(get("Auth.defaultDept(USERS[1])"), null);
});
test("dept: single-dept user auto-selects it; multi-dept user defaults to first", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.allowedDepartments(USERS.find(u=>u.id===3)).length"), 1);
  assert.strictEqual(get("Auth.defaultDept(USERS.find(u=>u.id===3))"), 1);
  assert.strictEqual(get("Auth.allowedDepartments(USERS.find(u=>u.id===7)).length"), 2);
  assert.strictEqual(get("Auth.defaultDept(USERS.find(u=>u.id===7))"), 1);
});
test("scope: admin All sees every site; picking a dept narrows it", () => {
  const { get } = auth();
  assert.strictEqual(get("Auth.scopeSiteIds(USERS[0], null).length"), 5);
  assert.strictEqual(get("JSON.stringify(Auth.scopeSiteIds(USERS[0], 2))"), "[2,3]");
});
test("scope: dept head sees only own dept sites", () => {
  const { get } = auth();
  assert.strictEqual(get("JSON.stringify(Auth.scopeSiteIds(USERS.find(u=>u.id===3), 1))"), "[1,5]");
});
test("scope: multi-dept engineer follows selected dept and assigned sites", () => {
  const { get } = auth();
  assert.strictEqual(get("JSON.stringify(Auth.scopeSiteIds(USERS.find(u=>u.id===7), 1))"), "[1,5]");
  assert.strictEqual(get("JSON.stringify(Auth.scopeSiteIds(USERS.find(u=>u.id===7), 2))"), "[3]");
});
test("session: save/load/clear round-trip", () => {
  const { get } = auth();
  get("Session.save(7, 2)");
  assert.strictEqual(get("JSON.stringify(Session.load())"), '{"userId":7,"deptId":2}');
  get("Session.clear()");
  assert.strictEqual(get("Session.load()"), null);
});
test("store: non-array stored value is ignored, seed kept", () => {
  const { get, ctx } = loadCtx(["data.js", "core/store.js"]);
  const before = get("USERS.length");
  ctx.localStorage.setItem("sitegrid.v5.USERS", "{}");
  assert.strictEqual(get("Store.load()"), true);
  assert.strictEqual(get("USERS.length"), before);
});

test("roles: every role has perms array and active; PERM_KEYS/PERM_LABELS exported", () => {
  const { get } = auth();
  assert.strictEqual(get("ROLES.every(r => Array.isArray(r.perms) && r.active === true)"), true);
  assert.strictEqual(get("ROLES[0].perms.includes('addEditUsers')"), true);
  assert.strictEqual(get("ROLES[4].perms.includes('addEditUsers')"), false);
  assert.strictEqual(get("PERM_KEYS.every(k => typeof PERM_LABELS[k] === 'string' && PERM_LABELS[k].length > 0)"), true);
  assert.strictEqual(get("PERM_KEYS.length"), 11);
});
test("roles: new level-3 role is not all-dept and scopes by siteIds", () => {
  const { get } = auth();
  get("ROLES.push({id:5, name:'Foreman', level:3, perms:['addSite'], active:true})");
  get("USERS.push({id:50, name:'F', mobile:'9000000050', departmentIds:[1], roleId:5, active:true, siteIds:[5]})");
  assert.strictEqual(get("Auth.isAllDeptRole(USERS.find(u=>u.id===50))"), false);
  assert.strictEqual(get("Auth.roleLevel(USERS.find(u=>u.id===50))"), 3);
  assert.strictEqual(get("JSON.stringify(Auth.scopeSiteIds(USERS.find(u=>u.id===50), null))"), "[5]");
});
test("roles: new level-1 role makes user all-dept; level-2 role scopes by department", () => {
  const { get } = auth();
  get("ROLES.push({id:6, name:'Director', level:1, perms:[], active:true})");
  get("ROLES.push({id:7, name:'Dept Lead', level:2, perms:[], active:true})");
  get("USERS.push({id:51, name:'D', mobile:'9000000051', departmentIds:[], roleId:6, active:true, siteIds:[]})");
  get("USERS.push({id:52, name:'L', mobile:'9000000052', departmentIds:[1], roleId:7, active:true, siteIds:[]})");
  assert.strictEqual(get("Auth.isAllDeptRole(USERS.find(u=>u.id===51))"), true);
  assert.strictEqual(get("Auth.requestOtp('9000000051').ok"), true);
  assert.strictEqual(get("JSON.stringify(Auth.scopeSiteIds(USERS.find(u=>u.id===52), null))"), "[1,5]");
});
test("roles: sign-in requires an existing, active role", () => {
  const { get } = auth();
  get("ROLES.find(r => r.id === 2).active = false");
  assert.strictEqual(get("Auth.requestOtp('9876500003').ok"), false);
  get("ROLES.find(r => r.id === 2).active = true");
  assert.strictEqual(get("Auth.requestOtp('9876500003').ok"), true);
  get("USERS.find(u => u.id === 3).roleId = 99");
  assert.strictEqual(get("Auth.requestOtp('9876500003').ok"), false);
});

console.log(`${passed} passed`);
