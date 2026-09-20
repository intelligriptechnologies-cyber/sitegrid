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
const load = () => loadCtx(["data.js", "core/store.js", "core/auth.js", "core/mapping.js"]);
const J = (x) => JSON.stringify(x);

test("seed has LABOUR_SITES and BIOMETRICS; tables registered in Store", () => {
  const { get } = load();
  assert.ok(get("LABOUR_SITES.length") > 0);
  assert.strictEqual(get("BIOMETRICS.length"), 0);
  const names = get("Object.keys(Store.tables())");
  assert.ok(names.includes("LABOUR_SITES") && names.includes("BIOMETRICS"));
});

// NOTE: tables missing from an old storage snapshot are simply skipped by Store.load (raw === null),
// so they load as seed; hence Store.PREFIX is intentionally not bumped.
test("old storage without the new tables loads them as seed", () => {
  const { get } = load();
  get("Store.storage.setItem(Store.PREFIX + 'SITES', JSON.stringify(SITES))");
  get("Store.load()");
  assert.ok(get("LABOUR_SITES.length") > 0);
});

test("labourSiteIds: Dilip in 5 then 1; each seeded site matches", () => {
  const { get } = load();
  assert.strictEqual(J(get("labourSiteIds(5)")), "[5,1]");
  assert.strictEqual(J(get("labourSiteIds(1)")), "[1]");
});

test("isUnmapped: Manoranjan (3) unmapped with null siteId", () => {
  const { get } = load();
  assert.strictEqual(get("isUnmapped(3)"), true);
  assert.strictEqual(get("isUnmapped(1)"), false);
  assert.strictEqual(get("LABOUR.find(l=>l.id===3).siteId"), null);
});

test("siteLabourIds", () => {
  const { get } = load();
  const ids = get("siteLabourIds(1)");
  assert.ok(ids.includes(5) && ids.includes(1) && ids.includes(2) && ids.includes(8));
});

test("mapLabourToSites sets primary and rows; empty makes unmapped", () => {
  const { get } = load();
  get("mapLabourToSites(3,[2,4])");
  assert.strictEqual(get("LABOUR.find(l=>l.id===3).siteId"), 2);
  assert.strictEqual(get("LABOUR_SITES.filter(r=>r.labourId===3).length"), 2);
  assert.strictEqual(J(get("labourSiteIds(3)")), "[2,4]");
  get("mapLabourToSites(3,[])");
  assert.strictEqual(get("isUnmapped(3)"), true);
  assert.strictEqual(get("LABOUR.find(l=>l.id===3).siteId"), null);
  // unique row ids
  const ids = get("LABOUR_SITES.map(r=>r.id)");
  assert.strictEqual(new Set(ids).size, ids.length);
});

test("setSiteLabour replaces the site set and re-syncs primary siteIds", () => {
  const { get } = load();
  // site 1 seed: 1,2,5,8 -> set [1,2]: adds none new to 1,2 (already), removes 5 and 8... plus add labour 6
  const r = get("setSiteLabour(1,[1,2,6])");
  assert.strictEqual(r.added, 1);
  assert.strictEqual(r.removed, 2);
  assert.strictEqual(J(get("siteLabourIds(1)").sort()), "[1,2,6]");
  // labour 8 had only site 1 -> now unmapped, siteId null
  assert.strictEqual(get("isUnmapped(8)"), true);
  assert.strictEqual(get("LABOUR.find(l=>l.id===8).siteId"), null);
  // labour 5 lost site 1 but keeps 5 -> primary 5
  assert.strictEqual(get("LABOUR.find(l=>l.id===5).siteId"), 5);
  // labour 6 now has [3,1]; primary is first mapped
  assert.strictEqual(J(get("labourSiteIds(6)")), "[3,1]");
  assert.strictEqual(get("LABOUR.find(l=>l.id===6).siteId"), 3);
});

test("biometricHash deterministic and distinct", () => {
  const { get } = load();
  assert.strictEqual(get("biometricHash('data:image/png;base64,AAAA')"), get("biometricHash('data:image/png;base64,AAAA')"));
  assert.notStrictEqual(get("biometricHash('data:image/png;base64,AAAA')"), get("biometricHash('data:image/png;base64,AAAB')"));
  assert.match(get("biometricHash('x')"), /^[0-9a-f]+$/);
});

test("findBiometricDuplicate needs hash AND data URL equal; respects exceptId", () => {
  const { get } = load();
  get("BIOMETRICS.push({id:1,labourId:2,label:'Right thumb',imageDataUrl:'d',hash:'abc',capturedOn:'2026-09-20'})");
  const d = get("findBiometricDuplicate('abc','d')");
  assert.strictEqual(d.labour.id, 2);
  assert.strictEqual(d.biometric.id, 1);
  assert.strictEqual(get("findBiometricDuplicate('abc','other')"), null);
  assert.strictEqual(get("findBiometricDuplicate('abc','d',1)"), null);
  assert.strictEqual(get("findBiometricDuplicate('zzz','d')"), null);
});

test("seed LABOUR has createdBy from onboarding request", () => {
  const { get } = load();
  assert.strictEqual(get("LABOUR.find(l=>l.id===3).createdBy"), 8);
  assert.strictEqual(get("LABOUR.every(l=>l.createdBy!=null)"), true);
});

test("scopedSiteNames hides out-of-scope names and counts them", () => {
  const { get } = load();
  // Dilip (5) is on sites 5 and 1
  assert.strictEqual(get("scopedSiteNames(5,[1,5]).includes('+')"), false);
  const one = get("scopedSiteNames(5,[1])");
  assert.ok(one.endsWith(" +1 other") && one.startsWith(get("SITES.find(s=>s.id===1).name")));
  assert.strictEqual(get("scopedSiteNames(5,[2])"), "+2 other");
  assert.strictEqual(get("scopedSiteNames(3,[1,2])"), "Unmapped");
});

test("labourVisible: mapped in/out of scope; unmapped rule by role/creator/dept", () => {
  const { get } = load();
  // L3 = Project Manager (roleId 3); admin roleId 0; dept head roleId 2
  get("var u3={id:7,roleId:3}, u0={id:1,roleId:0}, u2={id:3,roleId:2}, uo={id:9,roleId:3}");
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===1),u3,[1],1)"), true);
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===1),u3,[2],1)"), false);
  // labour 3 unmapped, createdBy 8
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===3),{id:8,roleId:3},[],1)"), true);
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===3),u3,[1],1)"), false);
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===3),u2,[1],1)"), true);
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===3),u0,[1],null)"), true);
  assert.strictEqual(get("labourVisible(LABOUR.find(l=>l.id===3),u0,[1],1)"), false);
  assert.strictEqual(get("labourVisible(null,u0,[1],null)"), false);
});

console.log(passed + " passed");
