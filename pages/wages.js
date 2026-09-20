/* Wages & Payments: pure helpers (DOM-free, unit-tested) followed by the page and dialogs. */

const WAGE_MODES = ["Cash", "Bank", "UPI"];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Derives payable, paid, balance, status and last payment info from rate, days and the payments ledger. */
function recalcWage(w) {
  if (!Array.isArray(w.payments)) w.payments = [];
  w.totalPayable = Math.round(Number(w.wageRate || 0) * (Number(w.daysPresent || 0) + 0.5 * Number(w.halfDays || 0)));
  w.advancePaid = w.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  w.balancePayable = w.totalPayable - w.advancePaid;
  w.status = w.totalPayable > 0 && w.balancePayable <= 0 ? "Paid" : w.advancePaid > 0 ? "Partially Paid" : "Pending";
  const last = w.payments.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id).pop();
  w.paymentDate = last ? last.date : null;
  w.paidBy = last ? last.by : null;
  return w;
}

function computeDaysFromAttendance(labourId, siteId, month) {
  const rows = ATTENDANCE.filter((a) => a.labourId === Number(labourId) && a.siteId === Number(siteId) && String(a.date || "").startsWith(`${month}-`));
  return { daysPresent: rows.filter((a) => a.status === "Present").length, halfDays: rows.filter((a) => a.status === "Half Day").length };
}

/* f: { siteId, labourId, from, to, month, status }. Date range applies to the latest payment date; month to the wage period. */
function filterWages(rows, f = {}) {
  return rows.filter((w) =>
    (!f.siteId || w.siteId === Number(f.siteId)) &&
    (!f.labourId || w.labourId === Number(f.labourId)) &&
    (!f.month || w.period === f.month) &&
    (!f.status || w.status === f.status) &&
    Filters.inDateRange(w.paymentDate, f.from, f.to));
}

/* Returns { field: message, _form?: message }; empty object when valid. `existing` is the record being edited (or null). */
function validateWageForm(vals, rows, existing) {
  const errors = {};
  const siteId = Number(vals.siteId), labourId = Number(vals.labourId);
  if (!siteId) errors.siteId = "Site is required";
  if (!labourId) errors.labourId = "Labour is required";
  else if (siteId && !siteLabourIds(siteId).includes(labourId)) errors.labourId = "Labour is not mapped to this site";
  if (!MONTH_RE.test(String(vals.period || ""))) errors.period = "Period must be a month (YYYY-MM)";
  if (!(Number(vals.wageRate) > 0)) errors.wageRate = "Rate/Day must be greater than 0";
  const days = Number(vals.daysPresent), half = Number(vals.halfDays || 0);
  if (vals.daysPresent === "" || vals.daysPresent == null || !(days >= 0)) errors.daysPresent = "Days present is required";
  else if (days > 31) errors.daysPresent = "Days present cannot exceed 31";
  if (!(half >= 0)) errors.halfDays = "Half days cannot be negative";
  else if (!errors.daysPresent && days + half > 31) errors.halfDays = "Days plus half days cannot exceed 31";
  if (!Object.keys(errors).length) {
    if (rows.some((w) => (!existing || w.id !== existing.id) && w.labourId === labourId && w.siteId === siteId && w.period === vals.period)) errors._form = "Wage record already exists";
    else if (existing) {
      const payable = Math.round(Number(vals.wageRate) * (days + 0.5 * half));
      const paid = (existing.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      if (payable < paid) errors._form = `Payable (${payable}) cannot be lower than the ${paid} already paid`;
    }
  }
  return errors;
}

/* editing: the payment being edited (its amount is released back to the balance before the limit check). */
function validateWagePayment(wage, vals, editing) {
  const errors = {};
  const amount = Number(vals.amount);
  const limit = wage.balancePayable + (editing ? Number(editing.amount || 0) : 0);
  if (!(amount > 0)) errors.amount = "Amount must be greater than 0";
  else if (amount > limit) errors.amount = `Amount cannot exceed the balance of ${limit}`;
  if (!DATE_RE.test(String(vals.date || ""))) errors.date = "Payment date is required";
  if (!WAGE_MODES.includes(vals.mode)) errors.mode = "Choose a payment mode";
  return errors;
}

function saveWageRecord(vals, existing, userId) {
  const fields = { wageRate: Number(vals.wageRate), daysPresent: Number(vals.daysPresent), halfDays: Number(vals.halfDays || 0), remarks: vals.remarks || "" };
  if (existing) { Object.assign(existing, fields); return recalcWage(existing); }
  const record = { id: Store.nextId(WAGES), labourId: Number(vals.labourId), siteId: Number(vals.siteId), period: vals.period, ...fields,
    totalPayable: 0, advancePaid: 0, balancePayable: 0, status: "Pending", paymentDate: null, paidBy: null, payments: [] };
  WAGES.push(record);
  return recalcWage(record);
}

function saveWagePayment(wage, vals, userId, editing) {
  const fields = { date: vals.date, amount: Number(vals.amount), mode: vals.mode, remarks: vals.remarks || "" };
  if (editing) Object.assign(editing, fields);
  else wage.payments.push({ id: Math.max(0, ...wage.payments.map((p) => p.id)) + 1, by: userId, ...fields });
  return recalcWage(wage);
}

function removeWagePayment(wage, paymentId) {
  wage.payments = wage.payments.filter((p) => p.id !== paymentId);
  return recalcWage(wage);
}

/* ---------- page ---------- */
const wageFilters = { siteId: "", labourId: "", from: "", to: "", month: "", status: "" };

function setWageFilter(key, value) {
  if (key === "_clear") Object.keys(wageFilters).forEach((k) => { wageFilters[k] = ""; });
  else {
    wageFilters[key] = value;
    if (key === "siteId") wageFilters.labourId = "";
  }
  render();
}

function scopedWages() { return WAGES.filter((w) => scopedSiteIds().includes(w.siteId)); }
function wageRows() { return filterWages(scopedWages(), wageFilters); }
function wageStatusKind(status) { return status === "Paid" ? "ok" : status === "Partially Paid" ? "warn" : "danger"; }

function wageFilterSummary() {
  return Filters.summary([
    ["Site", wageFilters.siteId ? siteName(Number(wageFilters.siteId)) : ""],
    ["Labour", wageFilters.labourId ? labourName(Number(wageFilters.labourId)) : ""],
    ["Payment from", wageFilters.from], ["Payment to", wageFilters.to], ["Month", wageFilters.month], ["Status", wageFilters.status],
  ]);
}

function wageFilterBar() {
  const scoped = scopedSiteIds();
  if (wageFilters.siteId && !scoped.includes(Number(wageFilters.siteId))) wageFilters.siteId = "";
  const labour = Filters.labourForSite(wageFilters.siteId, scoped);
  if (wageFilters.labourId && !labour.some((l) => l.id === Number(wageFilters.labourId))) wageFilters.labourId = "";
  return Filters.barHtml("setWageFilter", [
    { key: "siteId", label: "Site", type: "select", value: wageFilters.siteId, allLabel: "All sites", options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
    { key: "labourId", label: "Labour", type: "select", value: wageFilters.labourId, allLabel: "All labour", options: labour.map((l) => ({ value: l.id, label: l.name })) },
    { key: "from", label: "Payment from", type: "date", value: wageFilters.from },
    { key: "to", label: "Payment to", type: "date", value: wageFilters.to },
    { key: "month", label: "Month-Year", type: "month", value: wageFilters.month },
    { key: "status", label: "Status", type: "select", value: wageFilters.status, allLabel: "All statuses", options: ["Pending", "Partially Paid", "Paid"].map((s) => ({ value: s, label: s })) },
  ]);
}

function wageTotals(rows) {
  return { payable: rows.reduce((s, w) => s + w.totalPayable, 0), paid: rows.reduce((s, w) => s + w.advancePaid, 0), balance: rows.reduce((s, w) => s + w.balancePayable, 0) };
}

function pageWages() {
  const canUpdate = can("updateWagePayment");
  const totals = wageTotals(wageRows());
  const actions = [{ key: "history", label: "Payment history", icon: "≡" }];
  if (canUpdate) actions.unshift(
    { key: "edit", label: "Edit record", icon: "✎" },
    { key: "pay", label: "Record payment", icon: "₹", show: (w) => w.balancePayable > 0 },
  );
  if (canUpdate) actions.push({ key: "delete", label: "Delete record", icon: "✕", danger: true });
  return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">Wages &amp; Payments</div><div class="page-sub">Payable is rate × (days present + ½ × half days); paid comes from the payment ledger.</div></div>
    <button class="btn teal" ${canUpdate ? "" : `disabled title="Requires the Update wage payment permission"`} onclick="showWageForm()">+ Add Wage Record</button></div>
    ${wageFilterBar()}
    <div class="attendance-summary"><span class="tag neutral">Total payable ${esc(currency(totals.payable))}</span><span class="tag ok">Paid ${esc(currency(totals.paid))}</span><span class="tag danger">Outstanding ${esc(currency(totals.balance))}</span></div>
    ${UI.tableHost({
      id: "wages",
      rows: wageRows,
      emptyText: "No wage records match the current filters.",
      searchPlaceholder: "Search labour or site...",
      toolbarHtml: () => UI.exportMenu(() => Filters.matrixFor("wages", "Wages & Payments", wageFilterSummary(), currentUser().name), "Wages & Payments"),
      columns: [
        { label: "Labour", text: (w) => labourName(w.labourId), html: (w) => `<strong>${esc(labourName(w.labourId))}</strong>` },
        { label: "Site", text: (w) => siteName(w.siteId) },
        { label: "Period", text: (w) => w.period, html: (w) => `<span class="text-mono">${esc(w.period)}</span>` },
        { label: "Rate/Day", text: (w) => currency(w.wageRate), align: "right" },
        { label: "Days (P + ½)", text: (w) => `${w.daysPresent} + ${w.halfDays}`, align: "right" },
        { label: "Payable", text: (w) => currency(w.totalPayable), align: "right" },
        { label: "Paid", text: (w) => currency(w.advancePaid), align: "right" },
        { label: "Balance", text: (w) => currency(w.balancePayable), align: "right" },
        { label: "Status", text: (w) => w.status, html: (w) => UI.tag(w.status, wageStatusKind(w.status)) },
      ],
      rowActions: actions,
      onAction: (action, w) => ({ edit: showWageForm, pay: showWagePaymentForm, history: showWageHistory, delete: deleteWageRecord })[action](w.id),
      footerHtml: (rows) => { const t = wageTotals(rows); return `<strong>${rows.length} record${rows.length === 1 ? "" : "s"}</strong> · Payable ${esc(currency(t.payable))} · Paid ${esc(currency(t.paid))} · Balance ${esc(currency(t.balance))}`; },
    })}`;
}

function wageDefaultRate(labourId) { const l = LABOUR.find((x) => x.id === Number(labourId)); return l ? l.wageRate : ""; }

function showWageForm(id) {
  if (!can("updateWagePayment")) { showToast("You do not have permission to update wages"); return; }
  const existing = id ? WAGES.find((w) => w.id === id) : null;
  const scoped = scopedSiteIds();
  const siteId = existing ? existing.siteId : (Number(wageFilters.siteId) || "");
  const vals = existing ? { ...existing } : { siteId, labourId: wageFilters.labourId, period: wageFilters.month || Filters.today().slice(0, 7), halfDays: 0 };
  UI.form({
    title: existing ? "Edit Wage Record" : "Add Wage Record",
    values: vals,
    fields: [
      { name: "siteId", label: "Site", type: "select", required: true, disabled: !!existing, options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
      { name: "labourId", label: "Labour", type: "select", required: true, disabled: !!existing, options: (existing || siteId ? Filters.labourForSite(existing ? existing.siteId : siteId, scoped) : []).map((l) => ({ value: l.id, label: l.name })) },
      { name: "period", label: "Period", type: "month", required: true, disabled: !!existing },
      { name: "wageRate", label: "Rate/Day", type: "number", required: true, min: 1, step: "1" },
      { name: "daysPresent", label: "Days present", type: "number", required: true, min: 0, max: 31, step: "0.5" },
      { name: "halfDays", label: "Half days", type: "number", min: 0, max: 31, step: "1" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    submitLabel: existing ? "Save Changes" : "Add Record",
    onSubmit: (v) => {
      const errors = validateWageForm(v, WAGES, existing);
      if (Object.keys(errors).length) return errors;
      const record = saveWageRecord(v, existing, state.currentUserId);
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: existing ? "Wage Record Updated" : "Wage Record Added", details: `${labourName(record.labourId)} · ${record.period} at ${siteName(record.siteId)}` });
      showToast(existing ? "Wage record updated" : "Wage record added");
      render();
      return null;
    },
  });
  const fm = document.querySelector("#modalOverlay .ui-form");
  if (!fm) return;
  const rate = fm.elements.wageRate;
  const syncRate = () => { if (!existing) rate.value = wageDefaultRate(fm.elements.labourId.value); };
  Filters.bindSiteLabour(fm, "siteId", "labourId", syncRate);
  syncRate();
  if (existing) rate.value = existing.wageRate;
  const link = document.createElement("div");
  link.className = "field full";
  link.innerHTML = `<button type="button" class="attendance-action-link" data-compute>Compute days from attendance</button><div class="field-hint">Fills days present and half days from marked attendance for this labour, site and month.</div>`;
  fm.querySelector('[data-field="halfDays"]').after(link);
  link.querySelector("[data-compute]").addEventListener("click", () => {
    const labourId = fm.elements.labourId.value, site = fm.elements.siteId.value, period = fm.elements.period.value;
    if (!labourId || !site || !MONTH_RE.test(period)) { showToast("Choose site, labour and period first"); return; }
    const days = computeDaysFromAttendance(labourId, site, period);
    fm.elements.daysPresent.value = days.daysPresent;
    fm.elements.halfDays.value = days.halfDays;
    showToast(`Attendance: ${days.daysPresent} present, ${days.halfDays} half day${days.halfDays === 1 ? "" : "s"}`);
  });
}

function showWagePaymentForm(wageId, paymentId, fromHistory) {
  if (!can("updateWagePayment")) { showToast("You do not have permission to record payments"); return; }
  const wage = WAGES.find((w) => w.id === wageId);
  if (!wage) return;
  const editing = paymentId ? wage.payments.find((p) => p.id === paymentId) : null;
  UI.form({
    title: `${editing ? "Edit" : "Record"} payment — ${labourName(wage.labourId)} (${wage.period})`,
    values: editing ? { ...editing } : { date: Filters.today(), mode: "Cash", amount: wage.balancePayable },
    fields: [
      { name: "amount", label: "Amount", type: "number", required: true, min: 1, step: "1", hint: `Outstanding balance: ${currency(wage.balancePayable + (editing ? editing.amount : 0))}` },
      { name: "date", label: "Payment date", type: "date", required: true },
      { name: "mode", label: "Mode", type: "select", required: true, options: WAGE_MODES.map((m) => ({ value: m, label: m })) },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    submitLabel: editing ? "Save Payment" : "Record Payment",
    onSubmit: (v) => {
      const errors = validateWagePayment(wage, v, editing);
      if (Object.keys(errors).length) return errors;
      saveWagePayment(wage, v, state.currentUserId, editing);
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Wage Payment Updated", details: `${labourName(wage.labourId)} ${currency(Number(v.amount))} ${v.mode} — now ${wage.status}` });
      showToast(`Payment saved — ${wage.status}`);
      render();
      if (fromHistory) setTimeout(() => showWageHistory(wageId), 0);
      return null;
    },
  });
}

function showWageHistory(wageId) {
  const wage = WAGES.find((w) => w.id === wageId);
  if (!wage) return;
  const canUpdate = can("updateWagePayment");
  const rows = wage.payments.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
  openModal(esc(`Payment history — ${labourName(wage.labourId)} · ${siteName(wage.siteId)} · ${wage.period}`), `
    <div class="attendance-summary"><span class="tag neutral">Payable ${esc(currency(wage.totalPayable))}</span><span class="tag ok">Paid ${esc(currency(wage.advancePaid))}</span><span class="tag danger">Balance ${esc(currency(wage.balancePayable))}</span>${UI.tag(wage.status, wageStatusKind(wage.status))}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th class="num">Amount</th><th>Mode</th><th>Paid by</th><th>Remarks</th>${canUpdate ? `<th></th>` : ""}</tr></thead><tbody>
    ${rows.length ? rows.map((p) => `<tr><td class="text-mono">${esc(p.date)}</td><td class="num">${esc(currency(p.amount))}</td><td>${esc(p.mode)}</td><td>${esc(userName(p.by))}</td><td class="dim">${esc(p.remarks || "—")}</td>${canUpdate ? `<td class="row-actions"><button type="button" class="icon-btn" title="Edit payment" aria-label="Edit payment" onclick="showWagePaymentForm(${wage.id}, ${p.id}, true)">✎</button><button type="button" class="icon-btn danger" title="Delete payment" aria-label="Delete payment" onclick="deleteWagePayment(${wage.id}, ${p.id})">✕</button></td>` : ""}</tr>`).join("") : `<tr><td colspan="${canUpdate ? 6 : 5}" class="ui-empty">No payments recorded yet.</td></tr>`}
    </tbody></table></div>
    <div class="form-actions"><button type="button" class="btn secondary" onclick="closeModal()">Close</button>${canUpdate && wage.balancePayable > 0 ? `<button type="button" class="btn teal" onclick="showWagePaymentForm(${wage.id}, null, true)">+ Record payment</button>` : ""}</div>`, { wide: true });
}

function deleteWagePayment(wageId, paymentId) {
  const wage = WAGES.find((w) => w.id === wageId);
  const payment = wage && wage.payments.find((p) => p.id === paymentId);
  if (!payment) return;
  UI.confirm(`Delete the ${currency(payment.amount)} payment dated ${payment.date}?`, () => {
    removeWagePayment(wage, paymentId);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Wage Payment Updated", details: `${labourName(wage.labourId)} payment of ${currency(payment.amount)} removed — now ${wage.status}` });
    showToast("Payment deleted");
    render();
    showWageHistory(wageId);
  }, { title: "Delete payment", yesLabel: "Delete" });
}

function deleteWageRecord(wageId) {
  if (!can("updateWagePayment")) { showToast("You do not have permission to delete wage records"); return; }
  const wage = WAGES.find((w) => w.id === wageId);
  if (!wage) return;
  const count = wage.payments.length;
  if (count && !Auth.isAllDeptRole(currentUser())) { showToast("Only a Super Admin or Business Owner can delete a record that has payments"); return; }
  UI.confirm(count ? `Delete this record and its ${count} payment${count === 1 ? "" : "s"}?` : `Delete the wage record for ${labourName(wage.labourId)} (${wage.period})?`, () => {
    WAGES.splice(WAGES.indexOf(wage), 1);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Wage Record Deleted", details: `${labourName(wage.labourId)} · ${wage.period} at ${siteName(wage.siteId)}` });
    showToast("Wage record deleted");
    render();
  }, { title: "Delete wage record", yesLabel: "Delete" });
}
