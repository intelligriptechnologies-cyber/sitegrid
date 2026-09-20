/* Approvals list and in-page editor: role-scoped filters, decisions, attachments, and history.
   applyApprovalFilters is a pure helper (no DOM). */

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
  approvalEditState.attachmentError = "";
  state.approvalEdit = idOrNew == null || idOrNew === "new" ? "new" : idOrNew;
  render();
}
function closeApprovalEdit() { approvalEditState.attachmentError = ""; state.approvalEdit = null; render(); }

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

const approvalEditState = { attachmentError: "" };

function currentApprovalRequest() {
  return state.approvalEdit === "new" || state.approvalEdit == null ? null : byId(APPROVAL_REQUESTS, Number(state.approvalEdit));
}

function approvalField(name, label, control, full) {
  return `<div class="field${full ? " full" : ""}" data-field="${esc(name)}"><label>${esc(label)}</label>${control}<div class="field-error" data-err="${esc(name)}"></div></div>`;
}

function approvalEditDetailsHtml(req, editable) {
  const v = req || { type: REQUEST_TYPES[0], priority: "Normal", requestDate: nowStamp().slice(0, 10) };
  const dis = editable ? "" : " disabled";
  const opt = (value, label, selected) => `<option value="${esc(value)}" ${String(value) === String(selected ?? "") ? "selected" : ""}>${esc(label)}</option>`;
  const type = `<select name="type" onchange="updateApprovalTypeFields()"${dis}>${REQUEST_TYPES.map((x) => opt(x, x, v.type)).join("")}</select>`;
  const sites = SITES.filter((s) => scopedSiteIds().includes(s.id));
  const site = `<select name="siteId"${dis}><option value="">Select site...</option>${sites.map((s) => opt(s.id, s.name, v.siteId)).join("")}</select>`;
  const priority = `<select name="priority"${dis}>${["Normal", "Urgent"].map((x) => opt(x, x, v.priority || "Normal")).join("")}</select>`;
  const labour = `<select name="labourId"${dis}><option value="">No linked labour</option>${LABOUR.map((l) => opt(l.id, l.name, v.labourId)).join("")}</select>`;
  const input = (name, kind, value, extra) => `<input name="${name}" type="${kind}" value="${esc(value ?? "")}"${extra || ""}${dis}>`;
  const note = !editable ? `<div class="section-note approval-decision-note">This request is read-only. ${Approvals.canDecide(currentUser(), req) ? "You can decide it below." : "Only its requester can make changes."}</div>` : "";
  const actions = editable ? `<div class="approval-form-actions"><button type="submit" class="btn secondary">Save</button><button type="button" class="btn teal" onclick="saveApprovalRequest(true)">Save &amp; Back</button></div>` : "";
  return `${note}<form class="ui-form approval-edit-form" data-approval-form onsubmit="event.preventDefault(); saveApprovalRequest(false)" novalidate><div class="form-grid">
    ${approvalField("type", "Type *", type)}
    ${approvalField("title", "Title *", input("title", "text", v.title, " maxlength=\"120\""))}
    ${approvalField("siteId", "Site *", site)}
    ${approvalField("priority", "Priority", priority)}
    <div data-approval-conditional="amount"${["Petty Cash", "Material"].includes(v.type) ? "" : " hidden"}>${approvalField("amount", "Amount", input("amount", "number", v.amount, " min=\"0\" step=\"0.01\""))}</div>
    <div data-approval-conditional="labour"${v.type === "Manpower Onboarding" ? "" : " hidden"}>${approvalField("labourId", "Linked labour", labour)}</div>
    ${approvalField("description", "Description *", `<textarea name="description" rows="5"${dis}>${esc(v.description || "")}</textarea>`, true)}
  </div><div class="field-error ui-form-error" data-approval-form-error></div>${actions}</form>`;
}

function approvalFileSize(bytes) {
  const n = Number(bytes) || 0;
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

function approvalAttachmentsHtml(req, editable) {
  if (!req) return `<div class="approval-empty-tab"><strong>Save the request first</strong><div class="dim">Attachments become available after the request has been created.</div></div>`;
  const files = req.attachments || [];
  const list = files.length ? `<div class="approval-attachments">${files.map((a) => {
    const image = /^image\//.test(a.type || "");
    const canDelete = editable && req.requestedBy === currentUser().id;
    return `<div class="approval-attachment">${image ? `<img class="approval-attachment-thumb" src="${esc(a.dataUrl || "")}" alt="${esc(a.name)} thumbnail">` : `<div class="approval-file-icon">FILE</div>`}<div class="approval-attachment-info"><strong>${esc(a.name)}</strong><div class="dim">${esc(approvalFileSize(a.size))} · ${esc(userName(a.by))} · ${esc(String(a.at || "").slice(0, 16))}</div></div><a class="btn secondary small" href="${esc(a.dataUrl || "")}" download="${esc(a.name)}">Download</a>${canDelete ? `<button type="button" class="icon-btn danger" title="Delete attachment" onclick="removeApprovalAttachment(${Number(a.id)})">✕</button>` : ""}</div>`;
  }).join("")}</div>` : `<div class="ui-empty">No attachments yet</div>`;
  return `<div class="approval-upload${editable ? "" : " disabled"}" ondragover="event.preventDefault()" ondrop="addApprovalDroppedFiles(event)"><input id="approvalAttachmentInput" type="file" multiple${editable ? "" : " disabled"} onchange="addApprovalFiles(this.files)"><label for="approvalAttachmentInput">Drop files here or choose files</label><div class="dim">Images, PDF and Office documents · up to 1 MB each · maximum 5 files</div></div><div class="field-error approval-attachment-error">${esc(approvalEditState.attachmentError)}</div>${list}`;
}

function approvalHistoryHtml(req) {
  if (!req || !(req.history || []).length) return `<div class="ui-empty">History starts after this request is saved</div>`;
  const icon = { Created: "+", Edited: "✎", Approved: "✓", Rejected: "✕", "Review Requested": "↩", Resubmitted: "↻" };
  return `<div class="approval-history">${req.history.slice().reverse().map((h) => `<div class="approval-history-item"><div class="approval-history-icon">${esc(icon[h.action] || "•")}</div><div><strong>${esc(h.action)}</strong><div class="dim">${esc(userName(h.by))} · ${esc(h.at)}</div>${h.remark ? `<div class="approval-history-remark">${esc(h.remark)}</div>` : ""}</div></div>`).join("")}</div>`;
}

function approvalEditHtml() {
  const req = currentApprovalRequest();
  if (state.approvalEdit !== "new" && !req) return `<div class="ui-empty">That approval request no longer exists.</div>`;
  const editable = state.approvalEdit === "new" ? Approvals.canAdd(currentUser()) : Approvals.canEdit(currentUser(), req);
  const title = req ? req.title : "New approval request";
  const panel = req && Approvals.canDecide(currentUser(), req) ? `<div class="approval-decision-panel"><div><strong>Decision required</strong><div class="dim">You are authorized to decide this request.</div></div><div class="approval-panel-actions"><button class="btn teal small" onclick="decideApproval(${req.id}, 'approve')">Approve</button><button class="btn danger small" onclick="decideApproval(${req.id}, 'reject')">Reject</button><button class="btn secondary small" onclick="decideApproval(${req.id}, 'review')">Ask review</button></div></div>` : req && req.requestedBy === currentUser().id && ["Review Requested", "Rejected"].includes(req.status) ? `<div class="approval-decision-panel"><div><strong>${esc(req.status)}</strong><div class="dim">Update the request, then resubmit it for approval.</div></div><button class="btn teal small" onclick="resubmitApproval(${req.id})">Resubmit</button></div>` : "";
  return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">${esc(title)}</div><div class="page-sub">${req ? `${esc(req.type)} · ${esc(req.status)}` : "Complete the details, then save your request."}</div></div><button class="btn secondary" onclick="closeApprovalEdit()">← Back to list</button></div>${panel}${UI.tabs("approval-edit", [{ key: "details", label: "Details", html: approvalEditDetailsHtml(req, editable) }, { key: "attachments", label: "Attachments", html: approvalAttachmentsHtml(req, editable) }, { key: "history", label: "History", html: approvalHistoryHtml(req) }], "details")}`;
}

function approvalAudit(action, details) {
  AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action, details });
}

function approvalFormError(form, name, message) {
  const el = form.querySelector(`[data-err="${name}"]`);
  if (el) el.textContent = message || "";
}

function approvalReadForm(form) {
  const value = (name) => (form.elements[name] ? form.elements[name].value.trim() : "");
  const type = value("type");
  const amount = value("amount");
  const labourId = value("labourId");
  return {
    type,
    title: value("title"),
    description: value("description"),
    siteId: Number(value("siteId")) || null,
    priority: value("priority") === "Urgent" ? "Urgent" : "Normal",
    amount: ["Petty Cash", "Material"].includes(type) && amount !== "" ? Number(amount) : null,
    labourId: type === "Manpower Onboarding" && labourId !== "" ? Number(labourId) : null,
  };
}

function saveApprovalRequest(returnToList) {
  const form = document.querySelector("[data-approval-form]");
  if (!form) return;
  const current = currentApprovalRequest();
  const allowed = current ? Approvals.canEdit(currentUser(), current) : Approvals.canAdd(currentUser());
  if (!allowed) { showToast("You cannot edit this request"); return; }
  const values = approvalReadForm(form);
  const errors = {
    type: REQUEST_TYPES.includes(values.type) ? "" : "Select a request type",
    title: values.title ? "" : "Title is required",
    siteId: values.siteId && scopedSiteIds().includes(values.siteId) ? "" : "Select a site in your scope",
    description: values.description ? "" : "Description is required",
    amount: values.amount != null && (!Number.isFinite(values.amount) || values.amount < 0) ? "Enter a valid amount" : "",
  };
  Object.entries(errors).forEach(([name, message]) => approvalFormError(form, name, message));
  const first = Object.values(errors).find(Boolean);
  if (first) { const general = form.querySelector("[data-approval-form-error]"); if (general) general.textContent = "Please correct the highlighted fields."; return; }
  const now = nowStamp();
  let req = current;
  if (!req) {
    req = { id: Store.nextId(APPROVAL_REQUESTS), ...values, requestedBy: currentUser().id, requestDate: now.slice(0, 10), status: "Pending", approvedBy: null, decisionDate: null, attachments: [], history: [{ at: now, by: currentUser().id, action: "Created", remark: "" }] };
    APPROVAL_REQUESTS.push(req);
    approvalAudit("Approval Request Created", `${req.title} created`);
  } else {
    Object.assign(req, values);
    (req.history = req.history || []).push({ at: now, by: currentUser().id, action: "Edited", remark: "" });
    approvalAudit("Approval Request Edited", `${req.title} edited`);
  }
  approvalEditState.attachmentError = "";
  state.approvalEdit = returnToList ? null : req.id;
  showToast(`Request ${esc(req.title)} saved`);
  render();
}

function updateApprovalTypeFields() {
  const form = document.querySelector("[data-approval-form]");
  if (!form) return;
  const type = form.elements.type.value;
  form.querySelectorAll("[data-approval-conditional]").forEach((el) => {
    const show = el.dataset.approvalConditional === "amount" ? ["Petty Cash", "Material"].includes(type) : type === "Manpower Onboarding";
    el.hidden = !show;
  });
}

function approvalReadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function addApprovalFiles(files) {
  const req = currentApprovalRequest();
  if (!req || !Approvals.canEdit(currentUser(), req)) { approvalEditState.attachmentError = "You cannot change attachments on this request"; render(); return; }
  const errors = [];
  let added = 0;
  for (const file of Array.from(files || [])) {
    try {
      const dataUrl = await approvalReadFile(file);
      const r = Approvals.addAttachment(req, { name: file.name, type: file.type, size: file.size, dataUrl }, currentUser(), nowStamp());
      if (r.ok) { added++; approvalAudit("Approval Attachment Added", `${req.title}: ${file.name}`); }
      else errors.push(`${file.name}: ${r.error}`);
    } catch (err) { errors.push(`${file.name}: ${err.message || "Could not read file"}`); }
  }
  approvalEditState.attachmentError = errors.join(" ");
  if (added) showToast(`${added} attachment${added === 1 ? "" : "s"} added`);
  render();
}

function addApprovalDroppedFiles(event) {
  event.preventDefault();
  addApprovalFiles(event.dataTransfer && event.dataTransfer.files);
}

function removeApprovalAttachment(attId) {
  const req = currentApprovalRequest();
  if (!req || req.requestedBy !== currentUser().id) { showToast("Only the requester can delete attachments"); return; }
  const att = (req.attachments || []).find((a) => Number(a.id) === Number(attId));
  const r = Approvals.removeAttachment(req, attId, currentUser());
  if (!r.ok) { showToast(esc(r.error)); return; }
  approvalAudit("Approval Attachment Removed", `${req.title}: ${att ? att.name : "attachment"}`);
  approvalEditState.attachmentError = "";
  showToast("Attachment removed");
  render();
}

function resubmitApproval(reqId) {
  const req = byId(APPROVAL_REQUESTS, reqId);
  if (!req) return;
  UI.confirm(`Resubmit "${req.title}" for approval?`, (remark) => {
    const r = Approvals.resubmit(req, currentUser(), remark, nowStamp());
    if (!r.ok) { showToast(esc(r.error)); return; }
    approvalAudit("Approval Request Resubmitted", `${req.title}${remark ? ` - ${remark}` : ""}`);
    showToast("Request resubmitted");
    render();
  }, { title: "Resubmit request", yesLabel: "Resubmit", reason: { label: "Remark (optional)", required: false } });
}

function pageApprovals() {
  if (state.approvalEdit != null) return approvalEditHtml();
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
