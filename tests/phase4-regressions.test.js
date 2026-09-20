const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const ctx = vm.createContext({ console });
  const run = (code) => vm.runInContext(code, ctx);
  for (const file of ['data.js', 'core/store.js', 'core/auth.js', 'core/ui.js', 'core/mapping.js', 'core/approvals.js', 'pages/approvals.js', 'pages/attendance.js']) {
    run(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  }
  run(`
    globalThis.state = { currentUserId: 2, deptId: 1, approvalEdit: 9 };
    globalThis.currentUser = () => USERS.find(u => u.id === state.currentUserId);
    globalThis.scopedSiteIds = () => Auth.scopeSiteIds(currentUser(), state.deptId);
    globalThis.byId = (rows, id) => rows.find(r => r.id === id);
    globalThis.esc = UI.esc;
    globalThis.labourName = id => byId(LABOUR, id)?.name || 'Unknown';
    globalThis.siteName = id => byId(SITES, id)?.name || 'Unknown';
    globalThis.userName = id => byId(USERS, id)?.name || 'Unknown';
    globalThis.nowStamp = () => '2026-09-20 10:00';
    globalThis.toasts = [];
    globalThis.showToast = msg => toasts.push(msg);
    globalThis.render = () => {};
    globalThis.can = () => true;
    globalThis.modalHtml = '';
    globalThis.openModal = (title, html) => { modalHtml = html; };
    globalThis.document = { getElementById: () => ({ addEventListener() {} }) };
    UI.confirm = (message, callback) => { globalThis.confirmCallback = callback; };
    UI.tableHost = options => { globalThis.dailyRows = options.rows(); return ''; };
    attendanceViewState.date = '2026-09-15';
    attendanceViewState.month = '2026-09';
  `);
  return run;
}

test('retained attendance site is cleared after department and user scope changes', () => {
  const run = harness();
  run(`attendanceViewState.siteId = '3'`);
  assert.doesNotMatch(run('attendanceMonthlyHtml()'), /Chittaranjan Das/);
  assert.equal(run('attendanceViewState.siteId'), '');
  run(`attendanceViewState.siteId = '3'; showMarkAttendanceModal()`);
  assert.doesNotMatch(run('modalHtml'), /Chittaranjan Das/);
  run(`attendanceViewState.siteId = '3'; state.currentUserId = 6; attendanceDailyHtml()`);
  assert.equal(run('attendanceViewState.siteId'), '');
  assert.equal(run('dailyRows.some(r => r.siteId === 3)'), false);
  run('showMarkAttendanceModal({ siteId: 3 })');
  assert.doesNotMatch(run('modalHtml'), /Chittaranjan Das/);
});

test('monthly history retains inactive and unapproved labour while marking excludes them', () => {
  const run = harness();
  run(`byId(LABOUR, 1).active = false; byId(LABOUR, 2).approvalStatus = 'Rejected';
    ATTENDANCE.push({ id: 999, labourId: 1, siteId: 1, date: '2026-09-03', status: 'Present' });
    ATTENDANCE.push({ id: 1000, labourId: 2, siteId: 1, date: '2026-09-04', status: 'Half Day' });`);
  const html = run('attendanceMonthlyHtml()');
  assert.match(html, /Suresh Rout/);
  assert.match(html, /Bijay Kumar Sahoo/);
  assert.doesNotMatch(run('attendanceMarkRowsHtml(1, "2026-09-03")'), /Suresh Rout|Bijay Kumar Sahoo/);
});

function setForm(run, values) {
  run(`globalThis.errors = {}; globalThis.form = {
    elements: Object.fromEntries(Object.entries(${JSON.stringify(values)}).map(([k, value]) => [k, { value }])),
    querySelector: selector => errors[selector] ||= { textContent: '' }
  }; document.querySelector = () => form;`);
}

test('linked labour options and save validation reject a different site or department', () => {
  const run = harness();
  assert.doesNotMatch(run('approvalEditDetailsHtml({ siteId: 1, type: "Manpower Onboarding" }, true)'), /Chittaranjan Das/);
  setForm(run, { type: 'Manpower Onboarding', title: 'Test', description: 'Test', siteId: '1', labourId: '6' });
  run(`state.approvalEdit = 'new'; globalThis.before = APPROVAL_REQUESTS.length; saveApprovalRequest(false)`);
  assert.equal(run('APPROVAL_REQUESTS.length === before'), true);
  assert.match(run(`errors['[data-err="labourId"]'].textContent`), /labour/i);
});

test('approval editor hides request details, decisions and attachments outside selected department', () => {
  const run = harness();
  run(`byId(APPROVAL_REQUESTS, 9).attachments.push({ id: 1, name: 'private.pdf', dataUrl: 'data:private' }); state.deptId = 2`);
  assert.doesNotMatch(run('approvalEditHtml()'), /Scaffolding|private.pdf|Decision required|data-approval-form/);
  assert.equal(run('currentApprovalRequest()'), null);
  setForm(run, { type: 'General', title: 'Test', description: 'Test', siteId: '3' });
  run('globalThis.before = APPROVAL_REQUESTS.length; saveApprovalRequest(false)');
  assert.equal(run('APPROVAL_REQUESTS.length === before'), true);
});

test('decision confirmation rechecks selected department before mutating request', () => {
  const run = harness();
  run(`decideApproval(9, 'approve'); state.deptId = 2; confirmCallback()`);
  assert.equal(run('byId(APPROVAL_REQUESTS, 9).status'), 'Pending');
  run(`globalThis.confirmCallback = null; decideApproval(9, 'approve')`);
  assert.equal(run('confirmCallback'), null);
});

test('multi-department requester cannot open or act on an own request outside the selected department', () => {
  const run = harness();
  run(`state.currentUserId = 7; state.deptId = 2;
    byId(APPROVAL_REQUESTS, 9).status = 'Review Requested';
    byId(APPROVAL_REQUESTS, 9).attachments.push({ id: 1, name: 'private.pdf', dataUrl: 'data:private' });`);
  assert.equal(run('currentApprovalRequest()'), null);
  assert.doesNotMatch(run('approvalEditHtml()'), /private.pdf|data-approval-form|Resubmit/);
  run(`globalThis.confirmCallback = null; resubmitApproval(9)`);
  assert.equal(run('confirmCallback'), null);
  run(`decideApproval(9, 'approve')`);
  assert.equal(run('confirmCallback'), null);
  run(`state.deptId = 1`);
  assert.equal(run('currentApprovalRequest().id'), 9);
});

test('requester resubmission rechecks selected department after confirmation opens', () => {
  const run = harness();
  run(`state.currentUserId = 7; byId(APPROVAL_REQUESTS, 9).status = 'Review Requested';
    resubmitApproval(9); state.deptId = 2; confirmCallback('Updated')`);
  assert.equal(run('byId(APPROVAL_REQUESTS, 9).status'), 'Review Requested');
});

test('attachment persistence failure rolls back files and audit and displays inline error without success', async () => {
  const run = harness();
  run(`globalThis.storageData = new Map();
    Store.storage = { getItem: key => storageData.get(key) ?? null, setItem(key, value) {
      if (key.endsWith('APPROVAL_REQUESTS') && JSON.parse(value).find(r => r.id === 9).attachments.length > 0) throw Error('Quota exceeded');
      storageData.set(key, value);
    }, removeItem: key => storageData.delete(key) };
    Store.save(); globalThis.beforeAudit = AUDIT_LOG.length;
    globalThis.approvalReadFile = async () => 'data:application/pdf;base64,QQ==';
    globalThis.render = () => { globalThis.rendered = approvalAttachmentsHtml(currentApprovalRequest(), true); Store.save(); };
  `);
  await run(`addApprovalFiles([{ name: 'quote.pdf', type: 'application/pdf', size: 10 }])`);
  assert.equal(run('byId(APPROVAL_REQUESTS, 9).attachments.length'), 0);
  assert.equal(run('AUDIT_LOG.length === beforeAudit'), true);
  assert.equal(run('toasts.some(t => /added/.test(t))'), false);
  assert.match(run('rendered'), /could not.*save|unable.*save|storage/i);
});
