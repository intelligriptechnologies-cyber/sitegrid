/* Auth + scope logic. Pure functions over the global seed arrays; no DOM. */
const DENIED_MSG = "Contact Admin to configure access";
const DEMO_OTP = "1111";

const Auth = {
  normalizeMobile(s) { return String(s || "").replace(/\D/g, "").slice(-10); },
  findUserByMobile(mobile) {
    const m = this.normalizeMobile(mobile);
    return m.length === 10 ? USERS.find((u) => u.mobile === m) || null : null;
  },
  roleLevel(user) { const r = user && ROLES.find((x) => x.id === user.roleId); return r ? r.level : Infinity; },
  isAllDeptRole(user) { return this.roleLevel(user) <= 1; },
  allowedDepartments(user) {
    const active = DEPARTMENTS.filter((d) => d.active);
    return this.isAllDeptRole(user) ? active : active.filter((d) => (user.departmentIds || []).includes(d.id));
  },
  defaultDept(user) {
    if (this.isAllDeptRole(user)) return null;
    const list = this.allowedDepartments(user);
    return list.length ? list[0].id : null;
  },
  canSignIn(user) {
    const role = user && ROLES.find((x) => x.id === user.roleId);
    return !!user && user.active && !!role && role.active !== false && (this.isAllDeptRole(user) || this.allowedDepartments(user).length > 0);
  },
  requestOtp(mobile) {
    const user = this.findUserByMobile(mobile);
    return this.canSignIn(user) ? { ok: true, user } : { ok: false, error: DENIED_MSG };
  },
  verifyOtp(mobile, otp) {
    const r = this.requestOtp(mobile);
    if (!r.ok) return r;
    return String(otp).trim() === DEMO_OTP ? r : { ok: false, error: "Invalid OTP" };
  },
  scopeSiteIds(user, deptId) {
    let sites;
    if (this.isAllDeptRole(user)) sites = SITES;
    // Department Heads see every site of their departments; siteIds is ignored for this role.
    else if (this.roleLevel(user) === 2) sites = SITES.filter((s) => (user.departmentIds || []).includes(s.departmentId));
    else sites = SITES.filter((s) => (user.siteIds || []).includes(s.id));
    if (deptId != null) sites = sites.filter((s) => s.departmentId === deptId);
    return sites.map((s) => s.id);
  },
};

const Session = {
  KEY: "sitegrid.session",
  storage: (() => { try { return typeof sessionStorage !== "undefined" ? sessionStorage : null; } catch (e) { return null; } })(),
  save(userId, deptId) { try { this.storage && this.storage.setItem(this.KEY, JSON.stringify({ userId, deptId })); } catch (e) { /* ignore */ } },
  load() { try { const raw = this.storage && this.storage.getItem(this.KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  clear() { try { this.storage && this.storage.removeItem(this.KEY); } catch (e) { /* ignore */ } },
};
