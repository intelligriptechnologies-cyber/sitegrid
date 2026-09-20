/* ============================================================
   SITEGRID — demo application logic (vanilla JS, no build step)
   In-memory state seeded from data.js. All writes are session-only.
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
const roleName = (id) => (byId(ROLES, id) ? byId(ROLES, id).name : "—");
const clientName = (id) => (byId(CLIENTS, id) ? byId(CLIENTS, id).name : "—");
const currency = (n) => "Rs " + Number(n || 0).toLocaleString("en-IN");

function currentUser() { return byId(USERS, state.currentUserId); }
function currentRole() { return byId(ROLES, currentUser().roleId); }
function can(actionKey) {
  const allowedLevels = ACCESS_MATRIX[actionKey] || [];
  return allowedLevels.includes(currentRole().id);
}

/* Sites/labour visible to the current user, based on role scope */
function scopedSiteIds() { return Auth.scopeSiteIds(currentUser(), state.deptId); }

/* ---------- navigation ---------- */
const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "01" },
  ]},
  { group: "Organisation", items: [
    { id: "departments", label: "Departments", icon: "02" },
    { id: "users", label: "Users & Roles", icon: "03" },
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
    const n = APPROVAL_REQUESTS.filter((a) => a.status === "Pending").length;
    return n > 0 ? n : null;
  }
  if (id === "expenses") {
    const n = EXPENSES.filter((e) => e.approvedBy === null).length;
    return n > 0 ? n : null;
  }
  return null;
}

function renderNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  NAV.forEach((group) => {
    const label = document.createElement("div");
    label.className = "nav-group-label";
    label.textContent = group.group;
    nav.appendChild(label);
    group.items.forEach((item) => {
      const el = document.createElement("div");
      el.className = "nav-item" + (state.route === item.id ? " active" : "");
      const badge = badgeForNav(item.id);
      el.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>` +
        (badge ? `<span class="nav-badge">${badge}</span>` : "");
      el.onclick = () => { state.route = item.id; state.sidebarOpen = false; render(); };
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
    depts.map((d) => `<option value="${d.id}" ${d.id === state.deptId ? "selected" : ""}>${d.name}</option>`).join("");
  sel.value = state.deptId == null ? "" : String(state.deptId);
  sel.disabled = !all && depts.length <= 1;
  sel.onchange = (e) => { state.deptId = e.target.value === "" ? null : Number(e.target.value); Session.save(state.currentUserId, state.deptId); render(); };
  document.getElementById("userChip").textContent = `${u.name} · ${roleName(u.roleId)}`;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

function accessDenied(action) {
  return `<div class="access-denied">
    <div class="code">ACCESS RESTRICTED</div>
    <div>${currentRole().name} does not have permission to ${action}.</div>
  </div>`;
}

/* ============================================================
   PAGE: DASHBOARD
   ============================================================ */
function pageDashboard() {
  const scoped = scopedSiteIds();
  const activeSites = SITES.filter((s) => scoped.includes(s.id) && s.status === "Active").length;
  const manpower = LABOUR.filter((l) => scoped.includes(l.siteId) && l.approvalStatus === "Approved").length;
  const pendingApprovals = APPROVAL_REQUESTS.filter((a) => a.status === "Pending" && scoped.includes(byId(LABOUR, a.labourId).siteId)).length;
  const today = "2026-09-16";
  const todayAttendance = ATTENDANCE.filter((a) => a.date === today && scoped.includes(a.siteId));
  const present = todayAttendance.filter((a) => a.status === "Present").length;
  const pendingWage = WAGES.filter((w) => scoped.includes(w.siteId) && w.status !== "Paid").reduce((s, w) => s + w.balancePayable, 0);
  const totalExpense = EXPENSES.filter((e) => scoped.includes(e.siteId)).reduce((s, e) => s + e.amount, 0);

  const deptSummary = DEPARTMENTS.map((d) => {
    const siteCount = SITES.filter((s) => s.departmentId === d.id).length;
    const labourCount = LABOUR.filter((l) => SITES.find((s) => s.id === l.siteId && s.departmentId === d.id)).length;
    return { d, siteCount, labourCount };
  });

  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// COMMAND OVERVIEW</div>
        <div class="page-heading">Dashboard</div>
        <div class="page-sub">Signed in as ${currentUser().name} · ${currentRole().name}${currentRole().id >= 2 && currentRole().id !== 1 && currentUser().departmentId ? " · " + deptName(currentUser().departmentId) : ""}</div>
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
              <td>${r.d.name}</td>
              <td>${userName(r.d.headUserId)}</td>
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
              <td class="text-mono">${a.timestamp}</td>
              <td>${userName(a.userId)}</td>
              <td><span class="tag neutral">${a.action}</span></td>
              <td class="dim">${a.details}</td>
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
    ${!canEdit ? `<div class="section-note">Viewing as ${currentRole().name} — department creation/editing requires Super Admin or Business Owner.</div>` : ""}
    <div class="grid cols-3">
      ${DEPARTMENTS.map((d) => {
        const sites = SITES.filter((s) => s.departmentId === d.id);
        const labour = LABOUR.filter((l) => sites.some((s) => s.id === l.siteId));
        const users = USERS.filter((u) => u.departmentId === d.id);
        return `<div class="site-card">
          <div class="site-card-head">
            <div>
              <div class="site-name">${d.name}</div>
              <div class="site-meta"><span class="badge-dot ${d.active ? "active" : "inactive"}"></span>${d.active ? "Active" : "Inactive"}</div>
            </div>
          </div>
          <div class="kv-list">
            <div class="kv-row"><span class="k">Head</span><span class="v">${userName(d.headUserId)}</span></div>
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
        <select name="head">${USERS.filter((u) => u.roleId <= 2 && u.active).map((u) => `<option value="${u.id}">${u.name}</option>`).join("")}</select>
      </div>
      <div class="field full" style="margin-top:4px;">
        <div class="section-note">Demo only — new department is added to in-memory state and will reset on reload.</div>
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
    const id = Math.max(...DEPARTMENTS.map((d) => d.id)) + 1;
    DEPARTMENTS.push({ id, name: f.get("name"), headUserId: Number(f.get("head")), active: true });
    AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: "Department Added", details: `${f.get("name")} created` });
    closeModal();
    showToast("Department created");
    render();
  };
}

/* ============================================================
   PAGE: USERS & ROLES
   ============================================================ */
function pageUsers() {
  const canEdit = can("addEditUsers");
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// ORGANISATION</div>
        <div class="page-heading">Users &amp; Roles</div>
        <div class="page-sub">Internal system users with role-based access levels.</div>
      </div>
      <button class="btn teal" ${canEdit ? "" : "disabled"} onclick="showToast('Demo: user creation form omitted — role matrix is the focus of this screen.')">+ New User</button>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Role Hierarchy</div></div>
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Level</th><th>Role</th><th>Add Site</th><th>Approve Labour</th><th>Mark Attendance</th><th>Update Wages</th><th>View Reports</th></tr></thead>
          <tbody>
            ${ROLES.map((r) => `<tr>
              <td class="text-mono">L${r.level}</td>
              <td>${r.name}</td>
              <td>${ACCESS_MATRIX.addSite.includes(r.id) ? "Yes" : "No"}</td>
              <td>${ACCESS_MATRIX.approveLabour.includes(r.id) ? "Yes" : "No"}</td>
              <td>${ACCESS_MATRIX.markAttendance.includes(r.id) ? "Yes" : "No"}</td>
              <td>${ACCESS_MATRIX.updateWagePayment.includes(r.id) ? "Yes" : "No"}</td>
              <td>${ACCESS_MATRIX.viewAllReports.includes(r.id) ? "All" : ACCESS_MATRIX.viewDeptReports.includes(r.id) ? "Department" : "Assigned Site"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">System Users (${USERS.length})</div></div>
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Mobile</th><th>Designation</th><th>Department</th><th>Role</th><th>Sites</th><th>Status</th></tr></thead>
          <tbody>
            ${USERS.map((u) => `<tr>
              <td>${u.name}</td>
              <td class="text-mono">${u.mobile}</td>
              <td>${u.designation}</td>
              <td>${u.departmentId ? deptName(u.departmentId) : "—"}</td>
              <td>${roleName(u.roleId)}</td>
              <td class="dim">${u.siteIds.length ? u.siteIds.map(siteName).join(", ") : "—"}</td>
              <td><span class="badge-dot ${u.active ? "active" : "inactive"}"></span>${u.active ? "Active" : "Inactive"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================================
   PAGE: SITES
   ============================================================ */
function pageSites() {
  const scoped = scopedSiteIds();
  const visible = SITES.filter((s) => scoped.includes(s.id));
  const statusTag = (s) => s === "Active" ? "ok" : s === "Paused" ? "warn" : "neutral";
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Sites &amp; Projects</div>
        <div class="page-sub">${visible.length} site${visible.length === 1 ? "" : "s"} in your visibility scope.</div>
      </div>
      <button class="btn teal" ${can("addSite") ? "" : "disabled"} onclick="showAddSiteModal()">+ New Site</button>
    </div>
    <div class="grid cols-2">
      ${visible.map((s) => `<div class="site-card">
        <div class="site-card-head">
          <div>
            <div class="site-name">${s.name}</div>
            <div class="site-meta">${deptName(s.departmentId)} · ${s.projectType}</div>
          </div>
          <span class="tag ${statusTag(s.status)}">${s.status}</span>
        </div>
        <div class="site-meta">${s.description}</div>
        <div class="gps-chip">GPS ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</div>
        <div class="kv-list">
          <div class="kv-row"><span class="k">Area</span><span class="v">${s.areaSqft.toLocaleString("en-IN")} sqft</span></div>
          <div class="kv-row"><span class="k">Client</span><span class="v">${clientName(s.clientId)}</span></div>
          <div class="kv-row"><span class="k">Address</span><span class="v">${s.address}</span></div>
          <div class="kv-row"><span class="k">Timeline</span><span class="v">${s.startDate} → ${s.endDate}</span></div>
          <div class="kv-row"><span class="k">PM / PE</span><span class="v">${userName(s.pmUserId)} / ${userName(s.peUserId)}</span></div>
        </div>
        ${s.notes ? `<div class="section-note">${s.notes}</div>` : ""}
      </div>`).join("")}
    </div>
  `;
}

function showAddSiteModal() {
  openModal("New Site / Project", `
    <form id="siteForm" class="form-grid">
      <div class="field full"><label>Site Name</label><input required name="name" placeholder="e.g. Riverside Residency Tower 3" /></div>
      <div class="field"><label>Department</label><select name="dept">${DEPARTMENTS.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}</select></div>
      <div class="field"><label>Project Type</label><select name="type"><option>Residential</option><option>Commercial</option></select></div>
      <div class="field"><label>Area (sqft)</label><input required type="number" name="area" placeholder="30000" /></div>
      <div class="field"><label>Client</label><select name="client">${CLIENTS.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
      <div class="field"><label>GPS Latitude</label><input required type="number" step="0.0001" name="lat" placeholder="20.3477" /></div>
      <div class="field"><label>GPS Longitude</label><input required type="number" step="0.0001" name="lng" placeholder="85.8245" /></div>
      <div class="field full"><label>Address</label><input required name="address" placeholder="Site address" /></div>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn teal">Create Site</button>
      </div>
    </form>
  `);
  document.getElementById("siteForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const id = Math.max(...SITES.map((s) => s.id)) + 1;
    SITES.push({
      id, name: f.get("name"), description: "New site — details pending", departmentId: Number(f.get("dept")),
      projectType: f.get("type"), areaSqft: Number(f.get("area")), address: f.get("address"),
      lat: Number(f.get("lat")), lng: Number(f.get("lng")), clientId: Number(f.get("client")),
      startDate: "2026-09-16", endDate: "", status: "Active", pmUserId: state.currentUserId, peUserId: state.currentUserId, notes: "",
    });
    AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: "Site Created", details: `${f.get("name")} created` });
    closeModal();
    showToast("Site created");
    render();
  };
}

/* ============================================================
   PAGE: MANPOWER
   ============================================================ */
function pageManpower() {
  const scoped = scopedSiteIds();
  const visible = LABOUR.filter((l) => scoped.includes(l.siteId));
  const statusTag = (s) => s === "Approved" ? "ok" : s === "Pending" ? "warn" : "danger";
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Manpower / Labour</div>
        <div class="page-sub">${visible.length} record${visible.length === 1 ? "" : "s"} · searchable by name, phone, Aadhaar, site.</div>
      </div>
      <button class="btn teal" ${can("addLabour") ? "" : "disabled"} onclick="showAddLabourModal()">+ Add Labour</button>
    </div>
    <div class="field full" style="max-width:340px;margin-bottom:16px;">
      <input id="labourSearch" placeholder="Search name / phone / Aadhaar / site..." oninput="filterLabourTable(this.value)" />
    </div>
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table id="labourTable">
          <thead><tr><th>Name</th><th>Aadhaar</th><th>Phone</th><th>Skill</th><th>Wage Rate</th><th>Site</th><th>Status</th><th>Transfer</th></tr></thead>
          <tbody>
            ${visible.map((l) => `<tr data-search="${l.name.toLowerCase()} ${l.aadhaar} ${l.phone} ${siteName(l.siteId).toLowerCase()}">
              <td>${l.name}</td>
              <td class="text-mono">${l.aadhaar}</td>
              <td class="text-mono">${l.phone}</td>
              <td>${l.skill}</td>
              <td>${currency(l.wageRate)}/day</td>
              <td>${siteName(l.siteId)}</td>
              <td><span class="tag ${statusTag(l.approvalStatus)}">${l.approvalStatus}</span>${l.rejectionReason ? `<div class="dim" style="font-size:11px;margin-top:4px;max-width:220px;">${l.rejectionReason}</div>` : ""}</td>
              <td class="dim">${l.transferHistory ? `${siteName(l.transferHistory[0].fromSiteId)} → ${siteName(l.transferHistory[0].toSiteId)} on ${l.transferHistory[0].date}` : "—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterLabourTable(q) {
  q = q.trim().toLowerCase();
  document.querySelectorAll("#labourTable tbody tr").forEach((tr) => {
    tr.style.display = tr.dataset.search.includes(q) ? "" : "none";
  });
}

function showAddLabourModal() {
  const scoped = scopedSiteIds();
  openModal("Add Labour / Manpower", `
    <form id="labourForm" class="form-grid">
      <div class="field full"><label>Full Name</label><input required name="name" placeholder="Worker full name" /></div>
      <div class="field"><label>Aadhaar Number (12 digits)</label><input required name="aadhaar" pattern="[0-9]{12}" placeholder="234567890199" /></div>
      <div class="field"><label>Phone</label><input required name="phone" pattern="[0-9]{10}" placeholder="9556100099" /></div>
      <div class="field"><label>Skill / Category</label><input required name="skill" placeholder="e.g. Mason" /></div>
      <div class="field"><label>Daily Wage Rate</label><input required type="number" name="rate" placeholder="750" /></div>
      <div class="field full"><label>Assign to Site</label>
        <select name="site">${(scoped.length ? scoped : SITES.map((s) => s.id)).map((id) => `<option value="${id}">${siteName(id)}</option>`).join("")}</select>
      </div>
      <div id="labourFormError" class="field-error full" style="display:none;"></div>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn teal">Submit for Approval</button>
      </div>
    </form>
  `);
  document.getElementById("labourForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const aadhaar = f.get("aadhaar");
    const dup = LABOUR.find((l) => l.aadhaar === aadhaar && l.approvalStatus !== "Rejected");
    const errEl = document.getElementById("labourFormError");
    if (dup) {
      errEl.style.display = "block";
      errEl.textContent = `Duplicate Aadhaar — already registered as ${dup.name} (Labour ID ${dup.id}).`;
      return;
    }
    const id = Math.max(...LABOUR.map((l) => l.id)) + 1;
    LABOUR.push({
      id, name: f.get("name"), aadhaar, phone: f.get("phone"), address: "—", biometricRef: "",
      category: "Skilled", skill: f.get("skill"), wageRate: Number(f.get("rate")), siteId: Number(f.get("site")),
      joiningDate: "2026-09-16", active: false, approvalStatus: "Pending",
    });
    APPROVAL_REQUESTS.push({ id: APPROVAL_REQUESTS.length + 1, labourId: id, requestedBy: state.currentUserId, requestDate: nowStamp(), approvedBy: null, decisionDate: null, status: "Pending" });
    AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: "Labour Added", details: `${f.get("name")} submitted for approval` });
    closeModal();
    showToast("Labour submitted for approval");
    render();
  };
}

/* ============================================================
   PAGE: APPROVALS
   ============================================================ */
function pageApprovals() {
  const canApprove = can("approveLabour");
  const rows = APPROVAL_REQUESTS.slice().reverse();
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Labour Onboarding Approvals</div>
        <div class="page-sub">Approval authority: Super Admin, Business Owner, or Department Head.</div>
      </div>
    </div>
    ${!canApprove ? `<div class="section-note">Viewing as ${currentRole().name} — approve/reject actions require Level 0-2 access. Table is read-only.</div>` : ""}
    <div class="panel">
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Labour</th><th>Site</th><th>Requested By</th><th>Request Date</th><th>Status</th><th>Decision</th>${canApprove ? "<th>Action</th>" : ""}</tr></thead>
          <tbody>
            ${rows.map((a) => {
              const l = byId(LABOUR, a.labourId);
              const tag = a.status === "Approved" ? "ok" : a.status === "Pending" ? "warn" : "danger";
              return `<tr>
                <td>${l.name}<div class="dim" style="font-size:11px;">Aadhaar ${l.aadhaar}</div></td>
                <td>${siteName(l.siteId)}</td>
                <td>${userName(a.requestedBy)}</td>
                <td class="text-mono">${a.requestDate}</td>
                <td><span class="tag ${tag}">${a.status}</span></td>
                <td class="dim">${a.decisionDate ? `${userName(a.approvedBy)} · ${a.decisionDate}` : "—"}${a.rejectionReason ? `<div style="margin-top:4px;max-width:220px;">${a.rejectionReason}</div>` : ""}</td>
                ${canApprove ? `<td>${a.status === "Pending" ? `
                  <div style="display:flex;gap:6px;">
                    <button class="btn teal small" onclick="decideApproval(${a.id}, 'Approved')">Approve</button>
                    <button class="btn danger small" onclick="decideApproval(${a.id}, 'Rejected')">Reject</button>
                  </div>` : `<span class="faint text-mono">Closed</span>`}</td>` : ""}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function decideApproval(reqId, decision) {
  const req = byId(APPROVAL_REQUESTS, reqId);
  const labour = byId(LABOUR, req.labourId);
  req.status = decision;
  req.approvedBy = state.currentUserId;
  req.decisionDate = nowStamp();
  if (decision === "Rejected") {
    const reason = prompt("Reason for rejection:", "Does not meet onboarding criteria");
    req.rejectionReason = reason || "Rejected by approver";
    labour.rejectionReason = req.rejectionReason;
  }
  labour.approvalStatus = decision;
  labour.active = decision === "Approved";
  AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: `Labour ${decision}`, details: `${labour.name} ${decision.toLowerCase()} by ${currentUser().name}` });
  showToast(`Labour ${decision.toLowerCase()}`);
  render();
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
              <td>${labourName(a.labourId)}</td>
              <td>${siteName(a.siteId)}</td>
              <td><span class="tag ${statusTag(a.status)}">${a.status}</span></td>
              <td class="text-mono">${a.checkIn || "—"}</td>
              <td class="text-mono">${a.checkOut || "—"}</td>
              <td class="dim">${a.gps ? `${a.gps.lat.toFixed(4)}, ${a.gps.lng.toFixed(4)}` : "not captured"}</td>
              <td>${userName(a.markedBy)}</td>
              <td class="dim">${a.remarks || "—"}</td>
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
      <div class="field"><label>Site</label><select name="site" id="attSiteSelect">${siteOptions.map((id) => `<option value="${id}">${siteName(id)}</option>`).join("")}</select></div>
      <div class="field full"><label>Labour</label><select name="labour" id="attLabourSelect"></select></div>
      <div class="field"><label>Status</label>
        <select name="status"><option>Present</option><option>Absent</option><option>Half Day</option><option>Leave</option></select>
      </div>
      <div class="field"><label>Marked By</label><input disabled value="${currentUser().name}" /></div>
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
    const opts = LABOUR.filter((l) => l.siteId === sid && l.approvalStatus === "Approved");
    labourSel.innerHTML = opts.map((l) => `<option value="${l.id}">${l.name}</option>`).join("") || `<option value="">No approved labour at this site</option>`;
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
      id: ATTENDANCE.length + 1, date, siteId, labourId, status: f.get("status"),
      checkIn: f.get("checkIn"), checkOut: f.get("checkOut"), markedBy: state.currentUserId, gps: null, remarks: f.get("remarks") || "",
    });
    AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: "Attendance Marked", details: `${labourName(labourId)} marked ${f.get("status")} at ${siteName(siteId)} on ${date}` });
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
              <td>${labourName(w.labourId)}</td>
              <td>${siteName(w.siteId)}</td>
              <td>${currency(w.wageRate)}</td>
              <td>${w.daysPresent}</td>
              <td>${w.halfDays}</td>
              <td>${currency(w.totalPayable)}</td>
              <td>${currency(w.advancePaid)}</td>
              <td class="text-mono">${currency(w.balancePayable)}</td>
              <td><span class="tag ${statusTag(w.status)}">${w.status}</span></td>
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
  AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: "Wage Payment Updated", details: `${labourName(w.labourId)} marked Paid` });
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
              <td class="text-mono">${e.date}</td>
              <td>${siteName(e.siteId)}</td>
              <td><span class="tag neutral">${e.category}</span></td>
              <td>${currency(e.amount)}</td>
              <td>${userName(e.paidBy)}</td>
              <td class="dim">${e.description}</td>
              <td>${e.approvedBy ? `<span class="tag ok">Approved · ${userName(e.approvedBy)}</span>` : `<span class="tag warn">Pending Review</span>`}</td>
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
      <div class="field"><label>Site</label><select name="site">${siteOptions.map((id) => `<option value="${id}">${siteName(id)}</option>`).join("")}</select></div>
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
    const id = Math.max(...EXPENSES.map((x) => x.id)) + 1;
    EXPENSES.push({ id, date: f.get("date"), siteId: Number(f.get("site")), category: f.get("category"), amount: Number(f.get("amount")), paidBy: state.currentUserId, description: f.get("description"), approvedBy: null, remarks: "" });
    AUDIT_LOG.push({ id: AUDIT_LOG.length + 1, timestamp: nowStamp(), userId: state.currentUserId, action: "Expense Added", details: `${f.get("category")} expense of ${currency(f.get("amount"))} at ${siteName(Number(f.get("site")))}` });
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
        <div class="panel-head"><div class="panel-title">${s.name}</div></div>
        <div class="panel-body">
          <div class="grid cols-2">
            <div>
              <div class="stat-label" style="margin-bottom:8px;">Tools</div>
              <p style="margin:0 0 6px;">${t ? t.details : "No entry recorded."}</p>
              ${t && t.remarks ? `<div class="dim" style="font-size:12px;">${t.remarks}</div>` : ""}
            </div>
            <div>
              <div class="stat-label" style="margin-bottom:8px;">Safety Equipment</div>
              <p style="margin:0 0 6px;">${se ? se.details : "No entry recorded."}</p>
              ${se && se.remarks ? `<div class="dim" style="font-size:12px;">${se.remarks}</div>` : ""}
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
            <td>${m.name}</td>
            <td>${siteName(m.siteId)}</td>
            <td>${m.quantity.toLocaleString("en-IN")} ${m.unit}</td>
            <td>${m.providedBy}</td>
            <td class="text-mono">${m.date}</td>
            <td class="dim">${m.remarks || "—"}</td>
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
    const labour = LABOUR.filter((l) => l.siteId === s.id && l.approvalStatus === "Approved").length;
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
              <td>${r.s.name}</td>
              <td><span class="tag ${r.s.status === "Active" ? "ok" : r.s.status === "Paused" ? "warn" : "neutral"}">${r.s.status}</span></td>
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
            ${["Approved", "Pending", "Rejected"].map((st) => `<tr><td>${st}</td><td>${LABOUR.filter((l) => scoped.includes(l.siteId) && l.approvalStatus === st).length}</td></tr>`).join("")}
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
              <td class="text-mono">${a.timestamp}</td>
              <td>${userName(a.userId)}</td>
              <td><span class="tag neutral">${a.action}</span></td>
              <td class="dim">${a.details}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- modal helpers ---------- */
function openModal(title, bodyHtml) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalOverlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><div class="modal-title">${title}</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() {
  const m = document.getElementById("modalOverlay");
  if (m) m.remove();
}

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

const navVisible = () => true; // TEMP stub; replaced in Task 4

function render() {
  Store.save();
  if (!navVisible(state.route)) state.route = "dashboard";
  renderNav();
  renderDeptSwitch();
  const page = PAGES[state.route] || PAGES.dashboard;
  document.getElementById("pageTitle").textContent = page.title;
  document.getElementById("content").innerHTML = page.render();
  document.getElementById("sidebar").classList.toggle("open", state.sidebarOpen);
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
  Store.load();
  const s = Session.load();
  const user = s && byId(USERS, s.userId);
  if (Auth.canSignIn(user)) {
    const ok = s.deptId == null ? Auth.isAllDeptRole(user) : Auth.allowedDepartments(user).some((d) => d.id === s.deptId);
    hideLogin(); startSession(user, ok ? s.deptId : undefined);
  }
  else showLogin((u) => startSession(u));
}
boot();
