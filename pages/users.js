/* Users & Roles page: Users CRUD (this file) + Roles panel (Task 4 replaces pageRolesPanel).
   validateUserForm is pure (reads USERS/ROLES only) so it runs in the Node test harness. */

const USER_DEPT_MSG = "Select at least one department — otherwise this user cannot sign in";

/* Returns { field: message } — empty object means valid. `values` are plain values. */
function validateUserForm(values, editingId) {
  const errs = {};
  const name = String(values.name ?? "").trim();
  if (!name) errs.name = "Name is required";

  const mobile = String(values.mobile ?? "").trim();
  if (!/^\d{10}$/.test(mobile)) errs.mobile = "Mobile must be exactly 10 digits";
  else {
    const other = USERS.find((u) => u.mobile === mobile && u.id !== editingId);
    if (other) errs.mobile = `Mobile number already registered to ${other.name}`;
  }

  const rid = values.roleId;
  const role = rid === "" || rid == null ? null : ROLES.find((r) => r.id === Number(rid));
  if (!role) errs.roleId = "Role is required";
  else if (role.level > 1 && !(values.departmentIds || []).length) errs.departmentIds = USER_DEPT_MSG;
  return errs;
}

function userSitesText(u) {
  return (u.siteIds || []).map(siteName).join(", ");
}

function pageUsersTable() {
  return UI.tableHost({
    id: "users",
    searchPlaceholder: "Search users…",
    emptyText: "No users found",
    rows: () => USERS,
    columns: [
      { label: "Name", text: (u) => u.name },
      { label: "Mobile", text: (u) => u.mobile, html: (u) => `<span class="text-mono">${esc(u.mobile)}</span>` },
      { label: "Designation", text: (u) => u.designation },
      { label: "Department(s)", text: (u) => (u.departmentIds || []).length ? u.departmentIds.map(deptName).join(", ") : "All" },
      { label: "Role", text: (u) => roleName(u.roleId) },
      { label: "Sites", text: (u) => userSitesText(u),
        html: (u) => { const t = userSitesText(u); return t ? `<span class="dim" title="${esc(t)}" style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;">${esc(t)}</span>` : "—"; } },
      { label: "Active", text: (u) => (u.active ? "Active" : "Inactive"),
        html: (u) => UI.switchHtml(u.active, `toggleUserActive(${u.id}, this.checked)`) },
    ],
    rowActions: [
      { key: "edit", label: "Edit user", icon: "✎" },
      { key: "delete", label: "Delete user", icon: "×", danger: true },
    ],
    onAction: (act, u) => { if (act === "edit") openUserForm(u.id); else if (act === "delete") deleteUser(u.id); },
    onRowClick: (u) => openUserForm(u.id),
  });
}

/* Task 4 replaces this stub with the editable roles panel. */
function pageRolesPanel() {
  return `<div class="panel">
      <div class="panel-head"><div class="panel-title">Role Hierarchy</div></div>
      <div class="panel-body flush table-wrap">
        <table>
          <thead><tr><th>Level</th><th>Role</th><th>Add Site</th><th>Approve Labour</th><th>Mark Attendance</th><th>Update Wages</th><th>View Reports</th></tr></thead>
          <tbody>
            ${ROLES.map((r) => `<tr>
              <td class="text-mono">L${r.level}</td>
              <td>${esc(r.name)}</td>
              <td>${r.perms.includes("addSite") ? "Yes" : "No"}</td>
              <td>${r.perms.includes("approveLabour") ? "Yes" : "No"}</td>
              <td>${r.perms.includes("markAttendance") ? "Yes" : "No"}</td>
              <td>${r.perms.includes("updateWagePayment") ? "Yes" : "No"}</td>
              <td>${r.perms.includes("viewAllReports") ? "All" : r.perms.includes("viewDeptReports") ? "Department" : "Assigned Site"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function pageUsers() {
  const canEdit = can("addEditUsers");
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// ORGANISATION</div>
        <div class="page-heading">Users &amp; Roles</div>
        <div class="page-sub">Internal system users with role-based access levels.</div>
      </div>
      <button class="btn teal" ${canEdit ? "" : "disabled"} onclick="openUserForm()">+ New User</button>
    </div>
    ${pageRolesPanel()}
    <div class="panel">
      <div class="panel-head"><div class="panel-title">System Users</div></div>
      <div class="panel-body">${pageUsersTable()}</div>
    </div>
  `;
}

function logUserAudit(action, details) {
  AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action, details });
}

function toggleUserActive(id, checked) {
  const u = byId(USERS, id);
  if (!u) return;
  if (!checked && id === state.currentUserId) {
    showToast("You can't deactivate your own account");
    render();
    return;
  }
  u.active = !!checked;
  logUserAudit(u.active ? "User Activated" : "User Deactivated", `${u.name} ${u.active ? "activated" : "deactivated"}`);
  showToast(`${esc(u.name)} ${u.active ? "activated" : "deactivated"}`);
  render();
}

function deleteUser(id) {
  const u = byId(USERS, id);
  if (!u) return;
  if (id === state.currentUserId) { showToast("You can't delete your own account"); return; }
  const dept = DEPARTMENTS.find((d) => d.headUserId === id);
  if (dept) { showToast(`Can't delete ${esc(u.name)}: head of ${esc(dept.name)}`); return; }
  const site = SITES.find((s) => s.pmUserId === id || s.peUserId === id);
  if (site) { showToast(`Can't delete ${esc(u.name)}: ${site.pmUserId === id ? "PM" : "PE"} of ${esc(site.name)}`); return; }
  UI.confirm(`Delete ${u.name}? This cannot be undone.`, () => {
    const i = USERS.findIndex((x) => x.id === id);
    if (i >= 0) USERS.splice(i, 1);
    logUserAudit("User Deleted", `${u.name} deleted`);
    showToast(`${esc(u.name)} deleted`);
    render();
  }, { title: "Delete user", yesLabel: "Delete" });
}

function openUserForm(id) {
  if (!can("addEditUsers")) { showToast("You don't have permission to manage users"); return; }
  const editing = id != null ? byId(USERS, id) : null;
  if (id != null && !editing) return;
  const roleLevelOf = (rid) => { const r = rid === "" || rid == null ? null : byId(ROLES, Number(rid)); return r ? r.level : null; };
  const activeRoles = ROLES.filter((r) => r.active !== false || (editing && r.id === editing.roleId));
  UI.form({
    title: editing ? "Edit User" : "New User",
    submitLabel: editing ? "Save Changes" : "Create User",
    values: editing ? { ...editing, roleId: String(editing.roleId) } : { active: true, departmentIds: [], siteIds: [] },
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "mobile", label: "Mobile", type: "tel", required: true, maxlength: 10, placeholder: "10-digit number",
        hint: editing ? "Login uses this number + OTP. Changes apply at the next sign-in." : undefined,
        validate: (v) => validateUserForm({ name: "x", mobile: v, roleId: 0 }, editing ? editing.id : null).mobile },
      { name: "email", label: "Email", type: "email" },
      { name: "designation", label: "Designation", type: "text" },
      { name: "roleId", label: "Role", type: "select", required: true, options: activeRoles.map((r) => ({ value: r.id, label: r.name })) },
      { name: "departmentIds", label: "Departments", type: "multicheck", options: DEPARTMENTS.filter((d) => d.active || (editing && (editing.departmentIds || []).includes(d.id))).map((d) => ({ value: d.id, label: d.name })) },
      { name: "siteIds", label: "Sites", type: "multicheck", options: SITES.map((s) => ({ value: s.id, label: s.name })) },
      { name: "active", label: "Active", type: "checkbox" },
    ],
    onSubmit: (vals) => {
      const level = roleLevelOf(vals.roleId);
      const depts = level != null && level <= 1 ? [] : vals.departmentIds;
      const errs = validateUserForm({ ...vals, departmentIds: depts }, editing ? editing.id : null);
      const first = errs.name || errs.mobile || errs.roleId || errs.departmentIds;
      if (first) return first;
      if (editing && editing.id === state.currentUserId && !vals.active) return "You can't deactivate your own account";
      // keep only sites that belong to the chosen departments (when any chosen)
      const sites = depts.length ? vals.siteIds.filter((sid) => { const s = byId(SITES, sid); return s && depts.includes(s.departmentId); }) : vals.siteIds;
      const rec = { name: vals.name, mobile: vals.mobile, email: vals.email, designation: vals.designation,
                    roleId: Number(vals.roleId), departmentIds: depts, siteIds: sites, active: vals.active };
      if (editing) {
        Object.assign(editing, rec);
        logUserAudit("User Updated", `${rec.name} updated`);
        showToast(`${esc(rec.name)} updated`);
      } else {
        USERS.push({ id: Store.nextId(USERS), ...rec });
        logUserAudit("User Added", `${rec.name} created`);
        showToast(`${esc(rec.name)} created`);
      }
      render();
      return null;
    },
  });
  wireUserFormDynamics();
}

/* Role change hides Departments for level <= 1; department choice filters the Sites list live. */
function wireUserFormDynamics() {
  const fm = document.querySelector("#modalOverlay .ui-form");
  if (!fm) return;
  const roleSel = fm.querySelector('select[name="roleId"]');
  const deptBox = fm.querySelector('input[name="departmentIds"]');
  const deptField = deptBox && deptBox.closest(".field");
  const siteBoxes = [...fm.querySelectorAll('input[name="siteIds"]')];
  const apply = () => {
    const r = roleSel.value === "" ? null : byId(ROLES, Number(roleSel.value));
    if (deptField) deptField.hidden = !!r && r.level <= 1;
    const chosen = [...fm.querySelectorAll('input[name="departmentIds"]:checked')].map((x) => Number(x.value));
    const useDepts = !(deptField && deptField.hidden) && chosen.length;
    for (const cb of siteBoxes) {
      const s = byId(SITES, Number(cb.value));
      const show = !useDepts || (s && chosen.includes(s.departmentId));
      cb.closest(".multicheck-item").hidden = !show;
      if (!show) cb.checked = false;
    }
  };
  fm.addEventListener("change", (ev) => { if (ev.target === roleSel || ev.target.name === "departmentIds") apply(); });
  apply();
}
