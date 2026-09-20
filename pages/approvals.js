/* Approvals list page: role-scoped requests, filter bar (applies on Search), status chips, kit table, decisions.
   applyApprovalFilters is a pure helper (no DOM). The add/edit page arrives in a later task (openApprovalEdit). */

/* draft = what the inputs show; applied = what the table uses (copied on Search/Enter). */
const approvalsFilters = { draft: { requestedBy: "", siteId: "", status: "", q: "" }, applied: { requestedBy: "", siteId: "", status: "", q: "" } };

/* Visible requests for the user narrowed by the applied filters, newest first. */
function applyApprovalFilters(user, deptId, applied) {
  return Approvals.filter(Approvals.visibleRequests(user, deptId), applied || {}).slice().sort((a, b) => {
    const k = String(b.requestDate || "").localeCompare(String(a.requestDate || ""));
    return k || b.id - a.id;
  });
}

const approvalStatusKind = (s) => (s === "Approved" ? "ok" : s === "Rejected" ? "danger" : s === "Review Requested" ? "neutral" : "warn");

function openApprovalEdit(idOrNew) {
  state.approvalEdit = idOrNew == null || idOrNew === "new" ? "new" : idOrNew;
  render();
}
function closeApprovalEdit() { state.approvalEdit = null; render(); }

function lastApprovalDecision(r) {
  return (r.history || []).filter((h) => h.action !== "Created").slice(-1)[0] || null;
}

function approvalDecisionHtml(r) {
  const last = lastApprovalDecision(r);
  if (!last) return "—";
  const tip = `${last.action} by ${userName(last.by)} on ${last.at}${last.remark ? ": " + last.remark : ""}`;
  return `<div class="dim" title="${esc(tip)}">${esc(last.action)} · ${esc(userName(last.by))} · ${esc(String(last.at).slice(0, 10))}${last.remark ? `<div class="appr-clamp">${esc(last.remark)}</div>` : ""}</div>`;
}

function approvalsTableHtml() {
  const user = currentUser();
  const showAction = Approvals.showActionColumn(user);
  const f = approvalsFilters;
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(label)}</option>`;
  return UI.tableHost({
    id: "approvals",
    emptyText: "No approval requests match your filters",
    rows: () => applyApprovalFilters(currentUser(), state.deptId, approvalsFilters.applied),
    columns: [
      { label: "Request", text: (r) => `${r.title} ${r.type}`, html: (r) => `<strong>${esc(r.title)}</strong><div class="dim" style="font-size:11px">${esc(r.type)}</div>` },
      { label: "Site", text: (r) => (r.siteId == null ? "—" : siteName(r.siteId)) },
      { label: "Requested by", text: (r) => userName(r.requestedBy) },
      { label: "Date", text: (r) => String(r.requestDate || "").slice(0, 10), html: (r) => `<span class="text-mono">${esc(String(r.requestDate || "").slice(0, 10))}</span>` },
      { label: "Priority", text: (r) => r.priority || "Normal", html: (r) => UI.tag(r.priority || "Normal", r.priority === "Urgent" ? "danger" : "neutral") },
      { label: "Status", text: (r) => r.status, html: (r) => UI.tag(r.status, approvalStatusKind(r.status)) },
      { label: "Last decision", text: (r) => { const l = lastApprovalDecision(r); return l ? `${l.action} ${userName(l.by)} ${l.remark || ""}` : ""; }, html: approvalDecisionHtml },
      { label: "Attachments", text: (r) => String((r.attachments || []).length), align: "right" },
    ],
    rowActions: showAction ? [
      { key: "view", label: "View request", icon: "👁" },
      { key: "approve", label: "Approve", icon: "✔", show: (r) => Approvals.canDecide(currentUser(), r) },
      { key: "reject", label: "Reject", icon: "✖", danger: true, show: (r) => Approvals.canDecide(currentUser(), r) },
      { key: "review", label: "Ask for review", icon: "↺", show: (r) => Approvals.canDecide(currentUser(), r) },
    ] : [],
    onAction: (act, r) => { if (act === "view") openApprovalEdit(r.id); else decideApproval(r.id, act); },
    onRowClick: (r) => openApprovalEdit(r.id),
    toolbarHtml: () => `
      <select data-af="requestedBy" aria-label="Requested by">${opt("", "Requested by: All", f.draft.requestedBy)}${USERS.map((u) => opt(u.id, u.name, f.draft.requestedBy)).join("")}</select>
      <select data-af="siteId" aria-label="Site">${opt("", "Site: All", f.draft.siteId)}${SITES.filter((s) => scopedSiteIds().includes(s.id)).map((s) => opt(s.id, s.name, f.draft.siteId)).join("")}</select>
      <select data-af="status" aria-label="Status">${opt("", "Status: All", f.draft.status)}${REQUEST_STATUSES.map((s) => opt(s, s, f.draft.status)).join("")}</select>
      <input type="text" data-af="q" class="appr-q" placeholder="Quick search…" aria-label="Quick search" value="${esc(f.draft.q)}">
      <button type="button" class="btn teal small" data-af-go>Search</button>
      <button type="button" class="btn secondary small" data-af-reset>Reset</button>`,
    toolbarBind: (extra) => {
      const apply = () => { approvalsFilters.applied = { ...approvalsFilters.draft }; render(); };
      const track = (ev) => { const k = ev.target.dataset && ev.target.dataset.af; if (k) approvalsFilters.draft[k] = ev.target.value; };
      extra.addEventListener("input", track);
      extra.addEventListener("change", track);
      extra.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.dataset && ev.target.dataset.af === "q") { ev.preventDefault(); apply(); } });
      extra.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-af-go]")) apply();
        else if (ev.target.closest("[data-af-reset]")) {
          approvalsFilters.draft = { requestedBy: "", siteId: "", status: "", q: "" };
          approvalsFilters.applied = { ...approvalsFilters.draft };
          render();
        }
      });
    },
  });
}

function approvalChipsHtml() {
  const vis = Approvals.visibleRequests(currentUser(), state.deptId);
  const cur = approvalsFilters.applied.status;
  return `<div class="appr-chips">${REQUEST_STATUSES.map((s) => {
    const n = vis.filter((r) => r.status === s).length;
    return `<button type="button" class="appr-chip${cur === s ? " active" : ""}" data-chip="${esc(s)}" onclick="setApprovalStatusChip(this.dataset.chip)">${esc(s)} <b>${n}</b></button>`;
  }).join("")}</div>`;
}

function setApprovalStatusChip(status) {
  approvalsFilters.draft.status = status;
  approvalsFilters.applied = { ...approvalsFilters.draft };
  render();
}

function pageApprovals() {
  if (state.approvalEdit != null) {
    return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">Approvals</div></div>
      <button class="btn secondary" onclick="closeApprovalEdit()">Back</button></div>
      <div class="section-note">Edit page — Task 3 (request ${esc(state.approvalEdit)})</div>`;
  }
  const user = currentUser();
  const level = Auth.roleLevel(user);
  const note = level >= 3 ? "Showing your requests only" : Approvals.showActionColumn(user) ? `Approving as ${currentRole().name}` : "";
  return `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">// OPERATIONS</div>
        <div class="page-heading">Approvals</div>
        <div class="page-sub">Requests in your visibility scope.</div>
      </div>
      <button class="btn teal" ${Approvals.canAdd(user) ? "" : "disabled"} onclick="openApprovalEdit('new')">+ New Request</button>
    </div>
    ${note ? `<div class="section-note">${esc(note)}</div>` : ""}
    ${approvalChipsHtml()}
    <div class="approvals-host">${approvalsTableHtml()}</div>
  `;
}

function decideApproval(reqId, action) {
  const req = byId(APPROVAL_REQUESTS, reqId);
  if (!req) return;
  const verb = { approve: "approved", reject: "rejected", review: "sent back for review" }[action];
  const finish = (remark) => {
    const r = Approvals.decide(req, action, currentUser(), remark, nowStamp());
    if (!r.ok) { showToast(esc(r.error)); return; }
    const labour = req.labourId != null ? byId(LABOUR, req.labourId) : null;
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: `Request ${verb}`, details: `${req.title} ${verb} by ${currentUser().name}${labour ? ` (${labour.name})` : ""}${remark ? ` - ${remark}` : ""}` });
    showToast(`Request ${esc(verb)}`);
    render();
  };
  if (action === "approve") UI.confirm(`Approve "${req.title}"?`, () => finish(""), { title: "Approve request", yesLabel: "Approve" });
  else if (action === "reject") UI.confirm(`Reject "${req.title}"?`, finish, { title: "Reject request", yesLabel: "Reject", reason: { label: "Reason for rejection", required: true } });
  else UI.confirm(`Ask the requester to review "${req.title}"?`, finish, { title: "Ask for review", yesLabel: "Ask for review", reason: { label: "Remark", required: true } });
}
