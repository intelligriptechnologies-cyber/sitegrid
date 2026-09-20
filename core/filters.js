/* Shared filter helpers for Phase 5 pages. Pure helpers are DOM-free; barHtml only builds a string. */
const Filters = (() => {
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Empty bounds are ignored; a value that is empty fails as soon as any bound is set. Strings compare lexically (YYYY-MM-DD). */
  function inDateRange(value, from, to) {
    if (!from && !to) return true;
    const v = String(value || "");
    if (!v) return false;
    const day = v.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  }

  /* Labour mapped to the chosen site (or to any in-scope site when no site is chosen), sorted by name. */
  function labourForSite(siteId, scopedIds) {
    const sid = Number(siteId) || null;
    const ids = sid ? [sid] : (scopedIds || []);
    return LABOUR.filter((l) => ids.some((id) => siteLabourIds(id).includes(l.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /* Human summary of the active filters for export meta: [[label, value], ...] -> "Site: X; Month: 2026-09" ("All" when none). */
  function summary(parts) {
    const active = (parts || []).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}: ${v}`);
    return active.length ? active.join("; ") : "none";
  }

  /* fields: [{ key, label, type: "select"|"date"|"month", value, options?: [{value,label}], allLabel? }]. Changes call fn(key, value). */
  function barHtml(fn, fields) {
    const control = (f) => {
      const id = `flt-${fn}-${f.key}`;
      const call = `${fn}('${f.key}',this.value)`;
      if (f.type === "select") {
        return `<div class="field"><label for="${e(id)}">${e(f.label)}</label><select id="${e(id)}" onchange="${e(call)}">${f.noAll ? "" : `<option value="">${e(f.allLabel || "All")}</option>`}${(f.options || []).map((o) =>
          `<option value="${e(o.value)}" ${String(o.value) === String(f.value ?? "") ? "selected" : ""}>${e(o.label)}</option>`).join("")}</select></div>`;
      }
      return `<div class="field"><label for="${e(id)}">${e(f.label)}</label><input id="${e(id)}" type="${f.type === "month" ? "month" : "date"}" value="${e(f.value ?? "")}" onchange="${e(call)}"></div>`;
    };
    return `<div class="filter-bar panel"><div class="panel-body">${fields.map(control).join("")}<button type="button" class="btn secondary small" onclick="${e(fn)}('_clear','')">Clear filters</button></div></div>`;
  }

  /* Matrix of a registered UI table's currently visible rows and columns (search included). */
  function matrixFor(tableId, title, filtersText, generatedBy) {
    const view = UI.getFiltered(tableId);
    return Export.buildMatrix({ title, columns: view.columns, rows: view.rows, filtersText, generatedBy });
  }

  function today(now) {
    const d = now instanceof Date ? now : new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function labourOptionsHtml(siteId, selectedId, scopedIds) {
    const list = siteId ? labourForSite(siteId, scopedIds) : [];
    return `<option value="">Select...</option>${list.map((l) =>
      `<option value="${l.id}" ${String(l.id) === String(selectedId ?? "") ? "selected" : ""}>${e(l.name)}</option>`).join("")}`;
  }

  /* Cascade inside an open UI.form: changing the site select rebuilds the labour select (labour mapped to that site). */
  function bindSiteLabour(fm, siteField, labourField, onLabourChange) {
    const site = fm.elements[siteField], labour = fm.elements[labourField];
    if (!site || !labour) return;
    site.addEventListener("change", () => { labour.innerHTML = labourOptionsHtml(site.value, ""); if (onLabourChange) onLabourChange(); });
    labour.addEventListener("change", () => { if (onLabourChange) onLabourChange(); });
  }

  return { inDateRange, labourForSite, summary, barHtml, matrixFor, today, labourOptionsHtml, bindSiteLabour };
})();
