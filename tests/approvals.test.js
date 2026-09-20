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

const get = loadCtx(["data.js", "core/store.js", "core/auth.js", "core/approvals.js"]);
const J = (expr) => JSON.parse(get(`JSON.stringify(${expr})`));
const U = (id) => `USERS.find(u=>u.id===${id})`;
const R = (id) => `APPROVAL_REQUESTS.find(r=>r.id===${id})`;
const ids = (user, dept) => J(`Approvals.visibleRequests(${U(user)}, ${dept}).map(r=>r.id)`).sort((a, b) => a - b);
const NOW = "2026-09-20 10:00";
const sorted = (a) => a.sort((x, y) => x - y);

test("prefix is v3", () => assert.strictEqual(get("Store.PREFIX"), "sitegrid.v3."));

test("every seed request has the new shape", () => {
  const rows = J("APPROVAL_REQUESTS");
  assert.ok(rows.length >= 12);
  for (const r of rows) {
    assert.ok(r.type && r.title, "type/title " + r.id);
    assert.ok("siteId" in r && "labourId" in r && "amount" in r, "fields " + r.id);
    assert.ok(Array.isArray(r.attachments) && Array.isArray(r.history) && r.history.length >= 1, "arrays " + r.id);
    assert.ok(J("REQUEST_TYPES").includes(r.type) && J("REQUEST_STATUSES").includes(r.status));
  }
  assert.strictEqual(rows.filter((r) => r.type === "Manpower Onboarding").length, 8);
});

test("visibility: L3 own only; L2 own department; L1 dept dropdown", () => {
  assert.deepStrictEqual(ids(7, null), [1, 2, 5, 8, 9, 11]);
  assert.deepStrictEqual(ids(7, 2), [1, 2, 5, 8, 9, 11]); // L3 ignores dropdown
  const civil = ids(3, null);
  assert.deepStrictEqual(civil, [1, 2, 5, 8, 9, 11, 12]);
  assert.ok(!civil.includes(6) && !civil.includes(10));
  assert.strictEqual(ids(2, null).length, 12);
  assert.deepStrictEqual(ids(2, 2), [4, 6, 10]);
});

test("showActionColumn / canAdd", () => {
  assert.strictEqual(get(`Approvals.showActionColumn(${U(7)})`), false);
  assert.strictEqual(get(`Approvals.showActionColumn(${U(3)})`), true);
  assert.strictEqual(get(`Approvals.canAdd(${U(7)})`), true);
  assert.strictEqual(get(`Approvals.canAdd(null)`), false);
});

test("canEdit", () => {
  assert.strictEqual(get(`Approvals.canEdit(${U(7)}, ${R(9)})`), true);
  assert.strictEqual(get(`Approvals.canEdit(${U(7)}, ${R(11)})`), false); // Approved
  assert.strictEqual(get(`Approvals.canEdit(${U(6)}, ${R(9)})`), false); // not requester
  assert.strictEqual(get(`Approvals.canEdit(${U(2)}, ${R(9)})`), true); // admin
});

test("canDecide", () => {
  assert.strictEqual(get(`Approvals.canDecide(${U(3)}, ${R(9)})`), true);
  assert.strictEqual(get(`Approvals.canDecide(${U(3)}, ${R(11)})`), false); // Approved
  assert.strictEqual(get(`Approvals.canDecide(${U(7)}, ${R(9)})`), false); // no perm
  assert.strictEqual(get(`Approvals.canDecide(${U(4)}, ${R(9)})`), false); // out of dept scope
  assert.strictEqual(get(`Approvals.canDecide(${U(3)}, {id:99,status:"Pending",requestedBy:3,siteId:1})`), false); // own
  assert.strictEqual(get(`Approvals.canDecide(${U(2)}, ${R(10)})`), false); // Review Requested
});

test("decide approve on labour-linked request activates labour", () => {
  const r = J(`(() => { const x = Approvals.decide(${R(3)}, "approve", ${U(2)}, "", "${NOW}");
    return { x, req: ${R(3)}, l: LABOUR.find(l=>l.id===3) }; })()`);
  assert.strictEqual(r.x.ok, true);
  assert.strictEqual(r.req.status, "Approved");
  assert.strictEqual(r.req.approvedBy, 2);
  assert.strictEqual(r.req.decisionDate, NOW);
  assert.strictEqual(r.l.approvalStatus, "Approved");
  assert.strictEqual(r.l.active, true);
  const h = r.req.history;
  assert.deepStrictEqual(h[h.length - 1], { at: NOW, by: 2, action: "Approved", remark: "" });
});

test("reject and review require a remark; reject deactivates labour", () => {
  assert.strictEqual(get(`Approvals.decide(${R(7)}, "reject", ${U(2)}, "  ", "${NOW}").ok`), false);
  assert.strictEqual(get(`Approvals.decide(${R(9)}, "review", ${U(3)}, "", "${NOW}").ok`), false);
  assert.strictEqual(get(`${R(7)}.status`), "Pending");
  const r = J(`(() => { const x = Approvals.decide(${R(7)}, "reject", ${U(2)}, "Bad docs", "${NOW}");
    return { x, req: ${R(7)}, l: LABOUR.find(l=>l.id===7) }; })()`);
  assert.strictEqual(r.x.ok, true);
  assert.strictEqual(r.req.status, "Rejected");
  assert.strictEqual(r.req.rejectionReason, "Bad docs");
  assert.strictEqual(r.l.approvalStatus, "Rejected");
  assert.strictEqual(r.l.active, false);
  assert.strictEqual(r.l.rejectionReason, "Bad docs");
});

test("decide refuses own request and unknown action", () => {
  assert.strictEqual(get(`Approvals.decide({id:98,status:"Pending",requestedBy:3,siteId:1,history:[]}, "approve", ${U(3)}, "", "${NOW}").ok`), false);
  assert.strictEqual(get(`Approvals.decide(${R(9)}, "bogus", ${U(3)}, "x", "${NOW}").ok`), false);
});

test("review then resubmit by requester; not by others", () => {
  assert.strictEqual(get(`Approvals.decide(${R(9)}, "review", ${U(3)}, "Add quote", "${NOW}").ok`), true);
  assert.strictEqual(get(`${R(9)}.status`), "Review Requested");
  assert.strictEqual(get(`Approvals.resubmit(${R(9)}, ${U(6)}, "", "${NOW}").ok`), false);
  assert.strictEqual(get(`Approvals.resubmit(${R(9)}, ${U(7)}, "Quote added", "${NOW}").ok`), true);
  assert.strictEqual(get(`${R(9)}.status`), "Resubmitted");
  assert.strictEqual(get(`${R(9)}.history.slice(-1)[0].action`), "Resubmitted");
  assert.strictEqual(get(`Approvals.resubmit(${R(9)}, ${U(7)}, "", "${NOW}").ok`), false); // now Resubmitted
  assert.strictEqual(get(`Approvals.canDecide(${U(3)}, ${R(9)})`), true);
});

test("attachment rules", () => {
  const add = (n) => J(`Approvals.addAttachment(${R(10)}, {name:"f${n}.pdf",type:"application/pdf",size:1000,dataUrl:"data:x"}, ${U(8)}, "${NOW}")`);
  for (let i = 1; i <= 5; i++) assert.strictEqual(add(i).ok, true, "file " + i);
  assert.strictEqual(add(6).ok, false);
  assert.strictEqual(get(`${R(10)}.attachments.length`), 5);
  assert.strictEqual(new Set(J(`${R(10)}.attachments.map(a=>a.id)`)).size, 5);
  const ok = `{name:"a.png",type:"image/png",size:10,dataUrl:"d"}`;
  assert.strictEqual(get(`Approvals.addAttachment(${R(12)}, ${ok}, ${U(6)}, "${NOW}").ok`), true);
  assert.strictEqual(get(`Approvals.addAttachment(${R(12)}, {name:"big.png",type:"image/png",size:1048577,dataUrl:"d"}, ${U(6)}, "${NOW}").ok`), false);
  assert.strictEqual(get(`Approvals.addAttachment(${R(12)}, {name:"x.exe",type:"application/x-msdownload",size:10,dataUrl:"d"}, ${U(6)}, "${NOW}").ok`), false);
  assert.strictEqual(get(`Approvals.addAttachment(${R(12)}, ${ok}, ${U(7)}, "${NOW}").ok`), false); // not requester
  assert.strictEqual(get(`Approvals.addAttachment(${R(11)}, ${ok}, ${U(7)}, "${NOW}").ok`), false); // Approved
});

test("removeAttachment", () => {
  const id = get(`${R(10)}.attachments[0].id`);
  assert.strictEqual(get(`Approvals.removeAttachment(${R(10)}, ${id}, ${U(7)}).ok`), false);
  assert.strictEqual(get(`Approvals.removeAttachment(${R(10)}, ${id}, ${U(8)}).ok`), true);
  assert.strictEqual(get(`${R(10)}.attachments.length`), 4);
});

test("filter combos", () => {
  const f = (o) => sorted(J(`Approvals.filter(APPROVAL_REQUESTS, ${JSON.stringify(o)}).map(r=>r.id)`));
  assert.deepStrictEqual(f({ status: "Approved" }), [1, 2, 3, 5, 6, 8, 11]); // 3 approved earlier in this file
  assert.deepStrictEqual(f({ requestedBy: "8", siteId: "3" }), [6, 10]);
  assert.deepStrictEqual(f({ q: "cable" }), [10]);
  assert.deepStrictEqual(f({ q: "petty", requestedBy: 8 }), [10]);
  assert.deepStrictEqual(f({ q: "kalinga it" }), [6, 10]);
  assert.strictEqual(f({}).length, 12);
  assert.strictEqual(f({ status: "", siteId: "", q: "" }).length, 12);
});
