/* Materials: site-specific material log. Pure helpers first, then the page and dialogs. */

const MATERIAL_CATEGORIES = ["Client Provided", "Company Provided"];

/* f: { siteId, category, from, to, month }; date range and month apply to the material date. */
function filterMaterials(rows, f = {}) {
  return rows.filter((m) =>
    (!f.siteId || m.siteId === Number(f.siteId)) &&
    (!f.category || m.category === f.category) &&
    (!f.month || String(m.date || "").startsWith(`${f.month}-`)) &&
    Filters.inDateRange(m.date, f.from, f.to));
}

function validateMaterialForm(vals) {
  const errors = {};
  if (!Number(vals.siteId)) errors.siteId = "Site is required";
  if (!String(vals.name || "").trim()) errors.name = "Material is required";
  if (!MATERIAL_CATEGORIES.includes(vals.category)) errors.category = "Category is required";
  if (!(Number(vals.quantity) > 0)) errors.quantity = "Quantity must be greater than 0";
  if (!String(vals.unit || "").trim()) errors.unit = "Unit is required";
  if (!String(vals.providedBy || "").trim()) errors.providedBy = "Provided by is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vals.date || ""))) errors.date = "Date is required";
  return errors;
}

function saveMaterial(vals, existing, userId) {
  const fields = { siteId: Number(vals.siteId), name: String(vals.name).trim(), category: vals.category, quantity: Number(vals.quantity),
    unit: String(vals.unit).trim(), providedBy: String(vals.providedBy).trim(), date: vals.date, remarks: vals.remarks || "", updatedBy: userId };
  if (existing) return Object.assign(existing, fields);
  const row = { id: Store.nextId(MATERIALS), ...fields };
  MATERIALS.push(row);
  return row;
}

/* ---------- page ---------- */
const materialFilters = { siteId: "", category: "", from: "", to: "", month: "" };

function setMaterialFilter(key, value) {
  if (key === "_clear") Object.keys(materialFilters).forEach((k) => { materialFilters[k] = ""; });
  else materialFilters[key] = value;
  render();
}

function materialRows() { return filterMaterials(MATERIALS.filter((m) => scopedSiteIds().includes(m.siteId)), materialFilters); }

function pageMaterials() {
  const canEdit = can("addSite");
  const scoped = scopedSiteIds();
  if (materialFilters.siteId && !scoped.includes(Number(materialFilters.siteId))) materialFilters.siteId = "";
  const rows = materialRows();
  const count = (category) => rows.filter((m) => m.category === category).length;
  const summary = () => Filters.summary([["Site", materialFilters.siteId ? siteName(Number(materialFilters.siteId)) : ""], ["Category", materialFilters.category],
    ["From", materialFilters.from], ["To", materialFilters.to], ["Month", materialFilters.month]]);
  return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">Material Tracking</div><div class="page-sub">Client-provided and company-provided materials, logged per site.</div></div>
    <button class="btn teal" ${canEdit ? "" : `disabled title="Requires the Add sites permission"`} onclick="showMaterialForm()">+ Add Material</button></div>
    ${Filters.barHtml("setMaterialFilter", [
      { key: "siteId", label: "Site", type: "select", value: materialFilters.siteId, allLabel: "All sites", options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
      { key: "category", label: "Category", type: "select", value: materialFilters.category, allLabel: "All categories", options: MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c })) },
      { key: "from", label: "Date from", type: "date", value: materialFilters.from },
      { key: "to", label: "Date to", type: "date", value: materialFilters.to },
      { key: "month", label: "Month-Year", type: "month", value: materialFilters.month },
    ])}
    <div class="attendance-summary"><span class="tag neutral">Client Provided ${count("Client Provided")}</span><span class="tag ok">Company Provided ${count("Company Provided")}</span><span class="tag neutral">Total ${rows.length}</span></div>
    ${UI.tableHost({
      id: "materials",
      rows: materialRows,
      emptyText: "No materials match the current filters.",
      searchPlaceholder: "Search material, site, provider or remarks...",
      toolbarHtml: () => UI.exportMenu(() => Filters.matrixFor("materials", "Materials", summary(), currentUser().name), "Materials"),
      columns: [
        { label: "Material", text: (m) => m.name, html: (m) => `<strong>${esc(m.name)}</strong>` },
        { label: "Site", text: (m) => siteName(m.siteId) },
        { label: "Category", text: (m) => m.category, html: (m) => UI.tag(m.category, m.category === "Client Provided" ? "neutral" : "ok") },
        { label: "Quantity", text: (m) => `${m.quantity.toLocaleString("en-IN")} ${m.unit}`, align: "right" },
        { label: "Provided by", text: (m) => m.providedBy },
        { label: "Date", text: (m) => m.date, html: (m) => `<span class="text-mono">${esc(m.date)}</span>` },
        { label: "Remarks", text: (m) => m.remarks || "", html: (m) => `<span class="dim">${esc(m.remarks || "—")}</span>` },
      ],
      rowActions: canEdit ? [{ key: "edit", label: "Edit material", icon: "✎" }, { key: "delete", label: "Delete material", icon: "✕", danger: true }] : [],
      onAction: (action, m) => (action === "edit" ? showMaterialForm(m.id) : deleteMaterial(m.id)),
      footerHtml: (list) => `<strong>${list.length} entr${list.length === 1 ? "y" : "ies"}</strong> · Client ${list.filter((m) => m.category === "Client Provided").length} · Company ${list.filter((m) => m.category === "Company Provided").length}`,
    })}`;
}

function showMaterialForm(id) {
  if (!can("addSite")) { showToast("You do not have permission to change materials"); return; }
  const existing = id ? MATERIALS.find((m) => m.id === id) : null;
  const scoped = scopedSiteIds();
  UI.form({
    title: existing ? "Edit Material" : "Add Material",
    values: existing ? { ...existing } : { siteId: Number(materialFilters.siteId) || "", date: Filters.today(), category: "Company Provided" },
    fields: [
      { name: "siteId", label: "Site", type: "select", required: true, options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
      { name: "name", label: "Material", type: "text", required: true },
      { name: "category", label: "Category", type: "select", required: true, options: MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c })) },
      { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.01, step: "any" },
      { name: "unit", label: "Unit", type: "text", required: true, placeholder: "Bags, Tonnes, Meters" },
      { name: "providedBy", label: "Provided by", type: "text", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    submitLabel: existing ? "Save Changes" : "Add Material",
    onSubmit: (v) => {
      const errors = validateMaterialForm(v);
      if (Object.keys(errors).length) return errors;
      const row = saveMaterial(v, existing, state.currentUserId);
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: existing ? "Material Updated" : "Material Added", details: `${row.name} (${row.category}) at ${siteName(row.siteId)}` });
      showToast(existing ? "Material updated" : "Material added");
      render();
      return null;
    },
  });
}

function deleteMaterial(id) {
  if (!can("addSite")) { showToast("You do not have permission to change materials"); return; }
  const row = MATERIALS.find((m) => m.id === id);
  if (!row || !scopedSiteIds().includes(row.siteId)) return;
  UI.confirm(`Delete ${row.name} logged at ${siteName(row.siteId)}?`, () => {
    MATERIALS.splice(MATERIALS.indexOf(row), 1);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Material Deleted", details: `${row.name} removed from ${siteName(row.siteId)}` });
    showToast("Material deleted");
    render();
  }, { title: "Delete material", yesLabel: "Delete" });
}
