/* Petty Cash: pure helpers (DOM-free, unit-tested) followed by the page and dialogs. */

const EXPENSE_CATEGORIES = ["Transport", "Food", "Tools Purchase", "Miscellaneous", "Fuel", "Labour Welfare"];
const EXPENSE_STATUSES = ["Approved", "Pending", "Rejected"];

/* f: { siteId, labourId, from, to, month, status, category }; from/to and month apply to the expense date. */
function filterExpenses(rows, f = {}) {
  return rows.filter((e) =>
    (!f.siteId || e.siteId === Number(f.siteId)) &&
    (!f.labourId || e.labourId === Number(f.labourId)) &&
    (!f.month || String(e.date || "").startsWith(`${f.month}-`)) &&
    (!f.status || e.status === f.status) &&
    (!f.category || e.category === f.category) &&
    Filters.inDateRange(e.date, f.from, f.to));
}

function expenseTotalsByStatus(rows) {
  const totals = { Approved: 0, Pending: 0, Rejected: 0, Total: 0 };
  rows.forEach((e) => { if (e.status in totals) totals[e.status] += e.amount; totals.Total += e.amount; });
  return totals;
}

/* Own expenses (or any for Super Admin / Business Owner) may be edited or deleted until they are Approved. */
function canEditExpense(user, e) {
  return !!user && e.status !== "Approved" && (e.paidBy === user.id || Auth.roleLevel(user) <= 1);
}

/* Approve / reject: only Pending, never on your own expense. hasApprovePerm is can("approveLabour"). */
function canDecideExpense(user, e, hasApprovePerm) {
  return !!user && hasApprovePerm && e.status === "Pending" && e.paidBy !== user.id;
}

function validateExpenseForm(vals) {
  const errors = {};
  const siteId = Number(vals.siteId), labourId = Number(vals.labourId) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vals.date || ""))) errors.date = "Date is required";
  if (!siteId) errors.siteId = "Site is required";
  if (!EXPENSE_CATEGORIES.includes(vals.category)) errors.category = "Category is required";
  if (!(Number(vals.amount) > 0)) errors.amount = "Amount must be greater than 0";
  if (!String(vals.description || "").trim()) errors.description = "Description is required";
  if (labourId && siteId && !siteLabourIds(siteId).includes(labourId)) errors.labourId = "Labour is not mapped to this site";
  return errors;
}

/* Editing a Rejected expense resubmits it as Pending. */
function saveExpense(vals, existing, userId) {
  const fields = { date: vals.date, siteId: Number(vals.siteId), labourId: Number(vals.labourId) || null, category: vals.category,
    amount: Number(vals.amount), description: String(vals.description).trim(), remarks: vals.remarks || "" };
  if (existing) {
    Object.assign(existing, fields, { status: "Pending", approvedBy: null });
    delete existing.rejectionReason; delete existing.rejectedBy;
    return existing;
  }
  const row = { id: Store.nextId(EXPENSES), ...fields, paidBy: userId, approvedBy: null, status: "Pending" };
  EXPENSES.push(row);
  return row;
}

function decideExpense(e, approve, userId, reason) {
  if (approve) { e.status = "Approved"; e.approvedBy = userId; delete e.rejectionReason; delete e.rejectedBy; }
  else { e.status = "Rejected"; e.approvedBy = null; e.rejectedBy = userId; e.rejectionReason = reason; }
  return e;
}

/* ---------- page ---------- */
const expenseFilters = { siteId: "", labourId: "", from: "", to: "", month: "", status: "", category: "" };

function setExpenseFilter(key, value) {
  if (key === "_clear") Object.keys(expenseFilters).forEach((k) => { expenseFilters[k] = ""; });
  else {
    expenseFilters[key] = value;
    if (key === "siteId") expenseFilters.labourId = "";
  }
  render();
}

function scopedExpenses() { return EXPENSES.filter((e) => scopedSiteIds().includes(e.siteId)); }
function expenseRows() { return filterExpenses(scopedExpenses(), expenseFilters); }
function expenseStatusKind(status) { return status === "Approved" ? "ok" : status === "Pending" ? "warn" : "danger"; }

function expenseFilterSummary() {
  return Filters.summary([
    ["Site", expenseFilters.siteId ? siteName(Number(expenseFilters.siteId)) : ""],
    ["Labour", expenseFilters.labourId ? labourName(Number(expenseFilters.labourId)) : ""],
    ["From", expenseFilters.from], ["To", expenseFilters.to], ["Month", expenseFilters.month],
    ["Approval", expenseFilters.status], ["Category", expenseFilters.category],
  ]);
}

function expenseFilterBar() {
  const scoped = scopedSiteIds();
  if (expenseFilters.siteId && !scoped.includes(Number(expenseFilters.siteId))) expenseFilters.siteId = "";
  const labour = Filters.labourForSite(expenseFilters.siteId, scoped);
  if (expenseFilters.labourId && !labour.some((l) => l.id === Number(expenseFilters.labourId))) expenseFilters.labourId = "";
  return Filters.barHtml("setExpenseFilter", [
    { key: "siteId", label: "Site", type: "select", value: expenseFilters.siteId, allLabel: "All sites", options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
    { key: "labourId", label: "Labour", type: "select", value: expenseFilters.labourId, allLabel: "All labour", options: labour.map((l) => ({ value: l.id, label: l.name })) },
    { key: "from", label: "Date from", type: "date", value: expenseFilters.from },
    { key: "to", label: "Date to", type: "date", value: expenseFilters.to },
    { key: "month", label: "Month-Year", type: "month", value: expenseFilters.month },
    { key: "status", label: "Approval status", type: "select", value: expenseFilters.status, allLabel: "All", options: EXPENSE_STATUSES.map((s) => ({ value: s, label: s })) },
    { key: "category", label: "Category", type: "select", value: expenseFilters.category, allLabel: "All categories", options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
  ]);
}

function pageExpenses() {
  const canAdd = can("addExpense");
  const canApprove = can("approveLabour");
  const user = currentUser();
  const totals = expenseTotalsByStatus(expenseRows());
  return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">Petty Cash</div><div class="page-sub">Site expenses with approval status; rejected items can be edited and resubmitted.</div></div>
    <button class="btn teal" ${canAdd ? "" : `disabled title="Requires the Add expenses permission"`} onclick="showExpenseForm()">+ Add Expense</button></div>
    ${expenseFilterBar()}
    <div class="attendance-summary"><span class="tag ok">Approved ${esc(currency(totals.Approved))}</span><span class="tag warn">Pending ${esc(currency(totals.Pending))}</span><span class="tag danger">Rejected ${esc(currency(totals.Rejected))}</span><span class="tag neutral">Total ${esc(currency(totals.Total))}</span></div>
    ${UI.tableHost({
      id: "expenses",
      rows: expenseRows,
      emptyText: "No expenses match the current filters.",
      searchPlaceholder: "Search site, description, paid by, category...",
      toolbarHtml: () => UI.exportMenu(() => Filters.matrixFor("expenses", "Petty Cash", expenseFilterSummary(), currentUser().name), "Petty Cash"),
      columns: [
        { label: "Date", text: (e) => e.date, html: (e) => `<span class="text-mono">${esc(e.date)}</span>` },
        { label: "Site", text: (e) => siteName(e.siteId) },
        { label: "Labour", text: (e) => (e.labourId ? labourName(e.labourId) : "—") },
        { label: "Category", text: (e) => e.category, html: (e) => UI.tag(e.category, "neutral") },
        { label: "Amount", text: (e) => currency(e.amount), align: "right" },
        { label: "Paid by", text: (e) => userName(e.paidBy) },
        { label: "Description", text: (e) => e.description, html: (e) => `<span class="dim">${esc(e.description)}</span>` },
        { label: "Approval", text: (e) => (e.status === "Approved" ? `Approved · ${userName(e.approvedBy)}` : e.status === "Rejected" ? `Rejected · ${userName(e.rejectedBy)}` : "Pending"),
          html: (e) => `${UI.tag(e.status, expenseStatusKind(e.status))}${e.status === "Approved" ? ` <span class="dim">${esc(userName(e.approvedBy))}</span>` : e.status === "Rejected" ? ` <span class="dim" title="${esc(e.rejectionReason || "")}">${esc(userName(e.rejectedBy))}</span>` : ""}` },
      ],
      rowActions: [
        { key: "edit", label: "Edit expense", icon: "✎", show: (e) => canEditExpense(user, e) },
        { key: "approve", label: "Approve", icon: "✔", show: (e) => canDecideExpense(user, e, canApprove) },
        { key: "reject", label: "Reject", icon: "✖", danger: true, show: (e) => canDecideExpense(user, e, canApprove) },
        { key: "delete", label: "Delete expense", icon: "✕", danger: true, show: (e) => canEditExpense(user, e) },
      ],
      onAction: (action, e) => ({ edit: showExpenseForm, approve: approveExpense, reject: rejectExpense, delete: deleteExpense })[action](e.id),
      footerHtml: (rows) => { const t = expenseTotalsByStatus(rows); return `<strong>${rows.length} expense${rows.length === 1 ? "" : "s"}</strong> · Approved ${esc(currency(t.Approved))} · Pending ${esc(currency(t.Pending))} · Rejected ${esc(currency(t.Rejected))} · Total ${esc(currency(t.Total))}`; },
    })}`;
}

function showExpenseForm(id) {
  const existing = id ? EXPENSES.find((e) => e.id === id) : null;
  if (existing ? !canEditExpense(currentUser(), existing) : !can("addExpense")) { showToast("You do not have permission for this action"); return; }
  const scoped = scopedSiteIds();
  const siteId = existing ? existing.siteId : (Number(expenseFilters.siteId) || "");
  UI.form({
    title: existing ? "Edit Expense" : "Add Expense",
    values: existing ? { ...existing } : { date: Filters.today(), siteId, labourId: "" },
    fields: [
      { name: "date", label: "Date", type: "date", required: true },
      { name: "siteId", label: "Site", type: "select", required: true, options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
      { name: "labourId", label: "Labour (optional)", type: "select", options: (siteId ? Filters.labourForSite(siteId, scoped) : []).map((l) => ({ value: l.id, label: l.name })) },
      { name: "category", label: "Category", type: "select", required: true, options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
      { name: "amount", label: "Amount", type: "number", required: true, min: 1, step: "1" },
      { name: "description", label: "Description", type: "text", required: true, full: true },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    submitLabel: existing ? "Save Changes" : "Add Expense",
    onSubmit: (v) => {
      const errors = validateExpenseForm(v);
      if (Object.keys(errors).length) return errors;
      const row = saveExpense(v, existing, state.currentUserId);
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: existing ? "Expense Updated" : "Expense Added", details: `${row.category} expense of ${currency(row.amount)} at ${siteName(row.siteId)}` });
      showToast(existing ? "Expense updated, pending review" : "Expense recorded, pending review");
      render();
      return null;
    },
  });
  const fm = document.querySelector("#modalOverlay .ui-form");
  if (fm) Filters.bindSiteLabour(fm, "siteId", "labourId");
}

function approveExpense(id) {
  const e = EXPENSES.find((x) => x.id === id);
  if (!e || !scopedSiteIds().includes(e.siteId) || !canDecideExpense(currentUser(), e, can("approveLabour"))) { showToast("You cannot approve this expense"); return; }
  decideExpense(e, true, state.currentUserId);
  AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Expense Approved", details: `${e.category} expense approved for ${siteName(e.siteId)}` });
  showToast("Expense approved");
  render();
}

function rejectExpense(id) {
  const e = EXPENSES.find((x) => x.id === id);
  if (!e || !scopedSiteIds().includes(e.siteId) || !canDecideExpense(currentUser(), e, can("approveLabour"))) { showToast("You cannot reject this expense"); return; }
  UI.confirm(`Reject the ${currency(e.amount)} ${e.category} expense at ${siteName(e.siteId)}?`, (reason) => {
    decideExpense(e, false, state.currentUserId, reason);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Expense Rejected", details: `${e.category} expense rejected for ${siteName(e.siteId)}: ${reason}` });
    showToast("Expense rejected");
    render();
  }, { title: "Reject expense", yesLabel: "Reject", reason: { label: "Rejection reason", required: true } });
}

function deleteExpense(id) {
  const e = EXPENSES.find((x) => x.id === id);
  if (!e || !scopedSiteIds().includes(e.siteId) || !canEditExpense(currentUser(), e)) { showToast("You cannot delete this expense"); return; }
  UI.confirm(`Delete the ${currency(e.amount)} ${e.category} expense dated ${e.date}?`, () => {
    EXPENSES.splice(EXPENSES.indexOf(e), 1);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Expense Deleted", details: `${e.category} expense of ${currency(e.amount)} at ${siteName(e.siteId)}` });
    showToast("Expense deleted");
    render();
  }, { title: "Delete expense", yesLabel: "Delete" });
}
