/* Attendance: pure data helpers plus Daily / Monthly views and bulk marking UI. */

function attendanceMonthMatrix(records, labourIds, month) {
  const prefix = `${month}-`;
  return labourIds.map((labourId) => {
    const days = {};
    const totals = { Present: 0, "Half Day": 0, Absent: 0, Leave: 0 };
    records.filter((row) => Number(row.labourId) === Number(labourId) && String(row.date || "").startsWith(prefix)).forEach((row) => {
      const day = Number(String(row.date).slice(8, 10));
      if (!day) return;
      days[day] = days[day] ? `${days[day]} / ${row.status}` : row.status;
      if (Object.prototype.hasOwnProperty.call(totals, row.status)) totals[row.status] += 1;
    });
    return { labourId, days, totals };
  });
}

function upsertAttendance(entries, markedBy) {
  let added = 0;
  let updated = 0;
  (entries || []).forEach((entry) => {
    const existing = ATTENDANCE.find((row) => row.date === entry.date && Number(row.siteId) === Number(entry.siteId) && Number(row.labourId) === Number(entry.labourId));
    const values = {
      date: entry.date, siteId: Number(entry.siteId), labourId: Number(entry.labourId), status: entry.status,
      checkIn: entry.checkIn || "", checkOut: entry.checkOut || "", remarks: entry.remarks || "", markedBy, gps: entry.gps || null,
    };
    if (existing) { Object.assign(existing, values); updated++; }
    else { ATTENDANCE.push({ id: Store.nextId(ATTENDANCE), ...values }); added++; }
  });
  return { added, updated };
}

function markableLabour(siteId) {
  return LABOUR.filter((labour) => siteLabourIds(Number(siteId)).includes(labour.id) && labour.active && labour.approvalStatus === "Approved");
}

const attendanceViewState = { siteId: "", mode: "daily", date: "", month: "" };
function attendanceToday() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function attendanceLatestDate() { return [...new Set(ATTENDANCE.map((row) => row.date))].sort().pop() || attendanceToday(); }
function attendanceStatusKind(status) { return status === "Present" ? "ok" : status === "Half Day" ? "warn" : status === "Leave" ? "neutral" : "danger"; }
function attendanceGlyph(status) { return ({ Present: "P", Absent: "A", "Half Day": "½", Leave: "L" })[status] || ""; }
function attendanceGlyphs(statuses) { return String(statuses || "").split(" / ").map(attendanceGlyph).filter(Boolean).join("/"); }
function attendanceScopedSites() { return SITES.filter((site) => scopedSiteIds().includes(site.id)); }

function attendanceActiveDate() {
  const date = attendanceViewState.date || state.attendanceDate || attendanceLatestDate();
  attendanceViewState.date = date;
  state.attendanceDate = date;
  attendanceViewState.month = attendanceViewState.month || date.slice(0, 7);
  return date;
}

function attendanceFilterHtml() {
  const date = attendanceActiveDate();
  const siteId = attendanceViewState.siteId;
  return `<div class="attendance-filters panel"><div class="panel-body">
    <div class="field"><label for="attendanceDate">Date</label><input id="attendanceDate" type="date" value="${esc(date)}" onchange="setAttendanceDate(this.value)"></div>
    <div class="field"><label for="attendanceMonth">Month-Year</label><input id="attendanceMonth" type="month" value="${esc(attendanceViewState.month)}" onchange="setAttendanceMonth(this.value)"></div>
    <div class="field"><label for="attendanceSite">Site</label><select id="attendanceSite" onchange="setAttendanceSite(this.value)"><option value="">All sites</option>${attendanceScopedSites().map((site) => `<option value="${site.id}" ${String(site.id) === String(siteId) ? "selected" : ""}>${esc(site.name)}</option>`).join("")}</select></div>
    <div class="attendance-toggle" role="group" aria-label="Attendance view"><button class="btn ${attendanceViewState.mode === "daily" ? "teal" : "secondary"}" onclick="setAttendanceMode('daily')">Daily</button><button class="btn ${attendanceViewState.mode === "monthly" ? "teal" : "secondary"}" onclick="setAttendanceMode('monthly')">Monthly</button></div>
  </div></div>`;
}

function attendanceDailyHtml() {
  const date = attendanceActiveDate();
  const selectedSite = Number(attendanceViewState.siteId) || null;
  const scoped = scopedSiteIds();
  const rows = ATTENDANCE.filter((row) => row.date === date && scoped.includes(row.siteId) && (!selectedSite || row.siteId === selectedSite));
  const totals = { Present: 0, Absent: 0, "Half Day": 0, Leave: 0 };
  rows.forEach((row) => { if (Object.prototype.hasOwnProperty.call(totals, row.status)) totals[row.status]++; });
  return `<div class="attendance-summary">${Object.entries(totals).map(([status, count]) => `<span class="tag ${attendanceStatusKind(status)}">${esc(status)} ${count}</span>`).join("")}</div>
  ${UI.tableHost({
    id: "attendance-daily",
    emptyText: "No attendance marked for this date within your visibility scope.",
    searchPlaceholder: "Search labour, site, or remarks...",
    rows: () => ATTENDANCE.filter((row) => row.date === attendanceActiveDate() && scopedSiteIds().includes(row.siteId) && (!Number(attendanceViewState.siteId) || row.siteId === Number(attendanceViewState.siteId))),
    columns: [
      { label: "Labour", text: (row) => labourName(row.labourId), html: (row) => `<strong>${esc(labourName(row.labourId))}</strong>` },
      { label: "Site", text: (row) => siteName(row.siteId) },
      { label: "Status", text: (row) => row.status, html: (row) => UI.tag(row.status, attendanceStatusKind(row.status)) },
      { label: "Check-in", text: (row) => row.checkIn || "", html: (row) => `<span class="text-mono">${esc(row.checkIn || "—")}</span>` },
      { label: "Check-out", text: (row) => row.checkOut || "", html: (row) => `<span class="text-mono">${esc(row.checkOut || "—")}</span>` },
      { label: "Marked by", text: (row) => userName(row.markedBy) },
      { label: "Remarks", text: (row) => row.remarks || "", html: (row) => `<span class="dim">${esc(row.remarks || "—")}</span>` },
    ],
    rowActions: can("markAttendance") ? [{ key: "edit", label: "Edit attendance", icon: "✎" }] : [],
    onAction: (_action, row) => showMarkAttendanceModal({ date: row.date, siteId: row.siteId }),
    onRowClick: (row) => { if (can("markAttendance")) showMarkAttendanceModal({ date: row.date, siteId: row.siteId }); },
  })}`;
}

function attendanceMonthlyHtml() {
  const month = attendanceViewState.month || attendanceActiveDate().slice(0, 7);
  const selectedSite = Number(attendanceViewState.siteId) || null;
  const siteIds = selectedSite ? [selectedSite] : scopedSiteIds();
  const labourIds = [...new Set(siteIds.flatMap((siteId) => markableLabour(siteId).map((labour) => labour.id)))];
  const records = ATTENDANCE.filter((row) => siteIds.includes(row.siteId));
  const matrix = attendanceMonthMatrix(records, labourIds, month);
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `<div class="attendance-legend"><span><b class="attendance-glyph present">P</b> Present</span><span><b class="attendance-glyph absent">A</b> Absent</span><span><b class="attendance-glyph half">½</b> Half Day</span><span><b class="attendance-glyph leave">L</b> Leave</span></div>
  <div class="panel"><div class="panel-body flush table-wrap attendance-matrix-wrap"><table class="attendance-matrix"><thead><tr><th class="attendance-sticky">Labour</th>${Array.from({ length: days }, (_, i) => `<th>${i + 1}</th>`).join("")}<th>Present</th><th>Half</th><th>Absent</th><th>Leave</th><th>Days worked</th></tr></thead><tbody>
  ${matrix.length ? matrix.map((row) => `<tr><td class="attendance-sticky"><strong>${esc(labourName(row.labourId))}</strong></td>${Array.from({ length: days }, (_, i) => { const status = row.days[i + 1]; return `<td class="attendance-cell ${status && !status.includes(" / ") ? attendanceStatusKind(status) : ""}" title="${esc(status || "No attendance")}">${esc(attendanceGlyphs(status))}</td>`; }).join("")}<td>${row.totals.Present}</td><td>${row.totals["Half Day"]}</td><td>${row.totals.Absent}</td><td>${row.totals.Leave}</td><td>${row.totals.Present + (row.totals["Half Day"] * 0.5)}</td></tr>`).join("") : `<tr><td colspan="${days + 6}" class="empty-note">No approved active labour is mapped to the selected site scope.</td></tr>`}
  </tbody></table></div></div>`;
}

function pageAttendance() {
  const marking = can("markAttendance");
  return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">Attendance</div><div class="page-sub">Daily attendance and monthly work-day matrix, tracked by mapped site labour.</div></div><button class="btn teal" ${marking ? "" : "disabled"} onclick="showMarkAttendanceModal()">+ Mark Attendance</button></div>${attendanceFilterHtml()}${attendanceViewState.mode === "monthly" ? attendanceMonthlyHtml() : attendanceDailyHtml()}`;
}

function setAttendanceDate(value) { if (!value) return; attendanceViewState.date = value; attendanceViewState.month = value.slice(0, 7); attendanceViewState.mode = "daily"; state.attendanceDate = value; render(); }
function setAttendanceMonth(value) { if (!value) return; attendanceViewState.month = value; attendanceViewState.date = `${value}-01`; attendanceViewState.mode = "monthly"; render(); }
function setAttendanceSite(value) { attendanceViewState.siteId = value; render(); }
function setAttendanceMode(mode) { attendanceViewState.mode = mode === "monthly" ? "monthly" : "daily"; render(); }

function attendanceMarkRows(siteId, date) {
  const existing = new Map(ATTENDANCE.filter((row) => row.siteId === Number(siteId) && row.date === date).map((row) => [row.labourId, row]));
  return markableLabour(siteId).map((labour) => ({ labour, record: existing.get(labour.id) || null }));
}

function attendanceMarkRowsHtml(siteId, date) {
  if (!siteId) return `<div class="section-note">Choose a site first to load its mapped, active, approved labour.</div>`;
  const rows = attendanceMarkRows(siteId, date);
  if (!rows.length) return `<div class="ui-empty">No mapped, active, approved labour is available at this site.</div>`;
  return `<div class="attendance-mark-list">${rows.map(({ labour, record }) => `<div class="attendance-mark-row" data-labour-id="${labour.id}"><label class="attendance-include"><input type="checkbox" name="include" value="${labour.id}" checked> Include</label><div><strong>${esc(labour.name)}</strong>${record ? `<div class="dim">Already marked — will update</div>` : ""}</div><select name="status"><option ${(!record || record.status === "Present") ? "selected" : ""}>Present</option><option ${record && record.status === "Absent" ? "selected" : ""}>Absent</option><option ${record && record.status === "Half Day" ? "selected" : ""}>Half Day</option><option ${record && record.status === "Leave" ? "selected" : ""}>Leave</option></select><input name="checkIn" type="time" value="${esc(record ? record.checkIn || "" : "")}" aria-label="${esc(labour.name)} check-in"><input name="checkOut" type="time" value="${esc(record ? record.checkOut || "" : "")}" aria-label="${esc(labour.name)} check-out"><input name="remarks" value="${esc(record ? record.remarks || "" : "")}" placeholder="Remarks" aria-label="${esc(labour.name)} remarks"></div>`).join("")}</div>`;
}

function showMarkAttendanceModal(initial = {}) {
  if (!can("markAttendance")) { showToast("You do not have permission to mark attendance"); return; }
  const date = initial.date || attendanceToday();
  const siteId = initial.siteId || Number(attendanceViewState.siteId) || "";
  openModal("Mark Attendance", `<form id="attendanceMarkForm"><div class="form-grid"><div class="field"><label>Date *</label><input id="attendanceMarkDate" name="date" type="date" required value="${esc(date)}"></div><div class="field"><label>Site *</label><select id="attendanceMarkSite" name="site" required><option value="">Select site...</option>${attendanceScopedSites().map((site) => `<option value="${site.id}" ${Number(siteId) === site.id ? "selected" : ""}>${esc(site.name)}</option>`).join("")}</select></div><div class="field full attendance-mark-tools"><button class="attendance-action-link" type="button" data-att-all>Mark all Present</button><button class="attendance-action-link" type="button" data-att-clear>Clear</button><button class="btn secondary small" type="button" disabled>Verify with thumb impression (coming soon)</button></div><div id="attendanceMarkRows" class="field full">${attendanceMarkRowsHtml(siteId, date)}</div><div id="attendanceMarkError" class="field-error full"></div></div><div class="form-actions"><button class="btn secondary" type="button" onclick="closeModal()">Cancel</button><button class="btn teal" type="submit">Save Attendance</button></div></form>`, { wide: true });
  const form = document.getElementById("attendanceMarkForm");
  const dateInput = document.getElementById("attendanceMarkDate");
  const siteInput = document.getElementById("attendanceMarkSite");
  const refreshRows = () => { document.getElementById("attendanceMarkRows").innerHTML = attendanceMarkRowsHtml(Number(siteInput.value), dateInput.value); };
  siteInput.addEventListener("change", refreshRows);
  dateInput.addEventListener("change", refreshRows);
  form.addEventListener("click", (event) => {
    if (event.target.closest("[data-att-all]")) form.querySelectorAll(".attendance-mark-row").forEach((row) => { row.querySelector('input[name="include"]').checked = true; row.querySelector('select[name="status"]').value = "Present"; });
    if (event.target.closest("[data-att-clear]")) form.querySelectorAll('input[name="include"]').forEach((box) => { box.checked = false; });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const error = document.getElementById("attendanceMarkError");
    const site = Number(siteInput.value);
    if (!site) { error.textContent = "Select a site before saving attendance."; return; }
    const entries = [...form.querySelectorAll(".attendance-mark-row")].filter((row) => row.querySelector('input[name="include"]').checked).map((row) => ({ date: dateInput.value, siteId: site, labourId: Number(row.dataset.labourId), status: row.querySelector('select[name="status"]').value, checkIn: row.querySelector('input[name="checkIn"]').value, checkOut: row.querySelector('input[name="checkOut"]').value, remarks: row.querySelector('input[name="remarks"]').value }));
    if (!entries.length) { error.textContent = "Include at least one labour row."; return; }
    const saved = upsertAttendance(entries, currentUser().id);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: currentUser().id, action: "Attendance Marked", details: `${entries.length} attendance record${entries.length === 1 ? "" : "s"} saved at ${siteName(site)} on ${dateInput.value}` });
    attendanceViewState.date = dateInput.value; attendanceViewState.month = dateInput.value.slice(0, 7); attendanceViewState.siteId = String(site); attendanceViewState.mode = "daily"; state.attendanceDate = dateInput.value;
    closeModal(); showToast(`Saved: ${saved.added} added, ${saved.updated} updated`); render();
  });
}
