/* Users & Roles page: Users CRUD (this file) + Roles panel.
   validateUserForm is pure (reads USERS/ROLES only) so it runs in the Node test harness. */

const USER_DEPT_MSG = "Select at least one department — otherwise this user cannot sign in";

/* Strip formatting from a pasted mobile: "+91 98765 00002" / "098765 00002" -> "9876500002".
   Anything that is not a recognisable 10-digit number is returned as bare digits so validation can reject it. */
function normalizeUserMobile(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const SELF_LOCKOUT_MSG = "You would lock yourself out";

/* Pure: would saving this user record lock the signed-in admin out of user management?
   Only applies when editing the signed-in user's own record. Returns a message or null. */
function userSelfLockout(values, editingId, currentUserId) {
  if (editingId == null || editingId !== currentUserId) return null;
  const role = values.roleId === "" || values.roleId == null ? null : ROLES.find((r) => r.id === Number(values.roleId));
  if (!role || role.active === false || role.level > 1 || !(role.perms || []).includes("addEditUsers")) return SELF_LOCKOUT_MSG;
  return null;
}

/* Pure: names of ACTIVE users holding `role` who could sign in today but could not if the role's level became `newLevel`
   (non-admin levels need at least one active department). */
function roleLevelLockouts(role, newLevel) {
  const canWith = (u, level) => level <= 1 || DEPARTMENTS.some((d) => d.active && (u.departmentIds || []).includes(d.id));
  return USERS.filter((u) => u.active && u.roleId === role.id && canWith(u, role.level) && !canWith(u, newLevel)).map((u) => u.name);
}

/* Returns { field: message } — empty object means valid. `values` are plain values. */
function validateUserForm(values, editingId) {
  const errs = {};
  const name = String(values.name ?? "").trim();
  if (!name) errs.name = "Name is required";

  const mobile = normalizeUserMobile(values.mobile);
  if (!/^\d{10}$/.test(mobile)) errs.mobile = "Mobile must be exactly 10 digits";
  else {
    const other = USERS.find((u) => u.mobile === mobile && u.id !== editingId);
    if (other) errs.mobile = `Mobile number already registered to ${other.name}`;
  }

  const email = String(values.email ?? "").trim();
  if (email && !EMAIL_RE.test(email)) errs.email = "Enter a valid email address";

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

/* ---------- Roles panel ---------- */
let rolesView = "table";
let rolesQuery = "";
const BUILTIN_ROLE_MAX_ID = 4;
const LEVEL_HINT = "L0/L1 see all departments; L2 sees their departments; L3 sees assigned sites";

/* Returns { field: message } — empty object means valid. Self-lockout is checked by the caller. */
function validateRoleForm(values, editingId) {
  const errs = {};
  const name = String(values.name ?? "").trim();
  if (!name) errs.name = "Role name is required";
  else if (ROLES.some((r) => r.id !== editingId && r.name.trim().toLowerCase() === name.toLowerCase())) errs.name = "A role with this name already exists";
  const raw = String(values.level ?? "").trim();
  const lv = Number(raw);
  if (raw === "" || !Number.isInteger(lv) || lv < 0 || lv > 3) errs.level = "Level must be 0, 1, 2 or 3";
  return errs;
}

function rolePermLabels(r) { return (r.perms || []).map((k) => PERM_LABELS[k] || k); }
function roleUserCount(r) { return USERS.filter((u) => u.roleId === r.id).length; }
function roleMatches(r, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  return [r.name, `L${r.level}`, String(r.level), ...rolePermLabels(r)].some((t) => String(t).toLowerCase().includes(q));
}
const isBuiltinRole = (r) => r.id <= BUILTIN_ROLE_MAX_ID;

function rolesTableHtml() {
  return UI.tableHost({
    id: "roles",
    searchPlaceholder: "Search roles…",
    emptyText: "No roles found",
    rows: () => ROLES,
    columns: [
      { label: "Level", text: (r) => `L${r.level}`, html: (r) => `<span class="text-mono">L${r.level}</span>` },
      { label: "Role", text: (r) => r.name },
      { label: "Users", text: (r) => String(roleUserCount(r)) },
      { label: "Permissions", text: (r) => rolePermLabels(r).join(" "),
        html: (r) => `<span title="${esc(rolePermLabels(r).join(", ") || "None")}">${(r.perms || []).length}</span>` },
      { label: "Active", text: (r) => (r.active !== false ? "Active" : "Inactive"),
        html: (r) => UI.switchHtml(r.active !== false, `toggleRoleActive(${r.id}, this.checked)`) },
    ],
    rowActions: [
      { key: "edit", label: "Edit role", icon: "✎" },
      { key: "delete", label: "Delete role", icon: "×", danger: true, show: (r) => !isBuiltinRole(r) },
    ],
    onAction: (act, r) => { if (act === "edit") openRoleForm(r.id); else if (act === "delete") deleteRole(r.id); },
    onRowClick: (r) => openRoleForm(r.id),
    toolbarBind: (extra) => {
      const host = extra.closest(".ui-table");
      const search = host.querySelector(".ui-search");
      search.addEventListener("input", () => { rolesQuery = search.value; });
      if (rolesQuery && search.value !== rolesQuery) { search.value = rolesQuery; search.dispatchEvent(new Event("input")); }
    },
  });
}

function rolesGridHtml() {
  const list = ROLES.filter((r) => roleMatches(r, rolesQuery));
  const cards = list.map((r) => {
    const perms = rolePermLabels(r);
    return `<div class="role-card${r.active === false ? " inactive" : ""}" tabindex="0" role="button" aria-label="Edit ${esc(r.name)}" onclick="openRoleForm(${r.id})" onkeydown="if(event.key==='Enter'&&event.target===this)openRoleForm(${r.id})">
      <div class="role-card-top"><span class="tag neutral">L${r.level}</span>
        <span onclick="event.stopPropagation()">${UI.switchHtml(r.active !== false, `toggleRoleActive(${r.id}, this.checked)`)}</span></div>
      <div class="role-card-name">${esc(r.name)}</div>
      <div class="dim role-card-users">${roleUserCount(r)} user${roleUserCount(r) === 1 ? "" : "s"}</div>
      <div class="pill-row role-card-perms">${perms.length ? perms.map((p) => `<span class="tag ok">${esc(p)}</span>`).join("") : `<span class="dim">No permissions</span>`}</div>
      ${isBuiltinRole(r) ? "" : `<button type="button" class="icon-btn danger role-card-del" title="Delete role" aria-label="Delete role" onclick="event.stopPropagation();deleteRole(${r.id})">×</button>`}
    </div>`;
  }).join("");
  return `<div class="ui-toolbar"><div class="ui-toolbar-extra"></div>
      <input type="search" class="ui-search" id="rolesGridSearch" placeholder="Search roles…" value="${esc(rolesQuery)}" aria-label="Search" oninput="rolesGridSearch(this.value)"></div>
    <div class="role-grid" id="rolesGrid">${cards || `<div class="ui-empty">No roles found</div>`}</div>`;
}

function rolesGridSearch(q) {
  rolesQuery = q;
  const g = document.getElementById("rolesGrid");
  if (!g) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = rolesGridHtml();
  g.innerHTML = tmp.querySelector("#rolesGrid").innerHTML;
}

function setRolesView(v) { rolesView = v === "grid" ? "grid" : "table"; render(); }

function pageRolesPanel() {
  const canEdit = can("addEditUsers");
  const seg = (v, label) => `<button type="button" class="tab${rolesView === v ? " active" : ""}" aria-pressed="${rolesView === v}" onclick="setRolesView('${v}')">${label}</button>`;
  return `<div class="panel">
      <div class="panel-head"><div class="panel-title">Roles</div>
        <div class="roles-head-actions"><div class="tabs roles-view-toggle" style="margin:0;">${seg("table", "Table")}${seg("grid", "Grid")}</div>
          <button class="btn teal small" ${canEdit ? "" : "disabled"} onclick="openRoleForm()">+ New Role</button></div></div>
      <div class="panel-body">${rolesView === "grid" ? rolesGridHtml() : rolesTableHtml()}</div>
    </div>`;
}

function toggleRoleActive(id, checked) {
  const r = byId(ROLES, id);
  if (!r) return;
  if (!can("addEditUsers")) { showToast("You don't have permission to manage roles"); render(); return; }
  if (!checked) {
    const n = USERS.filter((u) => u.roleId === id && u.active).length;
    if (n) { showToast(`Can't deactivate ${esc(r.name)}: held by ${n} active user${n === 1 ? "" : "s"}`); render(); return; }
  }
  r.active = !!checked;
  logUserAudit(r.active ? "Role Activated" : "Role Deactivated", `${r.name} ${r.active ? "activated" : "deactivated"}`);
  showToast(`${esc(r.name)} ${r.active ? "activated" : "deactivated"}`);
  render();
}

function deleteRole(id) {
  const r = byId(ROLES, id);
  if (!r) return;
  if (!can("addEditUsers")) { showToast("You don't have permission to manage roles"); return; }
  if (isBuiltinRole(r)) { showToast("Built-in roles cannot be deleted"); return; }
  const n = roleUserCount(r);
  if (n) { showToast(`Can't delete ${esc(r.name)}: assigned to ${n} user${n === 1 ? "" : "s"}`); return; }
  UI.confirm(`Delete role ${r.name}? This cannot be undone.`, () => {
    const i = ROLES.findIndex((x) => x.id === id);
    if (i >= 0) ROLES.splice(i, 1);
    logUserAudit("Role Deleted", `${r.name} deleted`);
    showToast(`${esc(r.name)} deleted`);
    render();
  }, { title: "Delete role", yesLabel: "Delete" });
}

function openRoleForm(id) {
  if (!can("addEditUsers")) { showToast("You don't have permission to manage roles"); return; }
  const editing = id != null ? byId(ROLES, id) : null;
  if (id != null && !editing) return;
  UI.form({
    title: editing ? "Edit Role" : "New Role",
    submitLabel: editing ? "Save Changes" : "Create Role",
    values: editing ? { name: editing.name, level: String(editing.level), perms: (editing.perms || []).slice(), active: editing.active !== false }
                    : { name: "", level: "", perms: [], active: true },
    fields: [
      { name: "name", label: "Role name", type: "text", required: true },
      { name: "level", label: "Level", type: "select", required: true, hint: LEVEL_HINT,
        options: [0, 1, 2, 3].map((n) => ({ value: n, label: `L${n}` })) },
      { name: "perms", label: "Permissions", type: "multicheck", options: PERM_KEYS.map((k) => ({ value: k, label: PERM_LABELS[k] || k })) },
      { name: "active", label: "Active", type: "checkbox" },
    ],
    onSubmit: (vals) => {
      const errs = validateRoleForm(vals, editing ? editing.id : null);
      const first = errs.name || errs.level;
      if (first) return first;
      const level = Number(vals.level);
      if (editing) {
        const me = currentUser();
        if (me && me.roleId === editing.id && (!vals.perms.includes("addEditUsers") || level > 1)) return "You would lock yourself out";
        if (!vals.active && editing.active !== false) {
          const n = USERS.filter((u) => u.roleId === editing.id && u.active).length;
          if (n) return `Can't deactivate ${editing.name}: held by ${n} active user${n === 1 ? "" : "s"}`;
        }
        if (level !== editing.level) {
          const hit = roleLevelLockouts(editing, level);
          if (hit.length) return `Assign departments to: ${hit.join(", ")} first`;
        }
        Object.assign(editing, { name: vals.name, level, perms: vals.perms, active: vals.active });
        logUserAudit("Role Updated", `${vals.name} updated`);
        showToast(`${esc(vals.name)} updated`);
      } else {
        ROLES.push({ id: Store.nextId(ROLES), name: vals.name, level, perms: vals.perms, active: vals.active });
        logUserAudit("Role Added", `${vals.name} created`);
        showToast(`${esc(vals.name)} created`);
      }
      render();
      return null;
    },
  });
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
  if (!can("addEditUsers")) { showToast("You don't have permission to manage users"); render(); return; }
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
  if (!can("addEditUsers")) { showToast("You don't have permission to manage users"); return; }
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
      { name: "mobile", label: "Mobile", type: "tel", required: true, maxlength: 16, placeholder: "10-digit number", normalize: normalizeUserMobile,
        hint: editing ? "Login uses this number + OTP. Changes apply at the next sign-in." : undefined,
        validate: (v) => validateUserForm({ name: "x", mobile: v, roleId: 0 }, editing ? editing.id : null).mobile },
      { name: "email", label: "Email", type: "email", validate: (v) => (EMAIL_RE.test(v) ? null : "Enter a valid email address") },
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
      const first = errs.name || errs.mobile || errs.email || errs.roleId || errs.departmentIds;
      if (first) return first;
      if (editing && editing.id === state.currentUserId && !vals.active) return "You can't deactivate your own account";
      const lock = userSelfLockout(vals, editing ? editing.id : null, state.currentUserId);
      if (lock) return lock;
      // keep only sites that belong to the chosen departments (when any chosen)
      const sites = depts.length ? vals.siteIds.filter((sid) => { const s = byId(SITES, sid); return s && depts.includes(s.departmentId); }) : vals.siteIds;
      const rec = { name: vals.name, mobile: normalizeUserMobile(vals.mobile), email: vals.email, designation: vals.designation,
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
  const siteBox = siteBoxes[0] && siteBoxes[0].closest(".multicheck");
  const note = document.createElement("div");
  note.className = "field-hint site-note";
  note.hidden = true;
  if (siteBox) siteBox.after(note);
  const apply = () => {
    let removed = 0;
    const r = roleSel.value === "" ? null : byId(ROLES, Number(roleSel.value));
    if (deptField) deptField.hidden = !!r && r.level <= 1;
    const chosen = [...fm.querySelectorAll('input[name="departmentIds"]:checked')].map((x) => Number(x.value));
    const useDepts = !(deptField && deptField.hidden) && chosen.length;
    for (const cb of siteBoxes) {
      const s = byId(SITES, Number(cb.value));
      const show = !useDepts || (s && chosen.includes(s.departmentId));
      cb.closest(".multicheck-item").hidden = !show;
      if (!show) { if (cb.checked) removed++; cb.checked = false; }
    }
    if (removed) { note.textContent = `${removed} site${removed === 1 ? "" : "s"} removed — not in the selected departments`; note.hidden = false; }
    else note.hidden = true;
  };
  fm.addEventListener("change", (ev) => { if (ev.target === roleSel || ev.target.name === "departmentIds") apply(); });
  apply();
}
