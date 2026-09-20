/* Tools & Safety Equipment: per-site item lists. Pure helpers first, then the page and dialogs. */

const ITEM_CONDITIONS = ["Good", "Needs repair", "Needs inspection", "Out of service"];

function filterItems(rows, f = {}) {
  return rows.filter((r) => !f.siteId || r.siteId === Number(f.siteId));
}

function validateItemForm(vals) {
  const errors = {};
  if (!Number(vals.siteId)) errors.siteId = "Site is required";
  if (!String(vals.name || "").trim()) errors.name = "Item name is required";
  if (vals.quantity === "" || vals.quantity == null || !(Number(vals.quantity) >= 0)) errors.quantity = "Quantity must be 0 or more";
  if (!ITEM_CONDITIONS.includes(vals.condition)) errors.condition = "Condition is required";
  return errors;
}

function saveItem(rows, vals, existing, userId, today) {
  const fields = { siteId: Number(vals.siteId), name: String(vals.name).trim(), quantity: Number(vals.quantity), unit: String(vals.unit || "").trim(),
    condition: vals.condition, remarks: vals.remarks || "", updatedOn: today, updatedBy: userId };
  if (existing) return Object.assign(existing, fields);
  const row = { id: Store.nextId(rows), ...fields };
  rows.push(row);
  return row;
}

/* ---------- page ---------- */
const resourceView = { tab: "tools", siteId: "" };
function resourceRowsSource() { return resourceView.tab === "safety" ? SAFETY_EQUIPMENT : TOOLS; }
function resourceRows() { return filterItems(resourceRowsSource().filter((r) => scopedSiteIds().includes(r.siteId)), resourceView); }
function conditionKind(c) { return c === "Good" ? "ok" : c === "Out of service" ? "danger" : "warn"; }

function setResourceSite(value) { resourceView.siteId = value; render(); }
function setResourceTab(tab) { resourceView.tab = tab === "safety" ? "safety" : "tools"; render(); }

function pageResources() {
  const canEdit = can("addSite");
  const scoped = scopedSiteIds();
  if (resourceView.siteId && !scoped.includes(Number(resourceView.siteId))) resourceView.siteId = "";
  const label = resourceView.tab === "safety" ? "Safety Equipment" : "Tools";
  const site = resourceView.siteId ? siteName(Number(resourceView.siteId)) : "";
  return `<div class="page-head"><div><div class="page-eyebrow">// OPERATIONS</div><div class="page-heading">Tools &amp; Safety Equipment</div><div class="page-sub">Item-level inventory kept per site, with condition tracking.</div></div>
    <button class="btn teal" ${canEdit ? "" : `disabled title="Requires the Add sites permission"`} onclick="showItemForm()">+ Add Item</button></div>
    <div class="filter-bar panel"><div class="panel-body">
      <div class="field"><label for="resourceSite">Site / Project</label><select id="resourceSite" onchange="setResourceSite(this.value)"><option value="">All sites</option>${SITES.filter((s) => scoped.includes(s.id)).map((s) => `<option value="${s.id}" ${String(s.id) === String(resourceView.siteId) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      <div class="attendance-toggle" role="group" aria-label="Inventory type"><button class="btn ${resourceView.tab === "tools" ? "teal" : "secondary"}" onclick="setResourceTab('tools')">Tools</button><button class="btn ${resourceView.tab === "safety" ? "teal" : "secondary"}" onclick="setResourceTab('safety')">Safety Equipment</button></div>
    </div></div>
    ${UI.tableHost({
      id: "resources",
      rows: resourceRows,
      emptyText: site ? `No ${label.toLowerCase()} recorded for ${site}.` : `No ${label.toLowerCase()} recorded within your scope.`,
      searchPlaceholder: "Search items, site, condition or remarks...",
      toolbarHtml: () => UI.exportMenu(() => Filters.matrixFor("resources", label, Filters.summary([["Site", site]]), currentUser().name), label),
      columns: [
        { label: "Item", text: (r) => r.name, html: (r) => `<strong>${esc(r.name)}</strong>` },
        { label: "Site", text: (r) => siteName(r.siteId) },
        { label: "Qty", text: (r) => `${r.quantity}${r.unit ? ` ${r.unit}` : ""}`, align: "right" },
        { label: "Condition", text: (r) => r.condition, html: (r) => UI.tag(r.condition, conditionKind(r.condition)) },
        { label: "Remarks", text: (r) => r.remarks || "", html: (r) => `<span class="dim">${esc(r.remarks || "—")}</span>` },
        { label: "Updated", text: (r) => `${r.updatedOn} ${userName(r.updatedBy)}`, html: (r) => `<span class="text-mono">${esc(r.updatedOn || "—")}</span> <span class="dim">${esc(userName(r.updatedBy))}</span>` },
      ],
      rowActions: canEdit ? [{ key: "edit", label: "Edit item", icon: "✎" }, { key: "delete", label: "Delete item", icon: "✕", danger: true }] : [],
      onAction: (action, r) => (action === "edit" ? showItemForm(r.id) : deleteItem(r.id)),
      footerHtml: (rows) => `<strong>${rows.length} item${rows.length === 1 ? "" : "s"}</strong> · Total quantity ${rows.reduce((s, r) => s + r.quantity, 0).toLocaleString("en-IN")}`,
    })}`;
}

function showItemForm(id) {
  if (!can("addSite")) { showToast("You do not have permission to change inventory"); return; }
  const rows = resourceRowsSource();
  const existing = id ? rows.find((r) => r.id === id) : null;
  const scoped = scopedSiteIds();
  const label = resourceView.tab === "safety" ? "Safety Item" : "Tool";
  UI.form({
    title: `${existing ? "Edit" : "Add"} ${label}`,
    values: existing ? { ...existing } : { siteId: Number(resourceView.siteId) || "", condition: "Good" },
    fields: [
      { name: "siteId", label: "Site", type: "select", required: true, options: SITES.filter((s) => scoped.includes(s.id)).map((s) => ({ value: s.id, label: s.name })) },
      { name: "name", label: "Item name", type: "text", required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true, min: 0, step: "1" },
      { name: "unit", label: "Unit", type: "text", placeholder: "Nos, Sets, Pairs" },
      { name: "condition", label: "Condition", type: "select", required: true, options: ITEM_CONDITIONS.map((c) => ({ value: c, label: c })) },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    submitLabel: existing ? "Save Changes" : "Add Item",
    onSubmit: (v) => {
      const errors = validateItemForm(v);
      if (Object.keys(errors).length) return errors;
      const row = saveItem(rows, v, existing, state.currentUserId, Filters.today());
      AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: existing ? "Inventory Updated" : "Inventory Added", details: `${row.name} ×${row.quantity} at ${siteName(row.siteId)}` });
      showToast(existing ? "Item updated" : "Item added");
      render();
      return null;
    },
  });
}

function deleteItem(id) {
  if (!can("addSite")) { showToast("You do not have permission to change inventory"); return; }
  const rows = resourceRowsSource();
  const row = rows.find((r) => r.id === id);
  if (!row || !scopedSiteIds().includes(row.siteId)) return;
  UI.confirm(`Delete ${row.name} (${row.quantity}) from ${siteName(row.siteId)}?`, () => {
    rows.splice(rows.indexOf(row), 1);
    AUDIT_LOG.push({ id: Store.nextId(AUDIT_LOG), timestamp: nowStamp(), userId: state.currentUserId, action: "Inventory Deleted", details: `${row.name} removed from ${siteName(row.siteId)}` });
    showToast("Item deleted");
    render();
  }, { title: "Delete item", yesLabel: "Delete" });
}
