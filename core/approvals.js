/* Approval request rules. Pure functions over the global seed arrays; no DOM.
   `now` is always an injected "YYYY-MM-DD HH:mm" string. */
const Approvals = {
  MAX_FILES: 5,
  MAX_BYTES: 1048576,
  ALLOWED_TYPES: [
    "application/pdf", "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv",
  ],
  DECIDABLE: ["Pending", "Resubmitted"],

  _level(user) { return Auth.roleLevel(user); },
  _perms(user) { const r = user && ROLES.find((x) => x.id === user.roleId); return (r && r.perms) || []; },
  _active(user) { const r = user && ROLES.find((x) => x.id === user.roleId); return !!user && user.active !== false && !!r && r.active !== false; },
  _siteDept(req) { const s = req && req.siteId != null ? SITES.find((x) => x.id === req.siteId) : null; return s ? s.departmentId : null; },
  _push(req, now, by, action, remark) { (req.history = req.history || []).push({ at: now, by, action, remark: remark || "" }); },

  visibleRequests(user, deptId, requests) {
    const rows = requests || APPROVAL_REQUESTS;
    if (!user) return [];
    const lvl = this._level(user);
    if (lvl >= 3) return rows.filter((r) => r.requestedBy === user.id);
    const dep = deptId == null ? null : deptId;
    if (lvl === 2) {
      return rows.filter((r) => {
        const d = this._siteDept(r);
        const inDept = d != null && (user.departmentIds || []).includes(d);
        return (r.requestedBy === user.id || inDept) && (dep == null || d === dep);
      });
    }
    return rows.filter((r) => dep == null || this._siteDept(r) === dep);
  },

  canAdd(user) { return this._active(user); },
  canEdit(user, req) {
    if (!this._active(user) || !req || req.status === "Approved") return false;
    return req.requestedBy === user.id || this._level(user) <= 1;
  },
  canDecide(user, req) {
    if (!this._active(user) || !req) return false;
    if (!this._perms(user).includes("approveLabour")) return false;
    if (!this.DECIDABLE.includes(req.status) || req.requestedBy === user.id) return false;
    return this.visibleRequests(user, null, [req]).length === 1;
  },
  showActionColumn(user) { return !!user && this._level(user) <= 2 && this._perms(user).includes("approveLabour"); },

  decide(req, action, user, remark, now) {
    if (!["approve", "reject", "review"].includes(action)) return { ok: false, error: "Unknown action" };
    if (!this.canDecide(user, req)) return { ok: false, error: "You cannot decide this request" };
    const text = String(remark || "").trim();
    if (action !== "approve" && !text) return { ok: false, error: action === "reject" ? "Reason is required" : "Remark is required" };
    const labour = req.labourId != null ? LABOUR.find((l) => l.id === req.labourId) : null;
    if (action === "review") {
      req.status = "Review Requested";
      this._push(req, now, user.id, "Review Requested", text);
      return { ok: true };
    }
    req.approvedBy = user.id;
    req.decisionDate = now;
    if (action === "approve") {
      req.status = "Approved";
      delete req.rejectionReason;
      if (labour) { labour.approvalStatus = "Approved"; labour.active = true; delete labour.rejectionReason; }
      this._push(req, now, user.id, "Approved", text);
    } else {
      req.status = "Rejected";
      req.rejectionReason = text;
      if (labour) { labour.approvalStatus = "Rejected"; labour.active = false; labour.rejectionReason = text; }
      this._push(req, now, user.id, "Rejected", text);
    }
    return { ok: true };
  },

  resubmit(req, user, remark, now) {
    if (!req || !user || req.requestedBy !== user.id) return { ok: false, error: "Only the requester can resubmit" };
    if (!["Review Requested", "Rejected"].includes(req.status)) return { ok: false, error: "Request cannot be resubmitted" };
    req.status = "Resubmitted";
    req.approvedBy = null;
    req.decisionDate = null;
    delete req.rejectionReason;
    const labour = req.labourId != null ? LABOUR.find((l) => l.id === req.labourId) : null;
    if (labour && labour.approvalStatus === "Rejected") { labour.approvalStatus = "Pending"; labour.active = false; delete labour.rejectionReason; }
    this._push(req, now, user.id, "Resubmitted", String(remark || "").trim());
    return { ok: true };
  },

  addAttachment(req, file, user, now) {
    if (!this.canEdit(user, req)) return { ok: false, error: "You cannot change attachments on this request" };
    if (!file || !file.name) return { ok: false, error: "Choose a file" };
    const type = String(file.type || "");
    if (!(type.startsWith("image/") || this.ALLOWED_TYPES.includes(type))) return { ok: false, error: "File type not allowed (images, PDF, Office documents)" };
    if (!(Number(file.size) <= this.MAX_BYTES)) return { ok: false, error: "File must be 1 MB or smaller" };
    req.attachments = req.attachments || [];
    if (req.attachments.length >= this.MAX_FILES) return { ok: false, error: "At most 5 attachments per request" };
    const id = Math.max(0, ...req.attachments.map((a) => Number(a.id) || 0)) + 1;
    req.attachments.push({ id, name: file.name, type, size: Number(file.size), dataUrl: file.dataUrl, by: user.id, at: now });
    return { ok: true };
  },
  removeAttachment(req, attId, user) {
    if (!this.canEdit(user, req)) return { ok: false, error: "You cannot change attachments on this request" };
    const i = (req.attachments || []).findIndex((a) => a.id === attId);
    if (i < 0) return { ok: false, error: "Attachment not found" };
    req.attachments.splice(i, 1);
    return { ok: true };
  },

  filter(rows, f) {
    f = f || {};
    const eq = (a, b) => b === undefined || b === null || b === "" || String(a) === String(b);
    const q = String(f.q || "").trim().toLowerCase();
    return rows.filter((r) => {
      if (!eq(r.requestedBy, f.requestedBy) || !eq(r.siteId, f.siteId) || !eq(r.status, f.status)) return false;
      if (!q) return true;
      const site = SITES.find((s) => s.id === r.siteId);
      const by = USERS.find((u) => u.id === r.requestedBy);
      return [r.title, r.description, r.type, by && by.name, site && site.name].some((v) => String(v || "").toLowerCase().includes(q));
    });
  },
};
