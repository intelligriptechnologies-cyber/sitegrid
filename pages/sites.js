/* Sites & Projects page: compact cards, View/Edit popup (Overview / Details / Manpower Config tabs).
   validateSiteForm is pure (reads SITES only) so it runs in the Node test harness. */

const SITE_STATUSES = ["Active", "Paused", "Completed"];
const siteStatusTag = (s) => (s === "Active" ? "ok" : s === "Paused" ? "warn" : "neutral");
const sitesView = { q: "", status: "" };

/* Returns { field: message } — empty object means valid. `values` are plain values (numbers or "" for blanks). */
function validateSiteForm(values, editingId) {
  const errs = {};
  const name = String(values.name ?? "").trim();
  if (!name) errs.name = "Site name is required";
  else if (SITES.some((s) => s.id !== editingId && String(s.name).trim().toLowerCase() === name.toLowerCase())) errs.name = "A site with this name already exists";

  if (values.departmentId === "" || values.departmentId == null) errs.departmentId = "Department is required";

  const blank = (v) => v === "" || v == null;
  if (!blank(values.areaSqft)) {
    const a = Number(values.areaSqft);
    if (!isFinite(a) || a <= 0) errs.areaSqft = "Area must be greater than 0";
  }
  if (!blank(values.lat)) {
    const n = Number(values.lat);
    if (!isFinite(n) || n < -90 || n > 90) errs.lat = "Latitude must be between -90 and 90";
  }
  if (!blank(values.lng)) {
    const n = Number(values.lng);
    if (!isFinite(n) || n < -180 || n > 180) errs.lng = "Longitude must be between -180 and 180";
  }
  if (values.startDate && values.endDate && String(values.endDate) < String(values.startDate)) errs.endDate = "End date cannot be before the start date";
  return errs;
}

function canEditSite(site) {
  return !!site && can("addSite") && scopedSiteIds().includes(site.id);
}

function siteMatches(s, q, status) {
  if (status && s.status !== status) return false;
  const t = String(q || "").trim().toLowerCase();
  if (!t) return true;
  return [s.name, deptName(s.departmentId), s.projectType, clientName(s.clientId), s.address, userName(s.pmUserId), userName(s.peUserId), s.status]
    .some((x) => String(x ?? "").toLowerCase().includes(t));
}

function siteCardHtml(s) {
  const n = siteLabourIds(s.id).length;
  const fx = (k, v) => `<div class="kv-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  return `<div class="site-card compact" data-site="${s.id}">
    <div class="site-card-head">
      <div>
        <div class="site-name">${esc(s.name)}</div>
        <div class="site-meta">${esc(deptName(s.departmentId))} · ${esc(s.projectType)}</div>
      </div>
      ${UI.tag(s.status, siteStatusTag(s.status))}
    </div>
    <div class="site-desc" title="${esc(s.description)}">${esc(s.description)}</div>
    <div class="kv-list compact">
      ${fx("Client", esc(clientName(s.clientId)))}
      ${fx("Timeline", `${esc(s.startDate || "—")} → ${esc(s.endDate || "—")}`)}
      ${fx("PM / PE", `${esc(userName(s.pmUserId))} / ${esc(userName(s.peUserId))}`)}
      ${fx("Manpower", `${n} mapped`)}
    </div>
    <div class="site-card-actions">
      <button type="button" class="btn secondary small" onclick="openSiteModal(${s.id},'overview')">View</button>
      ${canEditSite(s) ? `<button type="button" class="btn teal small" onclick="openSiteModal(${s.id},'details')">Edit</button>` : ""}
    </div>
  </div>`;
}

function siteGridHtml() {
  const scoped = scopedSiteIds();
  const rows = SITES.filter((s) => scoped.includes(s.id) && siteMatches(s, sitesView.q, sitesView.status));
  return rows.length ? `<div class="grid cols-3">${rows.map(siteCardHtml).join("")}</div>` : UI.emptyState("No sites match your search");
}

function refreshSiteGrid() {
  const el = document.getElementById("siteGrid");
  if (el) el.innerHTML = siteGridHtml();
}
function sitesSetQuery(v) { sitesView.q = v; refreshSiteGrid(); }
function sitesSetStatus(v) { sitesView.status = v; refreshSiteGrid(); }

function pageSites() {
  const scoped = scopedSiteIds();
  const total = SITES.filter((s) => scoped.includes(s.id)).length;
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Sites &amp; Projects</div>
        <div class="page-sub">${total} site${total === 1 ? "" : "s"} in your visibility scope.</div>
      </div>
      <button class="btn teal" ${can("addSite") ? "" : "disabled"} onclick="openSiteModal(null)">+ New Site</button>
    </div>
    <div class="sites-toolbar">
      <select id="siteStatusFilter" aria-label="Status filter" onchange="sitesSetStatus(this.value)">
        ${[["", "All statuses"], ...SITE_STATUSES.map((x) => [x, x])].map(([v, l]) => `<option value="${esc(v)}" ${v === sitesView.status ? "selected" : ""}>${esc(l)}</option>`).join("")}
      </select>
      <input type="search" class="ui-search" id="siteSearch" placeholder="Search sites…" aria-label="Search sites" value="${esc(sitesView.q)}" oninput="sitesSetQuery(this.value)">
    </div>
    <div id="siteGrid">${siteGridHtml()}</div>
  `;
}

/* ---------- popup ---------- */
function siteOverviewHtml(s) {
  const kv = (k, v) => `<div class="kv-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const gps = typeof s.lat === "number" && typeof s.lng === "number" ? `<div class="gps-chip">GPS ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</div>` : "";
  return `<div class="site-overview">
    <div class="site-ov-head">${UI.tag(s.status, siteStatusTag(s.status))}<span class="site-meta">${esc(deptName(s.departmentId))} · ${esc(s.projectType)}</span></div>
    <div class="site-desc full">${esc(s.description || "")}</div>
    ${gps}
    <div class="kv-list">
      ${kv("Area", s.areaSqft ? `${Number(s.areaSqft).toLocaleString("en-IN")} sqft` : "—")}
      ${kv("Client", esc(clientName(s.clientId)))}
      ${kv("Address", esc(s.address || "—"))}
      ${kv("Timeline", `${esc(s.startDate || "—")} → ${esc(s.endDate || "—")}`)}
      ${kv("PM / PE", `${esc(userName(s.pmUserId))} / ${esc(userName(s.peUserId))}`)}
      ${kv("Manpower", `${siteLabourIds(s.id).length} mapped`)}
    </div>
    ${s.notes ? `<div class="section-note">${esc(s.notes)}</div>` : ""}
  </div>`;
}

function siteDetailsFormHtml(s, editable) {
  const v = s || { status: "Active", projectType: "Residential" };
  const dis = editable ? "" : " disabled";
  const opts = (arr, cur) => arr.map(([val, label]) => `<option value="${esc(val)}" ${String(val) === String(cur ?? "") ? "selected" : ""}>${esc(label)}</option>`).join("");
  const u = currentUser();
  const allowed = Auth.isAllDeptRole(u) ? DEPARTMENTS.filter((d) => d.active !== false) : Auth.allowedDepartments(u);
  const depts = allowed.slice();
  if (s && !depts.some((d) => d.id === s.departmentId) && byId(DEPARTMENTS, s.departmentId)) depts.push(byId(DEPARTMENTS, s.departmentId));
  const types = ["Residential", "Commercial", "Industrial", "Infrastructure"];
  if (v.projectType && !types.includes(v.projectType)) types.push(v.projectType);
  const users = USERS.filter((x) => x.active || (s && (x.id === s.pmUserId || x.id === s.peUserId)));
  const fld = (name, label, ctl, cls) => `<div class="field${cls ? " " + cls : ""}" data-field="${name}"><label>${label}</label>${ctl}<div class="field-error" data-err="${name}"></div></div>`;
  const inp = (name, type, val, extra) => `<input name="${name}" type="${type}" value="${esc(val ?? "")}"${extra || ""}${dis}>`;
  const sel = (name, options, cur) => `<select name="${name}"${dis}><option value="">Select...</option>${opts(options, cur)}</select>`;
  return `<form class="ui-form" id="siteForm" novalidate><div class="form-grid">
    ${fld("name", "Site name *", inp("name", "text", v.name, ` placeholder="e.g. Riverside Residency Tower 3"`), "full")}
    ${fld("description", "Description", `<textarea name="description" rows="2"${dis}>${esc(v.description || "")}</textarea>`, "full")}
    ${fld("departmentId", "Department *", sel("departmentId", depts.map((d) => [d.id, d.name]), v.departmentId))}
    ${fld("projectType", "Project type", sel("projectType", types.map((t) => [t, t]), v.projectType))}
    ${fld("areaSqft", "Area (sqft)", inp("areaSqft", "number", v.areaSqft, ` min="1" step="1"`))}
    ${fld("clientId", "Client", sel("clientId", CLIENTS.map((c) => [c.id, c.name]), v.clientId))}
    ${fld("lat", "GPS latitude", inp("lat", "number", v.lat, ` step="0.0001" min="-90" max="90"`))}
    ${fld("lng", "GPS longitude", inp("lng", "number", v.lng, ` step="0.0001" min="-180" max="180"`))}
    ${fld("address", "Address", inp("address", "text", v.address), "full")}
    ${fld("startDate", "Start date", inp("startDate", "date", v.startDate))}
    ${fld("endDate", "End date", inp("endDate", "date", v.endDate))}
    ${fld("status", "Status", sel("status", SITE_STATUSES.map((t) => [t, t]), v.status))}
    ${fld("pmUserId", "Project manager (PM)", sel("pmUserId", users.map((x) => [x.id, x.name]), v.pmUserId))}
    ${fld("peUserId", "Project engineer (PE)", sel("peUserId", users.map((x) => [x.id, x.name]), v.peUserId))}
    ${fld("notes", "Notes", `<textarea name="notes" rows="2"${dis}>${esc(v.notes || "")}</textarea>`, "full")}
  </div>
  <div class="field-error ui-form-error" data-err="_form"></div>
  <div class="form-actions"><button type="button" class="btn secondary" data-cancel>${editable ? "Cancel" : "Close"}</button>${editable ? `<button type="submit" class="btn teal">${s ? "Save changes" : "Create site"}</button>` : ""}</div>
  </form>`;
}

function mpRowHtml(l, checked, disabled, extra) {
  const search = `${l.name} ${l.skill} ${extra}`.toLowerCase();
  return `<label class="mp-row" data-search="${esc(search)}"><input type="checkbox" value="${l.id}" ${checked ? "checked" : ""}${disabled ? " disabled" : ""}>
    <span class="mp-name">${esc(l.name)}</span><span class="mp-sub">${esc(l.skill)} · ${esc(extra)}</span></label>`;
}

function siteManpowerHtml(s, editable) {
  const mappedIds = siteLabourIds(s.id);
  const mapped = LABOUR.filter((l) => mappedIds.includes(l.id));
  const avail = LABOUR.filter((l) => l.active && !mappedIds.includes(l.id));
  const list = (kind, title, rows, emptyMsg) => `<div class="mp-col" data-list="${kind}">
    <div class="mp-col-head"><strong>${title}</strong><span class="dim">(${rows.length})</span>
      <span class="mp-links"><a href="#" data-sel="all">Select all</a> · <a href="#" data-sel="none">none</a></span></div>
    <input type="search" class="mp-search" placeholder="Search…" aria-label="Search ${esc(title)}"${editable ? "" : " disabled"}>
    <div class="mp-list">${rows.length ? rows.join("") : `<div class="ui-empty">${esc(emptyMsg)}</div>`}</div>
  </div>`;
  return `<div class="site-mp" id="siteMp" data-site="${s.id}">
    ${editable ? "" : `<div class="section-note">You can view this site's manpower but cannot change the mapping.</div>`}
    <div class="mp-cols">
      ${list("mapped", "Mapped to this site", mapped.map((l) => mpRowHtml(l, true, !editable, labourSiteNames(l.id))), "No manpower mapped yet")}
      ${list("avail", "Available manpower", avail.map((l) => mpRowHtml(l, false, !editable, labourSiteNames(l.id))), "No available manpower")}
    </div>
    <div class="mp-foot"><span class="mp-counter" id="mpCounter" role="status">0 to add, 0 to remove</span>
      <button type="button" class="btn teal" id="mpSave"${editable ? "" : " disabled"}>Save mapping</button></div>
  </div>`;
}

function bindSiteManpower(s) {
  const root = document.getElementById("siteMp");
  if (!root) return;
  const editable = canEditSite(s);
  const counts = () => {
    const add = root.querySelectorAll('[data-list="avail"] input:checked').length;
    const rem = root.querySelectorAll('[data-list="mapped"] input[type="checkbox"]:not(:checked)').length;
    document.getElementById("mpCounter").textContent = `${add} to add, ${rem} to remove`;
  };
  root.addEventListener("change", (ev) => { if (ev.target.matches('input[type="checkbox"]')) counts(); });
  root.addEventListener("input", (ev) => {
    if (!ev.target.classList.contains("mp-search")) return;
    const q = ev.target.value.trim().toLowerCase();
    ev.target.closest(".mp-col").querySelectorAll(".mp-row").forEach((r) => { r.hidden = !!q && !r.dataset.search.includes(q); });
  });
  root.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-sel]");
    if (!a) return;
    ev.preventDefault();
    if (!editable) return;
    a.closest(".mp-col").querySelectorAll(".mp-row:not([hidden]) input").forEach((c) => { c.checked = a.dataset.sel === "all"; });
    counts();
  });
  document.getElementById("mpSave").addEventListener("click", () => {
    if (!canEditSite(s)) { showToast("You cannot change manpower for this site"); return; }
    const kept = [...root.querySelectorAll('[data-list="mapped"] input:checked')].map((c) => Number(c.value));
    const added = [...root.querySelectorAll('[data-list="avail"] input:checked')].map((c) => Number(c.value));
    const r = setSiteLabour(s.id, [...kept, ...added]);
    if (r.added || r.removed) {
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Site Manpower Mapped", details: `${s.name}: +${r.added} / −${r.removed}` });
    }
    showToast(`Mapped +${r.added} / −${r.removed}`);
    render();
    openSiteModal(s.id, "manpower");
  });
  counts();
}

function readSiteForm(fm) {
  const g = (n) => fm.elements[n];
  const num = (n) => { const raw = g(n).value.trim(); return raw === "" ? "" : Number(raw); };
  return {
    name: g("name").value.trim(), description: g("description").value.trim(), departmentId: g("departmentId").value === "" ? "" : Number(g("departmentId").value),
    projectType: g("projectType").value, areaSqft: num("areaSqft"), clientId: g("clientId").value === "" ? "" : Number(g("clientId").value),
    lat: num("lat"), lng: num("lng"), address: g("address").value.trim(), startDate: g("startDate").value, endDate: g("endDate").value,
    status: g("status").value || "Active", pmUserId: g("pmUserId").value === "" ? "" : Number(g("pmUserId").value),
    peUserId: g("peUserId").value === "" ? "" : Number(g("peUserId").value), notes: g("notes").value.trim(),
  };
}

function bindSiteForm(s) {
  const fm = document.getElementById("siteForm");
  if (!fm) return;
  fm.querySelector("[data-cancel]").addEventListener("click", () => closeModal());
  fm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (s ? !canEditSite(s) : !can("addSite")) return;
    const vals = readSiteForm(fm);
    fm.querySelectorAll("[data-err]").forEach((el) => { el.textContent = ""; });
    const errs = validateSiteForm(vals, s ? s.id : null);
    const keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach((k) => { const el = fm.querySelector(`[data-err="${k}"]`); if (el) el.textContent = errs[k]; });
      const c = fm.elements[keys[0]];
      if (c) c.focus();
      return;
    }
    const nn = (x) => (x === "" ? null : x);
    const rec = {
      name: vals.name, description: vals.description, departmentId: vals.departmentId, projectType: vals.projectType,
      areaSqft: nn(vals.areaSqft), address: vals.address, lat: nn(vals.lat), lng: nn(vals.lng), clientId: nn(vals.clientId),
      startDate: vals.startDate, endDate: vals.endDate, status: vals.status, pmUserId: nn(vals.pmUserId), peUserId: nn(vals.peUserId), notes: vals.notes,
    };
    if (s) {
      Object.assign(s, rec);
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Site Updated", details: `${s.name} updated` });
      closeModal();
      showToast("Site updated");
      render();
    } else {
      const site = { id: Store.nextId(SITES), ...rec };
      SITES.push(site);
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Site Created", details: `${site.name} created` });
      showToast("Site created");
      render();
      openSiteModal(site.id, "overview");
    }
  });
}

/* siteId null = create mode (Details tab only). tab: overview | details | manpower */
function openSiteModal(siteId, tab) {
  const s = siteId == null ? null : byId(SITES, siteId);
  if (siteId != null && !s) return;
  if (!s && !can("addSite")) return;
  const editable = s ? canEditSite(s) : true;
  const items = s
    ? [{ key: "overview", label: "Overview", html: siteOverviewHtml(s) },
       { key: "details", label: editable ? "Details" : "Details (read-only)", html: siteDetailsFormHtml(s, editable) },
       { key: "manpower", label: "Manpower Config", html: siteManpowerHtml(s, editable) }]
    : [{ key: "details", label: "Details", html: siteDetailsFormHtml(null, true) }];
  openModal(esc(s ? s.name : "New Site / Project"), UI.tabs("site-popup", items, s ? tab : "details"), { wide: true });
  bindSiteForm(s);
  if (s) bindSiteManpower(s);
}
