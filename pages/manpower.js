/* Manpower page: table with quick filters, add/edit dialog (Details / Biometric Data / Mapped Sites tabs).
   validateLabourForm, filterManpower, canDeleteLabour and deleteLabourRecords are pure data helpers (no DOM). */

const manpowerView = { activeOnly: false, siteId: "", unmappedOnly: false };

/* Returns { field: message } — empty object means valid. */
function validateLabourForm(values, editingId) {
  const errs = {};
  if (!String(values.name ?? "").trim()) errs.name = "Name is required";
  const aadhaar = String(values.aadhaar ?? "").trim();
  if (!aadhaar) errs.aadhaar = "Aadhaar is required";
  else if (!/^\d{12}$/.test(aadhaar)) errs.aadhaar = "Aadhaar must be exactly 12 digits";
  else {
    const dup = LABOUR.find((l) => l.id !== editingId && l.aadhaar === aadhaar && l.approvalStatus !== "Rejected");
    if (dup) errs.aadhaar = `Duplicate Aadhaar — already registered as ${dup.name} (Labour ID ${dup.id}).`;
  }
  const phone = String(values.phone ?? "").trim();
  if (!phone) errs.phone = "Phone is required";
  else if (!/^\d{10}$/.test(phone)) errs.phone = "Phone must be exactly 10 digits";
  if (!String(values.skill ?? "").trim()) errs.skill = "Skill is required";
  const w = values.wageRate;
  if (w === "" || w == null) errs.wageRate = "Wage per day is required";
  else if (!isFinite(Number(w)) || Number(w) <= 0) errs.wageRate = "Wage per day must be greater than 0";
  return errs;
}

/* rows: labour objects. unmappedOnly wins over siteId (an unmapped labour has no site). */
function filterManpower(rows, opts) {
  const o = opts || {};
  return rows.filter((l) => {
    if (o.activeOnly && !l.active) return false;
    if (o.unmappedOnly) return isUnmapped(l.id);
    if (o.siteId !== "" && o.siteId != null && !labourSiteIds(l.id).includes(Number(o.siteId))) return false;
    return true;
  });
}

function canDeleteLabour(labourId) {
  if (ATTENDANCE.some((a) => a.labourId === labourId)) return { ok: false, reason: "has attendance records — deactivate instead" };
  if (WAGES.some((w) => w.labourId === labourId)) return { ok: false, reason: "has wage records — deactivate instead" };
  if (APPROVAL_REQUESTS.some((r) => r.labourId === labourId)) return { ok: false, reason: "has approval records — deactivate instead" };
  return { ok: true, reason: "" };
}

/* Removes the labour together with its site mappings and biometric images. */
function deleteLabourRecords(labourId) {
  for (const arr of [LABOUR_SITES, BIOMETRICS]) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].labourId === labourId) arr.splice(i, 1);
  }
  const i = LABOUR.findIndex((l) => l.id === labourId);
  if (i >= 0) LABOUR.splice(i, 1);
}

/* ---------- table ---------- */
const labourApprovalKind = (s) => (s === "Approved" ? "ok" : s === "Pending" ? "warn" : "danger");
const labourBioCount = (id) => BIOMETRICS.filter((b) => b.labourId === id).length;
/* Sites the current user may map manpower to: all for Level 0-1, otherwise the scoped sites. */
function offeredSites() {
  return Auth.isAllDeptRole(currentUser()) ? SITES.slice() : SITES.filter((s) => scopedSiteIds().includes(s.id));
}
function visibleLabour() {
  const scoped = scopedSiteIds();
  return LABOUR.filter((l) => labourInSites(l, scoped) || (isUnmapped(l.id) && can("addLabour")));
}

function manpowerTableHtml() {
  return UI.tableHost({
    id: "manpower",
    searchPlaceholder: "Search manpower…",
    emptyText: "No manpower found",
    rows: () => filterManpower(visibleLabour(), manpowerView),
    columns: [
      { label: "Name", text: (l) => l.name },
      { label: "Phone", text: (l) => l.phone, html: (l) => `<span class="text-mono">${esc(l.phone)}</span>` },
      { label: "Skill", text: (l) => l.skill },
      { label: "Wage/day", text: (l) => String(l.wageRate), html: (l) => esc(currency(l.wageRate)), align: "right" },
      { label: "Site(s)", text: (l) => labourSiteNames(l.id), html: (l) => (isUnmapped(l.id) ? UI.tag("Unmapped", "neutral") : esc(labourSiteNames(l.id))) },
      { label: "Biometric", text: (l) => (labourBioCount(l.id) ? String(labourBioCount(l.id)) : "—") },
      { label: "Approval", text: (l) => l.approvalStatus, html: (l) => UI.tag(l.approvalStatus, labourApprovalKind(l.approvalStatus)) },
      { label: "Status", text: (l) => (l.active ? "Active" : "Inactive"), html: (l) => UI.switchHtml(l.active, `toggleLabourActive(${l.id}, this.checked)`) },
    ],
    rowActions: [
      { key: "edit", label: "Edit manpower", icon: "✎" },
      { key: "delete", label: "Delete manpower", icon: "✕", danger: true },
    ],
    onAction: (act, l) => { if (act === "edit") openManpowerModal(l.id, "details"); else if (act === "delete") deleteLabour(l.id); },
    onRowClick: (l) => openManpowerModal(l.id, "details"),
    toolbarHtml: () => `
      <label class="multicheck-item"><input type="checkbox" data-mf="active" ${manpowerView.activeOnly ? "checked" : ""}><span>Active only</span></label>
      <select data-mf="site" aria-label="Site filter">
        <option value="">All sites</option>
        ${SITES.filter((s) => scopedSiteIds().includes(s.id)).map((s) => `<option value="${s.id}" ${String(manpowerView.siteId) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
      </select>
      <label class="multicheck-item"><input type="checkbox" data-mf="unmapped" ${manpowerView.unmappedOnly ? "checked" : ""}><span>Show unmapped manpower</span></label>`,
    toolbarBind: (extra) => {
      extra.addEventListener("change", (ev) => {
        const k = ev.target.dataset && ev.target.dataset.mf;
        if (!k) return;
        if (k === "active") manpowerView.activeOnly = ev.target.checked;
        else if (k === "unmapped") manpowerView.unmappedOnly = ev.target.checked;
        else if (k === "site") manpowerView.siteId = ev.target.value === "" ? "" : Number(ev.target.value);
        UI.refresh("manpower");
      });
    },
  });
}

function pageManpower() {
  const n = visibleLabour().length;
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Manpower</div>
        <div class="page-sub">${n} record${n === 1 ? "" : "s"} in your visibility scope.</div>
      </div>
      <button class="btn teal" ${can("addLabour") ? "" : "disabled"} onclick="openManpowerModal(null)">+ Add Manpower</button>
    </div>
    ${manpowerTableHtml()}
  `;
}

function logLabourAudit(action, details) {
  AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action, details });
}

function toggleLabourActive(id, checked) {
  const l = byId(LABOUR, id);
  if (!l) return;
  if (!can("addLabour")) { showToast("You don't have permission to change manpower"); render(); return; }
  if (checked && l.approvalStatus !== "Approved") { showToast("Only approved manpower can be activated"); render(); return; }
  l.active = !!checked;
  logLabourAudit(l.active ? "Labour Activated" : "Labour Deactivated", `${l.name} ${l.active ? "activated" : "deactivated"}`);
  showToast(`${esc(l.name)} ${l.active ? "activated" : "deactivated"}`);
  render();
}

function deleteLabour(id) {
  const l = byId(LABOUR, id);
  if (!l) return;
  if (!can("addLabour")) { showToast("You don't have permission to delete manpower"); return; }
  const chk = canDeleteLabour(id);
  if (!chk.ok) { showToast(`Can't delete ${esc(l.name)}: ${chk.reason}`); return; }
  UI.confirm(`Delete ${l.name}? Their site mapping and biometric images are removed too. This cannot be undone.`, () => {
    deleteLabourRecords(id);
    logLabourAudit("Labour Deleted", `${l.name} deleted`);
    showToast(`${esc(l.name)} deleted`);
    render();
  }, { title: "Delete manpower", yesLabel: "Delete" });
}

/* ---------- dialog ---------- */
function labourDetailsHtml(l, editable) {
  const v = l || { category: "Skilled", joiningDate: nowStamp().slice(0, 10) };
  const dis = editable ? "" : " disabled";
  const fld = (name, label, ctl, cls) => `<div class="field${cls ? " " + cls : ""}" data-field="${name}"><label>${label}</label>${ctl}<div class="field-error" data-err="${name}"></div></div>`;
  const inp = (name, type, val, extra) => `<input name="${name}" type="${type}" value="${esc(val ?? "")}"${extra || ""}${dis}>`;
  const cats = ["Skilled", "Unskilled"];
  const cat = `<select name="category"${dis}>${cats.map((c) => `<option value="${c}" ${c === v.category ? "selected" : ""}>${c}</option>`).join("")}</select>`;
  const sites = offeredSites();
  const mapField = l ? "" : fld("siteIds", "Map to site (optional)",
    `<div class="multicheck">${sites.length ? sites.map((s) => `<label class="multicheck-item"><input type="checkbox" name="siteIds" value="${s.id}"${dis}><span>${esc(s.name)}</span></label>`).join("") : `<span class="dim">No sites available</span>`}</div>`, "full");
  const status = l
    ? fld("approval", "Approval", UI.tag(l.approvalStatus, labourApprovalKind(l.approvalStatus)) + (l.rejectionReason ? `<div class="field-hint">${esc(l.rejectionReason)}</div>` : ""))
    : fld("approval", "Approval", `<span class="dim">${can("approveLabour") ? "Created as Approved and active" : "Submitted for approval (Pending, inactive)"}</span>`);
  const active = l ? fld("active", "Status", `<label class="multicheck-item"><input type="checkbox" name="active" ${l.active ? "checked" : ""}${dis}><span>Active</span></label>`) : "";
  return `<form class="ui-form" id="labourForm" novalidate><div class="form-grid">
    ${fld("name", "Name *", inp("name", "text", v.name, ` placeholder="Worker full name"`), "full")}
    ${fld("aadhaar", "Aadhaar (12 digits) *", inp("aadhaar", "text", v.aadhaar, ` maxlength="12" inputmode="numeric" placeholder="234567890199"`))}
    ${fld("phone", "Phone (10 digits) *", inp("phone", "tel", v.phone, ` maxlength="10" inputmode="numeric" placeholder="9556100099"`))}
    ${fld("address", "Address", inp("address", "text", v.address), "full")}
    ${fld("category", "Category", cat)}
    ${fld("skill", "Skill *", inp("skill", "text", v.skill, ` placeholder="e.g. Mason"`))}
    ${fld("wageRate", "Wage per day *", inp("wageRate", "number", v.wageRate, ` min="1" step="1"`))}
    ${fld("joiningDate", "Joining date", inp("joiningDate", "date", v.joiningDate))}
    ${status}
    ${active}
    ${mapField}
  </div>
  <div class="field-error ui-form-error" data-err="_form"></div>
  <div class="form-actions"><button type="button" class="btn secondary" data-cancel>${editable ? "Cancel" : "Close"}</button>${editable ? `<button type="submit" class="btn teal">${l ? "Save changes" : (can("approveLabour") ? "Create manpower" : "Submit for approval")}</button>` : ""}</div>
  </form>`;
}

function labourBiometricHtml(l, editable) {
  if (!l) return `<div class="section-note">Save the manpower first, then add biometric (thumb impression) images here.</div>`;
  const imgs = BIOMETRICS.filter((b) => b.labourId === l.id);
  const grid = imgs.length
    ? `<div class="bio-grid">${imgs.map((b) => `<div class="bio-tile">
        <img class="bio-thumb" src="${esc(b.imageDataUrl)}" alt="${esc(b.label)}">
        <div class="bio-label">${esc(b.label)}</div><div class="bio-date dim">${esc(b.capturedOn)}</div>
        ${editable ? `<button type="button" class="icon-btn danger" data-bio-del="${b.id}" title="Delete image" aria-label="Delete ${esc(b.label)}">✕</button>` : ""}
      </div>`).join("")}</div>`
    : UI.emptyState("No biometric images yet");
  const add = editable ? `<div class="bio-add" id="bioAdd">
      <div class="field"><label>Label</label><input name="bioLabel" type="text" placeholder="e.g. Right thumb"></div>
      <div class="field"><label>Image file</label><input name="bioFile" type="file" accept="image/*"></div>
      <button type="button" class="btn teal" id="bioSave">Add image</button>
      <div class="field-error" id="bioErr" role="alert"></div>
    </div>` : `<div class="section-note">You cannot change biometric data for this record.</div>`;
  return `<div id="bioTab">${grid}${add}</div>`;
}

function labourSitesTabHtml(l, editable) {
  if (!l) return `<div class="section-note">Save the manpower first, then map it to sites here (or pick sites on the Details tab).</div>`;
  const offered = offeredSites();
  const mapped = labourSiteIds(l.id);
  const hidden = mapped.filter((id) => !offered.some((s) => s.id === id)).length;
  return `<div id="msTab">
    <div class="mp-list">${offered.length ? offered.map((s) => `<label class="mp-row"><input type="checkbox" value="${s.id}" ${mapped.includes(s.id) ? "checked" : ""}${editable ? "" : " disabled"}>
      <span class="mp-name">${esc(s.name)}</span><span class="mp-sub">${esc(deptName(s.departmentId))} · ${esc(s.status)}</span></label>`).join("") : UI.emptyState("No sites available")}</div>
    ${hidden ? `<div class="section-note">${hidden} mapping${hidden === 1 ? "" : "s"} outside your scope will be kept.</div>` : ""}
    <div class="mp-foot"><span class="mp-counter" id="msNote" role="status"></span>
      <button type="button" class="btn teal" id="msSave"${editable ? "" : " disabled"}>Save mapping</button></div>
  </div>`;
}

function readLabourForm(fm) {
  const g = (n) => fm.elements[n];
  const raw = g("wageRate").value.trim();
  return {
    name: g("name").value.trim(), aadhaar: g("aadhaar").value.trim(), phone: g("phone").value.trim(), address: g("address").value.trim(),
    category: g("category").value, skill: g("skill").value.trim(), wageRate: raw === "" ? "" : Number(raw), joiningDate: g("joiningDate").value,
    active: g("active") ? g("active").checked : undefined,
    siteIds: [...fm.querySelectorAll('input[name="siteIds"]:checked')].map((c) => Number(c.value)),
  };
}

function bindLabourForm(l) {
  const fm = document.getElementById("labourForm");
  if (!fm) return;
  fm.querySelector("[data-cancel]").addEventListener("click", () => closeModal());
  fm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!can("addLabour")) return;
    const vals = readLabourForm(fm);
    fm.querySelectorAll("[data-err]").forEach((el) => { el.textContent = ""; });
    const errs = validateLabourForm(vals, l ? l.id : null);
    if (l && vals.active && l.approvalStatus !== "Approved") errs.active = "Only approved manpower can be activated";
    const keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach((k) => { const el = fm.querySelector(`[data-err="${k}"]`); if (el) el.textContent = errs[k]; });
      const c = fm.elements[keys[0]];
      if (c) c.focus();
      return;
    }
    const rec = { name: vals.name, aadhaar: vals.aadhaar, phone: vals.phone, address: vals.address || "—", category: vals.category, skill: vals.skill, wageRate: vals.wageRate, joiningDate: vals.joiningDate };
    if (l) {
      Object.assign(l, rec, { active: !!vals.active });
      logLabourAudit("Labour Updated", `${l.name} updated`);
      closeModal();
      showToast(`${esc(l.name)} updated`);
      render();
      return;
    }
    const approver = can("approveLabour");
    const id = Store.nextId(LABOUR);
    const row = { id, biometricRef: "", siteId: null, ...rec, active: approver, approvalStatus: approver ? "Approved" : "Pending" };
    LABOUR.push(row);
    if (vals.siteIds.length) mapLabourToSites(id, vals.siteIds);
    if (!approver) {
      const stamp = nowStamp();
      APPROVAL_REQUESTS.push({ id: Store.nextId(APPROVAL_REQUESTS), type: "Manpower Onboarding", title: `Onboard ${row.name}`, description: `Onboarding request for ${row.name}.`, siteId: vals.siteIds.length ? vals.siteIds[0] : null, labourId: id, amount: null, priority: "Normal", requestedBy: state.currentUserId, requestDate: stamp, status: "Pending", approvedBy: null, decisionDate: null, attachments: [], history: [{ at: stamp, by: state.currentUserId, action: "Created", remark: "" }] });
    }
    logLabourAudit("Labour Added", approver ? `${row.name} added` : `${row.name} submitted for approval`);
    showToast(approver ? `${esc(row.name)} added` : "Manpower submitted for approval");
    render();
    openManpowerModal(id, "details");
  });
}

function bindLabourBiometric(l) {
  const root = document.getElementById("bioTab");
  if (!root || !l) return;
  const reopen = () => { render(); openManpowerModal(l.id, "biometric"); };
  root.addEventListener("click", (ev) => {
    const del = ev.target.closest("[data-bio-del]");
    if (!del || !can("addLabour")) return;
    const b = byId(BIOMETRICS, Number(del.dataset.bioDel));
    if (!b) return;
    UI.confirm(`Delete the biometric image "${b.label}"?`, () => {
      const i = BIOMETRICS.findIndex((x) => x.id === b.id);
      if (i >= 0) BIOMETRICS.splice(i, 1);
      logLabourAudit("Biometric Deleted", `${b.label} removed for ${l.name}`);
      showToast("Biometric image deleted");
      reopen();
    }, { title: "Delete biometric image", yesLabel: "Delete" });
  });
  const save = document.getElementById("bioSave");
  if (!save) return;
  const err = document.getElementById("bioErr");
  save.addEventListener("click", async () => {
    if (!can("addLabour")) return;
    err.textContent = "";
    const label = root.querySelector('[name="bioLabel"]').value.trim();
    const file = root.querySelector('[name="bioFile"]').files[0];
    if (!label) { err.textContent = "Label is required"; return; }
    if (!file) { err.textContent = "Choose an image file"; return; }
    let dataUrl;
    try { dataUrl = await UI.readImage(file); } catch (e) { err.textContent = e.message; return; }
    const hash = biometricHash(dataUrl);
    const dup = findBiometricDuplicate(hash);
    if (dup) { err.textContent = `This impression is already registered to ${dup.labour ? dup.labour.name : "another person"}`; return; }
    BIOMETRICS.push({ id: Store.nextId(BIOMETRICS), labourId: l.id, label, imageDataUrl: dataUrl, hash, capturedOn: nowStamp().slice(0, 10) });
    if (!l.biometricRef) l.biometricRef = "BIO" + l.id + labourBioCount(l.id);
    logLabourAudit("Biometric Added", `${label} added for ${l.name}`);
    showToast("Biometric image added");
    reopen();
  });
}

function bindLabourSites(l) {
  const root = document.getElementById("msTab");
  if (!root || !l) return;
  const note = document.getElementById("msNote");
  const boxes = () => [...root.querySelectorAll('.mp-list input[type="checkbox"]')];
  const upd = () => { const n = boxes().filter((c) => c.checked).length; note.textContent = n ? `${n} site${n === 1 ? "" : "s"} selected` : "Unmapped — no site selected"; };
  root.addEventListener("change", upd);
  upd();
  document.getElementById("msSave").addEventListener("click", () => {
    if (!can("addLabour")) { showToast("You cannot change this mapping"); return; }
    const offeredIds = offeredSites().map((s) => s.id);
    const kept = labourSiteIds(l.id).filter((id) => !offeredIds.includes(id));
    const picked = boxes().filter((c) => c.checked).map((c) => Number(c.value));
    mapLabourToSites(l.id, [...picked, ...kept]);
    logLabourAudit("Labour Mapped", `${l.name} mapped to ${labourSiteNames(l.id)}`);
    showToast(isUnmapped(l.id) ? `${esc(l.name)} is now unmapped` : `${esc(l.name)} mapped to ${labourSiteIds(l.id).length} site(s)`);
    render();
    openManpowerModal(l.id, "sites");
  });
}

/* labourId null = create mode (Details tab only). tab: details | biometric | sites */
function openManpowerModal(labourId, tab) {
  const l = labourId == null ? null : byId(LABOUR, labourId);
  if (labourId != null && !l) return;
  if (!l && !can("addLabour")) return;
  const editable = can("addLabour");
  const items = [
    { key: "details", label: "Details", html: labourDetailsHtml(l, editable) },
    { key: "biometric", label: "Biometric Data", html: labourBiometricHtml(l, editable) },
    { key: "sites", label: "Mapped Sites", html: labourSitesTabHtml(l, editable) },
  ];
  openModal(esc(l ? l.name : "Add Manpower"), UI.tabs("manpower-popup", items, l ? tab : "details"), { wide: true });
  bindLabourForm(l);
  bindLabourBiometric(l);
  bindLabourSites(l);
}
