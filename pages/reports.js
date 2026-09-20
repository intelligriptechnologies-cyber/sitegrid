/* Reports: DOM-free builders (buildReport) followed by the catalog page.
   buildReport(id, filters, ctx) -> { title, columns:[{key,label,kind?}], rows:[obj], footer?:obj, notes?:string[] }
   filters: { siteId, month, from, to }.  ctx: { siteIds, now:"YYYY-MM-DD", requests?, labour? }. kind: "money" | "num". */

const REPORT_CATALOG = [
  { id: "site-summary", title: "Site summary", desc: "Status, manpower, attendance, wage outstanding and expense per site.", filters: ["siteId", "month", "from", "to"] },
  { id: "attendance", title: "Attendance summary", desc: "Present, half day, absent, leave and days worked per labour.", filters: ["siteId", "month", "from", "to"] },
  { id: "wages", title: "Wage statement", desc: "Payable, paid and balance per labour and period.", filters: ["siteId", "month", "from", "to"] },
  { id: "petty-cash", title: "Petty cash summary", desc: "Expense by category and by site, split by approval status.", filters: ["siteId", "month", "from", "to"] },
  { id: "headcount", title: "Manpower headcount", desc: "Department, site and skill counts with biometric coverage.", filters: ["siteId"] },
  { id: "materials", title: "Material summary", desc: "Quantities by site, category (client vs company) and material.", filters: ["siteId", "month", "from", "to"] },
  { id: "approvals-aging", title: "Approvals aging", desc: "Open requests with age in days and aging buckets.", filters: ["siteId"] },
  { id: "labour-approval", title: "Labour approval report", desc: "Labour by approval status.", filters: [] },
];

function reportInPeriod(date, f) {
  const d = String(date || "");
  return (!f.month || d.startsWith(`${f.month}-`)) && Filters.inDateRange(d, f.from, f.to);
}

function reportSiteIds(f, ctx) {
  const ids = ctx.siteIds || [];
  return f.siteId && ids.includes(Number(f.siteId)) ? [Number(f.siteId)] : ids;
}

const reportSiteName = (id) => { const s = SITES.find((x) => x.id === id); return s ? s.name : "—"; };
const reportUserName = (id) => { const u = USERS.find((x) => x.id === id); return u ? u.name : "—"; };
const reportSum = (rows, key) => rows.reduce((total, r) => total + (Number(r[key]) || 0), 0);

function daysBetween(fromDate, toDate) {
  const a = Date.parse(`${String(fromDate).slice(0, 10)}T00:00:00Z`), b = Date.parse(`${String(toDate).slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86400000));
}
function agingBucket(days) { return days <= 2 ? "0–2 days" : days <= 7 ? "3–7 days" : "8+ days"; }

function buildReport(id, filters, ctx) {
  const f = filters || {};
  const siteIds = reportSiteIds(f, ctx);
  const builders = {
    "site-summary": () => {
      const rows = SITES.filter((s) => siteIds.includes(s.id)).map((s) => {
        const att = ATTENDANCE.filter((a) => a.siteId === s.id && reportInPeriod(a.date, f));
        return {
          site: s.name, status: s.status,
          manpower: siteLabourIds(s.id).filter((lid) => { const l = LABOUR.find((x) => x.id === lid); return l && l.approvalStatus === "Approved"; }).length,
          marked: att.length, present: att.filter((a) => a.status === "Present").length,
          wageOutstanding: WAGES.filter((w) => w.siteId === s.id && (!f.month || w.period === f.month)).reduce((sum, w) => sum + w.balancePayable, 0),
          expense: EXPENSES.filter((e) => e.siteId === s.id && e.status !== "Rejected" && reportInPeriod(e.date, f)).reduce((sum, e) => sum + e.amount, 0),
        };
      });
      return { title: "Site summary", columns: [
        { key: "site", label: "Site" }, { key: "status", label: "Status" }, { key: "manpower", label: "Manpower", kind: "num" }, { key: "marked", label: "Attendance marked", kind: "num" },
        { key: "present", label: "Present", kind: "num" }, { key: "wageOutstanding", label: "Wage outstanding", kind: "money" }, { key: "expense", label: "Expense (excl. rejected)", kind: "money" }],
        rows, footer: { site: "Total", manpower: reportSum(rows, "manpower"), marked: reportSum(rows, "marked"), present: reportSum(rows, "present"), wageOutstanding: reportSum(rows, "wageOutstanding"), expense: reportSum(rows, "expense") } };
    },
    attendance: () => {
      const records = ATTENDANCE.filter((a) => siteIds.includes(a.siteId) && reportInPeriod(a.date, f));
      const labourIds = [...new Set([
        ...siteIds.flatMap((sid) => siteLabourIds(sid)).filter((lid) => { const l = LABOUR.find((x) => x.id === lid); return l && l.active && l.approvalStatus === "Approved"; }),
        ...records.map((a) => a.labourId)])];
      const rows = labourIds.map((lid) => {
        const mine = records.filter((a) => a.labourId === lid);
        const count = (status) => mine.filter((a) => a.status === status).length;
        const sites = [...new Set(mine.length ? mine.map((a) => a.siteId) : siteLabourIds(lid).filter((sid) => siteIds.includes(sid)))];
        const l = LABOUR.find((x) => x.id === lid);
        return { labour: l ? l.name : "—", site: sites.map(reportSiteName).join(", "), present: count("Present"), half: count("Half Day"), absent: count("Absent"), leave: count("Leave"), worked: count("Present") + 0.5 * count("Half Day") };
      }).sort((a, b) => a.labour.localeCompare(b.labour));
      return { title: "Attendance summary", columns: [
        { key: "labour", label: "Labour" }, { key: "site", label: "Site" }, { key: "present", label: "Present", kind: "num" }, { key: "half", label: "Half day", kind: "num" },
        { key: "absent", label: "Absent", kind: "num" }, { key: "leave", label: "Leave", kind: "num" }, { key: "worked", label: "Days worked", kind: "num" }],
        rows, footer: { labour: "Total", present: reportSum(rows, "present"), half: reportSum(rows, "half"), absent: reportSum(rows, "absent"), leave: reportSum(rows, "leave"), worked: reportSum(rows, "worked") } };
    },
    wages: () => {
      const list = WAGES.filter((w) => siteIds.includes(w.siteId) && (!f.month || w.period === f.month) && Filters.inDateRange(w.paymentDate, f.from, f.to));
      const rows = list.map((w) => ({ labour: (LABOUR.find((l) => l.id === w.labourId) || {}).name || "—", site: reportSiteName(w.siteId), period: w.period, payable: w.totalPayable, paid: w.advancePaid, balance: w.balancePayable, status: w.status }));
      const bySite = siteIds.map((sid) => [sid, list.filter((w) => w.siteId === sid).reduce((s, w) => s + w.balancePayable, 0)]).filter(([, v]) => v > 0);
      return { title: "Wage statement", columns: [
        { key: "labour", label: "Labour" }, { key: "site", label: "Site" }, { key: "period", label: "Period" }, { key: "payable", label: "Payable", kind: "money" },
        { key: "paid", label: "Paid", kind: "money" }, { key: "balance", label: "Balance", kind: "money" }, { key: "status", label: "Status" }],
        rows, footer: { labour: "Total", payable: reportSum(rows, "payable"), paid: reportSum(rows, "paid"), balance: reportSum(rows, "balance") },
        notes: bySite.map(([sid, v]) => `Outstanding at ${reportSiteName(sid)}: ${v}`) };
    },
    "petty-cash": () => {
      const list = EXPENSES.filter((e) => siteIds.includes(e.siteId) && reportInPeriod(e.date, f));
      const row = (group, name, items) => ({ group, name, approved: items.filter((e) => e.status === "Approved").reduce((s, e) => s + e.amount, 0), pending: items.filter((e) => e.status === "Pending").reduce((s, e) => s + e.amount, 0), rejected: items.filter((e) => e.status === "Rejected").reduce((s, e) => s + e.amount, 0), total: items.reduce((s, e) => s + e.amount, 0) });
      const categories = [...new Set(list.map((e) => e.category))].sort();
      const rows = [...categories.map((c) => row("By category", c, list.filter((e) => e.category === c))),
        ...siteIds.filter((sid) => list.some((e) => e.siteId === sid)).map((sid) => row("By site", reportSiteName(sid), list.filter((e) => e.siteId === sid)))];
      const catRows = rows.filter((r) => r.group === "By category");
      return { title: "Petty cash summary", columns: [
        { key: "group", label: "Breakdown" }, { key: "name", label: "Name" }, { key: "approved", label: "Approved", kind: "money" }, { key: "pending", label: "Pending", kind: "money" },
        { key: "rejected", label: "Rejected", kind: "money" }, { key: "total", label: "Total", kind: "money" }],
        rows, footer: { group: "Total", approved: reportSum(catRows, "approved"), pending: reportSum(catRows, "pending"), rejected: reportSum(catRows, "rejected"), total: reportSum(catRows, "total") },
        notes: ["Total counts each expense once (category rows); the by-site rows re-group the same expenses."] };
    },
    headcount: () => {
      const visible = ctx.labour || LABOUR;
      const inScope = (l) => visible.some((v) => v.id === l.id);
      const bio = (l) => BIOMETRICS.some((b) => b.labourId === l.id);
      const make = (department, site, list) => [...new Set(list.map((l) => l.skill))].sort().map((skill) => {
        const group = list.filter((l) => l.skill === skill);
        return { department, site, skill, active: group.filter((l) => l.active).length, inactive: group.filter((l) => !l.active).length, total: group.length, biometric: group.filter(bio).length };
      });
      const rows = SITES.filter((s) => siteIds.includes(s.id)).flatMap((s) => make((DEPARTMENTS.find((d) => d.id === s.departmentId) || {}).name || "—", s.name, LABOUR.filter((l) => inScope(l) && siteLabourIds(s.id).includes(l.id))));
      const unmapped = f.siteId ? [] : make("—", "Unmapped", LABOUR.filter((l) => inScope(l) && isUnmapped(l.id)));
      const all = [...rows, ...unmapped];
      const distinct = LABOUR.filter((l) => inScope(l) && (unmapped.length && isUnmapped(l.id) ? true : labourSiteIds(l.id).some((sid) => siteIds.includes(sid))));
      const coverage = distinct.length ? Math.round((distinct.filter(bio).length / distinct.length) * 100) : 0;
      return { title: "Manpower headcount", columns: [
        { key: "department", label: "Department" }, { key: "site", label: "Site" }, { key: "skill", label: "Skill" }, { key: "active", label: "Active", kind: "num" },
        { key: "inactive", label: "Inactive", kind: "num" }, { key: "total", label: "Total", kind: "num" }, { key: "biometric", label: "With biometric", kind: "num" }],
        rows: all, footer: { department: "Total", active: reportSum(all, "active"), inactive: reportSum(all, "inactive"), total: reportSum(all, "total"), biometric: reportSum(all, "biometric") },
        notes: [`Biometric coverage: ${coverage}% of ${distinct.length} distinct labour (a labour on several sites is counted once here, once per site in the rows).`] };
    },
    materials: () => {
      const list = MATERIALS.filter((m) => siteIds.includes(m.siteId) && reportInPeriod(m.date, f));
      const keys = [...new Set(list.map((m) => `${m.siteId}|${m.category}|${m.name}|${m.unit}`))];
      const rows = keys.map((k) => {
        const group = list.filter((m) => `${m.siteId}|${m.category}|${m.name}|${m.unit}` === k);
        return { site: reportSiteName(group[0].siteId), category: group[0].category, material: group[0].name, unit: group[0].unit, quantity: reportSum(group, "quantity"), entries: group.length };
      }).sort((a, b) => a.site.localeCompare(b.site) || a.category.localeCompare(b.category) || a.material.localeCompare(b.material));
      return { title: "Material summary", columns: [
        { key: "site", label: "Site" }, { key: "category", label: "Category" }, { key: "material", label: "Material" }, { key: "unit", label: "Unit" },
        { key: "quantity", label: "Quantity", kind: "num" }, { key: "entries", label: "Entries", kind: "num" }],
        rows, footer: { site: "Total", entries: reportSum(rows, "entries") } };
    },
    "approvals-aging": () => {
      const open = ["Pending", "Review Requested", "Resubmitted"];
      const source = ctx.requests || APPROVAL_REQUESTS;
      const rows = source.filter((r) => open.includes(r.status) && (r.siteId == null || siteIds.includes(r.siteId)) && (!f.siteId || r.siteId === Number(f.siteId)))
        .map((r) => { const age = daysBetween(r.requestDate, ctx.now); return { title: r.title, type: r.type, site: r.siteId == null ? "—" : reportSiteName(r.siteId), requester: reportUserName(r.requestedBy), requested: String(r.requestDate).slice(0, 10), status: r.status, age, bucket: agingBucket(age) }; })
        .sort((a, b) => b.age - a.age);
      const buckets = ["0–2 days", "3–7 days", "8+ days"].map((b) => `${b}: ${rows.filter((r) => r.bucket === b).length}`);
      return { title: "Approvals aging", columns: [
        { key: "title", label: "Request" }, { key: "type", label: "Type" }, { key: "site", label: "Site" }, { key: "requester", label: "Requested by" },
        { key: "requested", label: "Requested on" }, { key: "status", label: "Status" }, { key: "age", label: "Age (days)", kind: "num" }, { key: "bucket", label: "Bucket" }],
        rows, footer: { title: "Open requests", age: rows.length }, notes: [`Buckets — ${buckets.join(" · ")}`] };
    },
    "labour-approval": () => {
      const visible = ctx.labour || LABOUR;
      const rows = ["Approved", "Pending", "Rejected"].map((status) => ({ status, count: visible.filter((l) => l.approvalStatus === status).length }));
      return { title: "Labour approval report", columns: [{ key: "status", label: "Status" }, { key: "count", label: "Count", kind: "num" }], rows, footer: { status: "Total", count: reportSum(rows, "count") } };
    },
  };
  if (!builders[id]) throw new Error(`Unknown report: ${id}`);
  return builders[id]();
}

/* ---------- page ---------- */
const reportView = { id: "site-summary", siteId: "", month: "", from: "", to: "" };

function setReportFilter(key, value) {
  if (key === "_clear") ["siteId", "month", "from", "to"].forEach((k) => { reportView[k] = ""; });
  else reportView[key] = value;
  render();
}

function reportContext() {
  return { siteIds: scopedSiteIds(), now: Filters.today(), requests: Approvals.visibleRequests(currentUser(), state.deptId), labour: LABOUR.filter(labourVisibleNow) };
}
function currentReport() { return buildReport(reportView.id, reportView, reportContext()); }
function reportCell(col, value) {
  if (value === undefined || value === null || value === "") return "";
  return col.kind === "money" ? currency(value) : String(value);
}

function pageReports() {
  const scoped = scopedSiteIds();
  if (reportView.siteId && !scoped.includes(Number(reportView.siteId))) reportView.siteId = "";
  const meta = REPORT_CATALOG.find((r) => r.id === reportView.id) || REPORT_CATALOG[0];
  reportView.id = meta.id;
  const report = currentReport();
  const fields = [{ key: "id", label: "Report", type: "select", value: meta.id, noAll: true, options: REPORT_CATALOG.map((r) => ({ value: r.id, label: r.title })) }];
  if (meta.filters.includes("siteId")) fields.push({ key: "siteId", label: "Site", type: "select", value: reportView.siteId, allLabel: "All sites", options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) });
  if (meta.filters.includes("month")) fields.push({ key: "month", label: "Month-Year", type: "month", value: reportView.month });
  if (meta.filters.includes("from")) fields.push({ key: "from", label: "Date from", type: "date", value: reportView.from }, { key: "to", label: "Date to", type: "date", value: reportView.to });
  const summary = () => Filters.summary([["Site", reportView.siteId && meta.filters.includes("siteId") ? siteName(Number(reportView.siteId)) : ""],
    ["Month", meta.filters.includes("month") ? reportView.month : ""], ["From", meta.filters.includes("from") ? reportView.from : ""], ["To", meta.filters.includes("from") ? reportView.to : ""]]);
  const totalsText = () => (report.footer ? `Totals — ${report.columns.filter((c) => report.footer[c.key] !== undefined && c.kind).map((c) => `${c.label}: ${report.footer[c.key]}`).join("; ")}` : "");
  return `<div class="page-head"><div><div class="page-eyebrow">// INSIGHT</div><div class="page-heading">Reports</div><div class="page-sub">${esc(meta.desc)} Scoped to your role and the Department selector.</div></div></div>
    ${Filters.barHtml("setReportFilter", fields)}
    ${(report.notes || []).length ? `<div class="attendance-summary">${report.notes.map((n) => `<span class="tag neutral">${esc(n)}</span>`).join("")}</div>` : ""}
    ${UI.tableHost({
      id: `report-${meta.id}`,
      rows: () => currentReport().rows,
      emptyText: "No data for the selected report and filters.",
      searchPlaceholder: "Search this report...",
      toolbarHtml: () => UI.exportMenu(() => Filters.matrixFor(`report-${meta.id}`, report.title, [summary(), totalsText()].filter(Boolean).join(" | "), currentUser().name), report.title),
      columns: report.columns.map((c) => ({ label: c.label, align: c.kind ? "right" : undefined, text: (r) => reportCell(c, r[c.key]) })),
      footerHtml: () => (report.footer ? report.columns.map((c) => (report.footer[c.key] === undefined ? "" : `<strong>${esc(c.label)}</strong> ${esc(reportCell(c, report.footer[c.key]))}`)).filter(Boolean).join(" · ") : ""),
    })}`;
}
