/* ============================================================
   SITEGRID — demo application logic (vanilla JS, no build step)
   State seeded from data.js and persisted to localStorage via core/store.js.
   ============================================================ */

const state = {
  currentUserId: null,
  deptId: null,           // null = All Departments (admin/owner only)
  route: "dashboard",
  sidebarOpen: false,
};

/* ---------- lookups ---------- */
const byId = (arr, id) => arr.find((x) => x.id === id);
const userName = (id) => (byId(USERS, id) ? byId(USERS, id).name : "—");
const deptName = (id) => (byId(DEPARTMENTS, id) ? byId(DEPARTMENTS, id).name : "—");
const siteName = (id) => (byId(SITES, id) ? byId(SITES, id).name : "—");
const labourName = (id) => (byId(LABOUR, id) ? byId(LABOUR, id).name : "—");
const labourSiteNames = (id) => scopedSiteNames(id, scopedSiteIds());
const labourVisibleNow = (l) => labourVisible(l, currentUser(), scopedSiteIds(), state.deptId);
const labourInSites = (l, siteIds) => !!l && labourSiteIds(l.id).some((sid) => siteIds.includes(sid));
const roleName = (id) => (byId(ROLES, id) ? byId(ROLES, id).name : "—");
const clientName = (id) => (byId(CLIENTS, id) ? byId(CLIENTS, id).name : "—");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const currency = (n) => "Rs " + Number(n || 0).toLocaleString("en-IN");

function currentUser() { return byId(USERS, state.currentUserId); }
function currentRole() { return byId(ROLES, currentUser().roleId); }
function can(actionKey) {
  return ((currentRole() || {}).perms || []).includes(actionKey);
}

/* Sites/labour visible to the current user, based on role scope */
function scopedSiteIds() { return Auth.scopeSiteIds(currentUser(), state.deptId); }

/* ---------- navigation ---------- */
const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "01" },
  ]},
  { group: "Organisation", items: [
    { id: "departments", label: "Departments", icon: "02", adminOnly: true },
    { id: "users", label: "Users & Roles", icon: "03", adminOnly: true },
  ]},
  { group: "Operations", items: [
    { id: "sites", label: "Sites & Projects", icon: "04" },
    { id: "manpower", label: "Manpower", icon: "05" },
    { id: "approvals", label: "Approvals", icon: "06" },
    { id: "attendance", label: "Attendance", icon: "07" },
    { id: "wages", label: "Wages & Payments", icon: "08" },
    { id: "expenses", label: "Petty Expenses", icon: "09" },
    { id: "resources", label: "Tools & Safety", icon: "10" },
    { id: "materials", label: "Materials", icon: "11" },
  ]},
  { group: "Insight", items: [
    { id: "reports", label: "Reports", icon: "12" },
    { id: "audit", label: "Audit Log", icon: "13" },
  ]},
];

function badgeForNav(id) {
  if (id === "approvals") {
    const n = Approvals.visibleRequests(currentUser(), state.deptId).filter((a) => a.status === "Pending" || a.status === "Resubmitted").length;
    return n > 0 ? n : null;
  }
  if (id === "expenses") {
    const n = EXPENSES.filter((e) => e.approvedBy === null).length;
    return n > 0 ? n : null;
  }
  return null;
}

function navVisible(routeId) {
  const item = NAV.flatMap((g) => g.items).find((i) => i.id === routeId);
  if (!item) return false;
  return !item.adminOnly || Auth.isAllDeptRole(currentUser());
}

function renderNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  NAV.forEach((group) => {
    const visible = group.items.filter((i) => navVisible(i.id));
    if (!visible.length) return;
    const label = document.createElement("div");
    label.className = "nav-group-label";
    label.textContent = group.group;
    nav.appendChild(label);
    visible.forEach((item) => {
      const el = document.createElement("div");
      el.className = "nav-item" + (state.route === item.id ? " active" : "");
      const badge = badgeForNav(item.id);
      el.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>` +
        (badge ? `<span class="nav-badge">${badge}</span>` : "");
      el.onclick = () => { state.route = item.id; state.approvalEdit = null; state.sidebarOpen = false; render(); };
      nav.appendChild(el);
    });
  });
}

function renderDeptSwitch() {
  const u = currentUser();
  const sel = document.getElementById("deptSelect");
  const depts = Auth.allowedDepartments(u);
  const all = Auth.isAllDeptRole(u);
  sel.innerHTML = (all ? `<option value="">All Departments</option>` : "") +
    depts.map((d) => `<option value="${d.id}" ${d.id === state.deptId ? "selected" : ""}>${esc(d.name)}</option>`).join("");
  sel.value = state.deptId == null ? "" : String(state.deptId);
  if (sel.selectedIndex === -1) {
    state.deptId = Auth.defaultDept(u);
    sel.value = state.deptId == null ? "" : String(state.deptId);
  }
  sel.disabled = !all && depts.length <= 1;
  sel.onchange = (e) => { state.deptId = e.target.value === "" ? null : Number(e.target.value); Session.save(state.currentUserId, state.deptId); render(); };
  document.getElementById("userChip").textContent = `${u.name} · ${roleName(u.roleId)}`;
}

let storageWarned = false;
function warnStorage(ok) {
  if (ok || storageWarned) return;
  storageWarned = true;
  showToast("Storage unavailable — changes are session-only");
}

function showToast(msg, asText) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span class="toast-dot"></span><span></span>`;
  const span = t.lastElementChild;
  if (asText) span.textContent = msg; else span.innerHTML = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* Plain-text toast: msg is shown via textContent, never parsed as HTML. */
function showToastText(msg) {
  showToast(msg, true);
}

function accessDenied(action) {
  return `<div class="access-denied">
    <div class="code">ACCESS RESTRICTED</div>
    <div>${esc(currentRole().name)} does not have permission to ${action}.</div>
  </div>`;
}

/* ============================================================
   PAGE: DASHBOARD
   ============================================================ */
function pageDashboard() {
  const scoped = scopedSiteIds();
  const activeSites = SITES.filter((s) => scoped.includes(s.id) && s.status === "Active").length;
  const manpower = LABOUR.filter((l) => labourVisibleNow(l) && l.approvalStatus === "Approved").length;
  const pendingApprovals = Approvals.visibleRequests(currentUser(), state.deptId).filter((a) => (a.status === "Pending" || a.status === "Resubmitted") && (a.siteId == null || scoped.includes(a.siteId))).length;
  const today = "2026-09-16";
  const todayAttendance = ATTENDANCE.filter((a) => a.date === today && scoped.includes(a.siteId));
  const present = todayAttendance.filter((a) => a.status === "Present").length;
  const pendingWage = WAGES.filter((w) => scoped.includes(w.siteId) && w.status !== "Paid").reduce((s, w) => s + w.balancePayable, 0);
  const totalExpense = EXPENSES.filter((e) => scoped.includes(e.siteId)).reduce((s, e) => s + e.amount, 0);

  const deptSummary = DEPARTMENTS.filter((d) => state.deptId == null || d.id === state.deptId).map((d) => {
    const siteCount = SITES.filter((s) => s.departmentId === d.id).length;
    const labourCount = LABOUR.filter((l) => labourSiteIds(l.id).some((sid) => SITES.find((s) => s.id === sid && s.departmentId === d.id))).length;
    return { d, siteCount, labourCount };
  });

  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// COMMAND OVERVIEW</div>
        <div class="page-heading">Dashboard</div>
        <div class="page-sub">Signed in as ${esc(currentUser().name)} · ${esc(currentRole().name)}${state.deptId != null ? " · " + esc(deptName(state.deptId)) : ""}</div>
      </div>
    </div>

    <div class="grid cols-4">
      <div class="stat-card"><div class="stat-label">Active Sites</div><div class="stat-value">${activeSites}</div><div class="stat-note">of ${scoped.length} visible sites</div></div>
      <div class="stat-card"><div class="stat-label">Active Manpower</div><div class="stat-value">${manpower}</div><div class="stat-note">approved &amp; on record</div></div>
      <div class="stat-card"><div class="stat-label">Pending Approvals</div><div class="stat-value">${pendingApprovals}</div><div class="stat-note">labour onboarding queue</div></div>
      <div class="stat-card"><div class="stat-label">Present Today</div><div class="stat-value">${present}</div><div class="stat-note">of ${todayAttendance.length} marked on ${today}</div></div>
    </div>

    <div class="grid cols-2" style="margin-top:16px;">
      <div class="stat-card"><div class="stat-label">Wages Outstanding</div><div class="stat-value">${currency(pendingWage)}</div><div class="stat-note">pending + partially paid balance</div></div>
      <div class="stat-card"><div class="stat-label">Petty Expense (visible scope)</div><div class="stat-value">${currency(totalExpense)}</div><div class="stat-note">cumulative recorded spend</div></div>
    </div>

    <div class="panel" style="margin-top:22px;">
      <div class="panel-head"><div class="panel-title">Department Summary</div></div>
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Department</th><th>Head</th><th>Sites</th><th>Manpower</th></tr></thead>
          <tbody>
            ${deptSummary.map((r) => `<tr>
              <td>${esc(r.d.name)}</td>
              <td>${esc(userName(r.d.headUserId))}</td>
              <td>${r.siteCount}</td>
              <td>${r.labourCount}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">Recent Audit Activity</div></div>
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            ${AUDIT_LOG.slice().reverse().slice(0, 5).map((a) => `<tr>
              <td class="text-mono">${esc(a.timestamp)}</td>
              <td>${esc(userName(a.userId))}</td>
              <td><span class="tag neutral">${esc(a.action)}</span></td>
              <td class="dim">${esc(a.details)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================================
   PAGE: DEPARTMENTS
   ============================================================ */
function pageDepartments() {
  const canEdit = can("addEditDepartments");
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// ORGANISATION</div>
        <div class="page-heading">Departments</div>
        <div class="page-sub">Phase 1 supports 3 departments; architecture allows more to be added later.</div>
      </div>
      <button class="btn teal" ${canEdit ? "" : "disabled"} onclick="showAddDepartmentModal()">+ New Department</button>
    </div>
    ${!canEdit ? `<div class="section-note">Viewing as ${esc(currentRole().name)} — department creation/editing requires Super Admin or Business Owner.</div>` : ""}
    <div class="grid cols-3">
      ${/* intentionally lists all departments regardless of the Department dropdown (admin management page) */ DEPARTMENTS.map((d) => {
        const sites = SITES.filter((s) => s.departmentId === d.id);
        const labour = LABOUR.filter((l) => labourInSites(l, sites.map((s) => s.id)));
        const users = USERS.filter((u) => u.departmentIds.includes(d.id));
        return `<div class="site-card">
          <div class="site-card-head">
            <div>
              <div class="site-name">${esc(d.name)}</div>
              <div class="site-meta"><span class="badge-dot ${d.active ? "active" : "inactive"}"></span>${d.active ? "Active" : "Inactive"}</div>
            </div>
          </div>
          <div class="kv-list">
            <div class="kv-row"><span class="k">Head</span><span class="v">${esc(userName(d.headUserId))}</span></div>
            <div class="kv-row"><span class="k">Sites</span><span class="v">${sites.length}</span></div>
            <div class="kv-row"><span class="k">Manpower</span><span class="v">${labour.length}</span></div>
            <div class="kv-row"><span class="k">Staff</span><span class="v">${users.length}</span></div>
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
}

function showAddDepartmentModal() {
  openModal("New Department", `
    <form id="deptForm" class="form-grid">
      <div class="field full"><label>Department Name</label><input required name="name" placeholder="e.g. Interior Finishing" /></div>
      <div class="field full"><label>Department Head</label>
        <select name="head">${USERS.filter((u) => Auth.roleLevel(u) <= 2 && u.active).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select>
      </div>
      <div class="field full" style="margin-top:4px;">
        <div class="section-note">New department is saved in this browser (localStorage). Use Reset demo data on the login screen to restore the seed.</div>
      </div>
      <div class="form-actions full" style="grid-column:1/-1;">
        <button type="button" class="btn secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn teal">Create Department</button>
      </div>
    </form>
  `);
  document.getElementById("deptForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const id = Store.nextId(DEPARTMENTS);
    DEPARTMENTS.push({ id, name: f.get("name"), headUserId: Number(f.get("head")), active: true });
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Department Added", details: `${f.get("name")} created` });
    closeModal();
    showToast("Department created");
    render();
  };
}

/* ============================================================
   PAGE: ATTENDANCE
   ============================================================ */
function pageAttendance() {
  const scoped = scopedSiteIds();
  const dates = [...new Set(ATTENDANCE.map((a) => a.date))].sort().reverse();
  const activeDate = state.attendanceDate || dates[0] || "2026-09-16";
  state.attendanceDate = activeDate;
  const rows = ATTENDANCE.filter((a) => a.date === activeDate && scoped.includes(a.siteId));
  const statusTag = (s) => s === "Present" ? "ok" : s === "Half Day" ? "warn" : s === "Leave" ? "neutral" : "danger";
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Daily Attendance</div>
        <div class="page-sub">Present / Absent / Half Day / Leave, tracked project-wise with optional GPS capture.</div>
      </div>
      <button class="btn teal" ${can("markAttendance") ? "" : "disabled"} onclick="showMarkAttendanceModal()">+ Mark Attendance</button>
    </div>
    <div class="pill-row" style="margin-bottom:16px;">
      ${dates.map((d) => `<span class="pill ${d === activeDate ? "active" : ""}" onclick="setAttendanceDate('${d}')">${d}</span>`).join("")}
    </div>
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Labour</th><th>Site</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>GPS</th><th>Marked By</th><th>Remarks</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((a) => `<tr>
              <td>${esc(labourName(a.labourId))}</td>
              <td>${esc(siteName(a.siteId))}</td>
              <td><span class="tag ${statusTag(a.status)}">${esc(a.status)}</span></td>
              <td class="text-mono">${esc(a.checkIn || "—")}</td>
              <td class="text-mono">${esc(a.checkOut || "—")}</td>
              <td class="dim">${a.gps ? `${a.gps.lat.toFixed(4)}, ${a.gps.lng.toFixed(4)}` : "not captured"}</td>
              <td>${esc(userName(a.markedBy))}</td>
              <td class="dim">${esc(a.remarks || "—")}</td>
            </tr>`).join("") : `<tr><td colspan="8" class="empty-note">No attendance marked for this date within your visibility scope.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function setAttendanceDate(d) { state.attendanceDate = d; render(); }

function showMarkAttendanceModal() {
  const scoped = scopedSiteIds();
  const siteOptions = (scoped.length ? scoped : SITES.map((s) => s.id));
  openModal("Mark Attendance", `
    <form id="attForm" class="form-grid">
      <div class="field"><label>Date</label><input required type="date" name="date" value="2026-09-16" /></div>
      <div class="field"><label>Site</label><select name="site" id="attSiteSelect">${siteOptions.map((id) => `<option value="${id}">${esc(siteName(id))}</option>`).join("")}</select></div>
      <div class="field full"><label>Labour</label><select name="labour" id="attLabourSelect"></select></div>
      <div class="field"><label>Status</label>
        <select name="status"><option>Present</option><option>Absent</option><option>Half Day</option><option>Leave</option></select>
      </div>
      <div class="field"><label>Marked By</label><input disabled value="${esc(currentUser().name)}" /></div>
      <div class="field"><label>Check-in</label><input type="time" name="checkIn" /></div>
      <div class="field"><label>Check-out</label><input type="time" name="checkOut" /></div>
      <div class="field full"><label>Remarks (optional)</label><input name="remarks" placeholder="e.g. left early" /></div>
      <div id="attFormError" class="field-error full" style="display:none;"></div>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn teal">Save Attendance</button>
      </div>
    </form>
  `);
  const siteSel = document.getElementById("attSiteSelect");
  const labourSel = document.getElementById("attLabourSelect");
  function refreshLabourOptions() {
    const sid = Number(siteSel.value);
    const opts = LABOUR.filter((l) => labourSiteIds(l.id).includes(sid) && l.approvalStatus === "Approved");
    labourSel.innerHTML = opts.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("") || `<option value="">No approved labour at this site</option>`;
  }
  siteSel.onchange = refreshLabourOptions;
  refreshLabourOptions();

  document.getElementById("attForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const date = f.get("date"), siteId = Number(f.get("site")), labourId = Number(f.get("labour"));
    const errEl = document.getElementById("attFormError");
    if (ATTENDANCE.some((a) => a.date === date && a.siteId === siteId && a.labourId === labourId)) {
      errEl.style.display = "block";
      errEl.textContent = "Duplicate entry blocked — attendance already recorded for this labour, site, and date.";
      return;
    }
    ATTENDANCE.push({
      id: Store.nextId(ATTENDANCE), date, siteId, labourId, status: f.get("status"),
      checkIn: f.get("checkIn"), checkOut: f.get("checkOut"), markedBy: state.currentUserId, gps: null, remarks: f.get("remarks") || "",
    });
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Attendance Marked", details: `${labourName(labourId)} marked ${f.get("status")} at ${siteName(siteId)} on ${date}` });
    state.attendanceDate = date;
    closeModal();
    showToast("Attendance saved");
    render();
  };
}

/* ============================================================
   PAGE: WAGES
   ============================================================ */
function pageWages() {
  const scoped = scopedSiteIds();
  const rows = WAGES.filter((w) => scoped.includes(w.siteId));
  const canUpdate = can("updateWagePayment");
  const statusTag = (s) => s === "Paid" ? "ok" : s === "Partially Paid" ? "warn" : "danger";
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Wages &amp; Payments</div>
        <div class="page-sub">Payable computed from attendance days × wage rate, minus advances.</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Labour</th><th>Site</th><th>Rate/Day</th><th>Present</th><th>Half Days</th><th>Payable</th><th>Advance</th><th>Balance</th><th>Status</th>${canUpdate ? "<th>Action</th>" : ""}</tr></thead>
          <tbody>
            ${rows.map((w) => `<tr>
              <td>${esc(labourName(w.labourId))}</td>
              <td>${esc(siteName(w.siteId))}</td>
              <td>${currency(w.wageRate)}</td>
              <td>${w.daysPresent}</td>
              <td>${w.halfDays}</td>
              <td>${currency(w.totalPayable)}</td>
              <td>${currency(w.advancePaid)}</td>
              <td class="text-mono">${currency(w.balancePayable)}</td>
              <td><span class="tag ${statusTag(w.status)}">${esc(w.status)}</span></td>
              ${canUpdate ? `<td>${w.status !== "Paid" ? `<button class="btn teal small" onclick="markWagePaid(${w.id})">Mark Paid</button>` : `<span class="faint text-mono">Settled</span>`}</td>` : ""}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function markWagePaid(id) {
  const w = byId(WAGES, id);
  w.status = "Paid";
  w.advancePaid = w.totalPayable;
  w.balancePayable = 0;
  w.paymentDate = "2026-09-16";
  w.paidBy = state.currentUserId;
  AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Wage Payment Updated", details: `${labourName(w.labourId)} marked Paid` });
  showToast("Wage marked as paid");
  render();
}

/* ============================================================
   PAGE: EXPENSES
   ============================================================ */
function pageExpenses() {
  const scoped = scopedSiteIds();
  const rows = EXPENSES.filter((e) => scoped.includes(e.siteId));
  const total = rows.reduce((s, e) => s + e.amount, 0);
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Petty Expenses</div>
        <div class="page-sub">${rows.length} entries in scope · total ${currency(total)}</div>
      </div>
      <button class="btn teal" ${can("addExpense") ? "" : "disabled"} onclick="showAddExpenseModal()">+ Add Expense</button>
    </div>
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Site</th><th>Category</th><th>Amount</th><th>Paid By</th><th>Description</th><th>Approval</th></tr></thead>
          <tbody>
            ${rows.map((e) => `<tr>
              <td class="text-mono">${esc(e.date)}</td>
              <td>${esc(siteName(e.siteId))}</td>
              <td><span class="tag neutral">${esc(e.category)}</span></td>
              <td>${currency(e.amount)}</td>
              <td>${esc(userName(e.paidBy))}</td>
              <td class="dim">${esc(e.description)}</td>
              <td>${e.approvedBy ? `<span class="tag ok">Approved · ${esc(userName(e.approvedBy))}</span>` : `<span class="tag warn">Pending Review</span>`}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function showAddExpenseModal() {
  const scoped = scopedSiteIds();
  const siteOptions = (scoped.length ? scoped : SITES.map((s) => s.id));
  openModal("Add Petty Expense", `
    <form id="expForm" class="form-grid">
      <div class="field"><label>Date</label><input required type="date" name="date" value="2026-09-16" /></div>
      <div class="field"><label>Site</label><select name="site">${siteOptions.map((id) => `<option value="${id}">${esc(siteName(id))}</option>`).join("")}</select></div>
      <div class="field"><label>Category</label>
        <select name="category"><option>Transport</option><option>Food</option><option>Tools Purchase</option><option>Miscellaneous</option></select>
      </div>
      <div class="field"><label>Amount</label><input required type="number" name="amount" placeholder="1000" /></div>
      <div class="field full"><label>Description</label><input required name="description" placeholder="What was this expense for" /></div>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn teal">Save Expense</button>
      </div>
    </form>
  `);
  document.getElementById("expForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const id = Store.nextId(EXPENSES);
    EXPENSES.push({ id, date: f.get("date"), siteId: Number(f.get("site")), category: f.get("category"), amount: Number(f.get("amount")), paidBy: state.currentUserId, description: f.get("description"), approvedBy: null, remarks: "" });
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Expense Added", details: `${f.get("category")} expense of ${currency(f.get("amount"))} at ${siteName(Number(f.get("site")))}` });
    closeModal();
    showToast("Expense recorded, pending review");
    render();
  };
}

/* ============================================================
   PAGE: TOOLS & SAFETY (text-based, Phase 1)
   ============================================================ */
function pageResources() {
  const scoped = scopedSiteIds();
  const sites = SITES.filter((s) => scoped.includes(s.id));
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Tools &amp; Safety Equipment</div>
        <div class="page-sub">Phase 1 tracks tools and safety equipment as free-text entries per site.</div>
      </div>
    </div>
    ${sites.map((s) => {
      const t = TOOLS.find((x) => x.siteId === s.id);
      const se = SAFETY_EQUIPMENT.find((x) => x.siteId === s.id);
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">${esc(s.name)}</div></div>
        <div class="panel-body">
          <div class="grid cols-2">
            <div>
              <div class="stat-label" style="margin-bottom:8px;">Tools</div>
              <p style="margin:0 0 6px;">${t ? esc(t.details) : "No entry recorded."}</p>
              ${t && t.remarks ? `<div class="dim" style="font-size:12px;">${esc(t.remarks)}</div>` : ""}
            </div>
            <div>
              <div class="stat-label" style="margin-bottom:8px;">Safety Equipment</div>
              <p style="margin:0 0 6px;">${se ? esc(se.details) : "No entry recorded."}</p>
              ${se && se.remarks ? `<div class="dim" style="font-size:12px;">${esc(se.remarks)}</div>` : ""}
            </div>
          </div>
        </div>
      </div>`;
    }).join("")}
  `;
}

/* ============================================================
   PAGE: MATERIALS
   ============================================================ */
function pageMaterials() {
  const scoped = scopedSiteIds();
  const rows = MATERIALS.filter((m) => scoped.includes(m.siteId));
  const client = rows.filter((m) => m.category === "Client Provided");
  const company = rows.filter((m) => m.category === "Company Provided");
  const renderTable = (list) => `
    <div class="panel-body flush table-wrap">
      <table>
        <thead><tr><th>Material</th><th>Site</th><th>Quantity</th><th>Provided By</th><th>Date</th><th>Remarks</th></tr></thead>
        <tbody>
          ${list.length ? list.map((m) => `<tr>
            <td>${esc(m.name)}</td>
            <td>${esc(siteName(m.siteId))}</td>
            <td>${m.quantity.toLocaleString("en-IN")} ${esc(m.unit)}</td>
            <td>${esc(m.providedBy)}</td>
            <td class="text-mono">${esc(m.date)}</td>
            <td class="dim">${esc(m.remarks || "—")}</td>
          </tr>`).join("") : `<tr><td colspan="6" class="empty-note">No entries in scope.</td></tr>`}
        </tbody>
      </table>
    </div>`;
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Material Tracking</div>
        <div class="page-sub">Separated into client-provided and company-provided materials.</div>
      </div>
    </div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Client Provided (${client.length})</div></div>${renderTable(client)}</div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Company Provided (${company.length})</div></div>${renderTable(company)}</div>
  `;
}

/* ============================================================
   PAGE: REPORTS
   ============================================================ */
function pageReports() {
  const scoped = scopedSiteIds();
  const bySite = SITES.filter((s) => scoped.includes(s.id)).map((s) => {
    const labour = siteLabourIds(s.id).filter((lid) => byId(LABOUR, lid).approvalStatus === "Approved").length;
    const att = ATTENDANCE.filter((a) => a.siteId === s.id);
    const present = att.filter((a) => a.status === "Present").length;
    const wageOutstanding = WAGES.filter((w) => w.siteId === s.id).reduce((sum, w) => sum + w.balancePayable, 0);
    const expense = EXPENSES.filter((e) => e.siteId === s.id).reduce((sum, e) => sum + e.amount, 0);
    return { s, labour, present, total: att.length, wageOutstanding, expense };
  });
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// INSIGHT</div>
        <div class="page-heading">Reports</div>
        <div class="page-sub">Site-wise manpower, attendance, wage, and expense summary within your scope.</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Site</th><th>Status</th><th>Manpower</th><th>Attendance Marked</th><th>Present</th><th>Wage Outstanding</th><th>Total Expense</th></tr></thead>
          <tbody>
            ${bySite.map((r) => `<tr>
              <td>${esc(r.s.name)}</td>
              <td><span class="tag ${r.s.status === "Active" ? "ok" : r.s.status === "Paused" ? "warn" : "neutral"}">${esc(r.s.status)}</span></td>
              <td>${r.labour}</td>
              <td>${r.total}</td>
              <td>${r.present}</td>
              <td>${currency(r.wageOutstanding)}</td>
              <td>${currency(r.expense)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Labour Approval Report</div></div>
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            ${["Approved", "Pending", "Rejected"].map((st) => `<tr><td>${st}</td><td>${LABOUR.filter((l) => labourVisibleNow(l) && l.approvalStatus === st).length}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================================
   PAGE: AUDIT LOG
   ============================================================ */
function pageAudit() {
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// INSIGHT</div>
        <div class="page-heading">Audit Log</div>
        <div class="page-sub">System-recorded trail of key actions across all modules.</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            ${AUDIT_LOG.slice().reverse().map((a) => `<tr>
              <td class="text-mono">${esc(a.timestamp)}</td>
              <td>${esc(userName(a.userId))}</td>
              <td><span class="tag neutral">${esc(a.action)}</span></td>
              <td class="dim">${esc(a.details)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- modal helpers ---------- */
let modalReturnFocus = null;
function openModal(title, bodyHtml, opts = {}) {
  const hadModal = !!document.getElementById("modalOverlay");
  const prev = document.activeElement;
  closeModal(true);
  if (!hadModal) modalReturnFocus = prev && prev !== document.body ? prev : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalOverlay";
  overlay.innerHTML = `
    <div class="modal${opts.wide ? " modal-wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head"><div class="modal-title">${title}</div><button type="button" class="modal-close" aria-label="Close" onclick="closeModal()">×</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  const first = overlay.querySelector(".modal-body input:not([type=hidden]):not([disabled]),.modal-body select:not([disabled]),.modal-body textarea:not([disabled]),.modal-body button:not([disabled])");
  if (first) first.focus();
}
function closeModal(keepFocus) {
  const m = document.getElementById("modalOverlay");
  if (!m) return;
  m.remove();
  if (keepFocus === true) return; // openModal replaces the dialog; keep the original return target
  const t = modalReturnFocus;
  modalReturnFocus = null;
  if (t && document.contains(t) && typeof t.focus === "function") t.focus();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("modalOverlay")) { e.preventDefault(); closeModal(); }
});

function nowStamp() {
  return "2026-09-16 " + new Date().toTimeString().slice(0, 5);
}

/* ---------- router ---------- */
const PAGES = {
  dashboard: { title: "Dashboard", render: pageDashboard },
  departments: { title: "Departments", render: pageDepartments },
  users: { title: "Users & Roles", render: pageUsers },
  sites: { title: "Sites & Projects", render: pageSites },
  manpower: { title: "Manpower", render: pageManpower },
  approvals: { title: "Approvals", render: pageApprovals },
  attendance: { title: "Attendance", render: pageAttendance },
  wages: { title: "Wages & Payments", render: pageWages },
  expenses: { title: "Petty Expenses", render: pageExpenses },
  resources: { title: "Tools & Safety", render: pageResources },
  materials: { title: "Materials", render: pageMaterials },
  reports: { title: "Reports", render: pageReports },
  audit: { title: "Audit Log", render: pageAudit },
};

function render() {
  if (!navVisible(state.route)) state.route = "dashboard";
  renderNav();
  renderDeptSwitch();
  const page = PAGES[state.route] || PAGES.dashboard;
  document.getElementById("pageTitle").textContent = page.title;
  document.getElementById("content").innerHTML = page.render();
  UI.mountAll();
  document.getElementById("sidebar").classList.toggle("open", state.sidebarOpen);
  warnStorage(Store.save());
}

function startSession(user, deptId) {
  state.currentUserId = user.id;
  state.deptId = deptId === undefined ? Auth.defaultDept(user) : deptId;
  state.route = "dashboard";
  Session.save(user.id, state.deptId);
  render();
}

function logout() {
  Session.clear();
  state.currentUserId = null;
  showLogin((user) => startSession(user));
}

document.getElementById("menuToggle").addEventListener("click", () => {
  state.sidebarOpen = !state.sidebarOpen;
  document.getElementById("sidebar").classList.toggle("open", state.sidebarOpen);
});
document.getElementById("logoutBtn").addEventListener("click", logout);

function boot() {
  const loaded = Store.load();
  const s = Session.load();
  const user = s && byId(USERS, s.userId);
  if (Auth.canSignIn(user)) {
    const ok = s.deptId == null ? Auth.isAllDeptRole(user) : Auth.allowedDepartments(user).some((d) => d.id === s.deptId);
    hideLogin(); startSession(user, ok ? s.deptId : undefined);
  }
  else showLogin((u) => startSession(u));
  warnStorage(loaded);
}
boot();
