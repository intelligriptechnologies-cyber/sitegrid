/* Shared UI kit: searchable + paginated tables, form/confirm dialogs, tabs, switch.
   Pure helpers run in Node; DOM parts are guarded by `typeof document`. */
const UI = (() => {
  const HAS_DOM = typeof document !== "undefined";
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const registry = new Map(); // id -> { cfg, query, page, size, view, mounted }

  function filterRows(rows, columns, query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return rows.slice();
    return rows.filter((r) => columns.some((c) => String(c.text(r) ?? "").toLowerCase().includes(q)));
  }

  function paginate(rows, page, size) {
    const total = rows.length;
    const sz = Math.max(1, Number(size) || 10);
    const pages = Math.max(1, Math.ceil(total / sz));
    const p = Math.min(pages, Math.max(1, Number(page) || 1));
    const start = (p - 1) * sz;
    const slice = rows.slice(start, start + sz);
    return { rows: slice, page: p, pages, total, from: total ? start + 1 : 0, to: total ? start + slice.length : 0 };
  }

  /* ---------- table host ---------- */
  function tableHost(cfg) {
    const prev = registry.get(cfg.id);
    const sizes = cfg.pageSizes || [10, 20, 50];
    registry.set(cfg.id, {
      cfg, query: prev ? prev.query : "", page: prev ? prev.page : 1,
      size: prev ? prev.size : (cfg.pageSize || sizes[0]), view: [], mounted: null,
    });
    return `<div class="ui-table" data-id="${e(cfg.id)}"></div>`;
  }

  function findHost(id) {
    if (!HAS_DOM) return null;
    return [...document.querySelectorAll(".ui-table")].find((el) => el.dataset.id === id) || null;
  }

  function pagerHtml(st, pg) {
    const sizes = st.cfg.pageSizes || [10, 20, 50];
    return `<div class="ui-pager">
      <label class="ui-pager-size">Rows per page
        <select data-act="size">${sizes.map((n) => `<option value="${n}" ${n === st.size ? "selected" : ""}>${n}</option>`).join("")}</select>
      </label>
      <span class="ui-pager-range">${pg.from}–${pg.to} of ${pg.total}</span>
      <span class="ui-pager-nav">
        <button type="button" class="btn secondary small" data-act="prev" ${pg.page <= 1 ? "disabled" : ""}>Prev</button>
        <span class="ui-pager-page">${pg.page} / ${pg.pages}</span>
        <button type="button" class="btn secondary small" data-act="next" ${pg.page >= pg.pages ? "disabled" : ""}>Next</button>
      </span>
    </div>`;
  }

  function bodyHtml(st, pg) {
    const cfg = st.cfg;
    const acts = cfg.rowActions || [];
    const head = cfg.columns.map((c) => `<th${c.width ? ` style="width:${e(c.width)}"` : ""}>${e(c.label)}</th>`).join("") +
      (acts.length ? `<th class="row-actions-col"></th>` : "");
    const span = cfg.columns.length + (acts.length ? 1 : 0);
    const rows = pg.rows.map((r, i) => {
      const cells = cfg.columns.map((c) => `<td>${c.html ? c.html(r) : e(c.text(r))}</td>`).join("");
      const btns = acts.length ? `<td class="row-actions">${acts.filter((a) => !a.show || a.show(r)).map((a) =>
        `<button type="button" class="icon-btn${a.danger ? " danger" : ""}" data-row-act="${e(a.key)}" title="${e(a.label)}" aria-label="${e(a.label)}">${e(a.icon || a.label.slice(0, 1))}</button>`).join("")}</td>` : "";
      return `<tr data-i="${i}"${cfg.onRowClick ? ` class="clickable"` : ""}>${cells}${btns}</tr>`;
    }).join("");
    return `<div class="ui-table-scroll"><table class="table"><thead><tr>${head}</tr></thead><tbody>${rows ||
      `<tr><td colspan="${span}" class="ui-empty">${e(cfg.emptyText || "No records found")}</td></tr>`}</tbody></table></div>`;
  }

  function renderTable(st, host) {
    const cfg = st.cfg;
    const pg = paginate(filterRows(cfg.rows(), cfg.columns, st.query), st.page, st.size);
    st.page = pg.page;
    st.view = pg.rows;
    host.querySelector('[data-part="top"]').innerHTML = pagerHtml(st, pg);
    host.querySelector('[data-part="body"]').innerHTML = bodyHtml(st, pg);
    host.querySelector('[data-part="bottom"]').innerHTML = pagerHtml(st, pg);
  }

  function mount(st, host) {
    const cfg = st.cfg;
    host.innerHTML = `<div class="ui-toolbar"><div class="ui-toolbar-extra">${cfg.toolbarHtml ? cfg.toolbarHtml() : ""}</div>
      <input type="search" class="ui-search" placeholder="${e(cfg.searchPlaceholder || "Search...")}" value="${e(st.query)}" aria-label="Search"></div>
      <div data-part="top"></div><div data-part="body"></div><div data-part="bottom"></div>`;
    host.querySelector(".ui-search").addEventListener("input", (ev) => { st.query = ev.target.value; st.page = 1; renderTable(st, host); });
    host.addEventListener("change", (ev) => {
      if (ev.target.dataset && ev.target.dataset.act === "size") { st.size = Number(ev.target.value); st.page = 1; renderTable(st, host); }
    });
    host.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-act],[data-row-act],tr[data-i]");
      if (!t || !host.contains(t)) return;
      if (t.dataset.act === "prev") { st.page -= 1; renderTable(st, host); return; }
      if (t.dataset.act === "next") { st.page += 1; renderTable(st, host); return; }
      const tr = t.closest("tr[data-i]");
      const row = tr ? st.view[Number(tr.dataset.i)] : null;
      if (!row) return;
      if (t.dataset.rowAct) { if (cfg.onAction) cfg.onAction(t.dataset.rowAct, row); return; }
      if (cfg.onRowClick && !ev.target.closest("a,input,select,label,button")) cfg.onRowClick(row);
    });
    if (cfg.toolbarBind) cfg.toolbarBind(host.querySelector(".ui-toolbar-extra"));
    st.mounted = host;
    renderTable(st, host);
  }

  function refresh(id) {
    const st = registry.get(id), host = findHost(id);
    if (!st || !host) return;
    if (st.mounted !== host) mount(st, host); else renderTable(st, host);
  }

  function mountAll() {
    if (!HAS_DOM) return;
    for (const id of registry.keys()) {
      const st = registry.get(id), host = findHost(id);
      if (host) mount(st, host);
      else st.mounted = null;
    }
  }

  /* ---------- switch ---------- */
  function switchHtml(checked, onChangeJs, label) {
    return `<label class="switch"><input type="checkbox" ${checked ? "checked" : ""} onchange="${e(onChangeJs)}"><span class="switch-track"></span>${label ? `<span class="switch-label">${e(label)}</span>` : ""}</label>`;
  }

  /* ---------- tabs ---------- */
  function tabs(id, items, activeKey) {
    const active = activeKey && items.some((t) => t.key === activeKey) ? activeKey : (items[0] && items[0].key);
    return `<div class="ui-tabs" data-tabs="${e(id)}"><div class="tabs">${items.map((t) =>
      `<button type="button" class="tab${t.key === active ? " active" : ""}" data-tab="${e(t.key)}" onclick="UI.showTab('${e(id)}','${e(t.key)}')">${e(t.label)}</button>`).join("")}</div>${items.map((t) =>
      `<div class="tab-panel" data-panel="${e(t.key)}"${t.key === active ? "" : " hidden"}>${t.html}</div>`).join("")}</div>`;
  }
  function showTab(id, key) {
    if (!HAS_DOM) return;
    const root = [...document.querySelectorAll(".ui-tabs")].find((el) => el.dataset.tabs === id);
    if (!root) return;
    root.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === key));
    root.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = p.dataset.panel !== key; });
  }

  /* ---------- forms ---------- */
  function fieldHtml(f, values) {
    const v = values[f.name] !== undefined ? values[f.name] : (f.value !== undefined ? f.value : "");
    const req = f.required ? " *" : "";
    const nm = `name="${e(f.name)}"`;
    const tail = `${f.hint ? `<div class="field-hint">${e(f.hint)}</div>` : ""}<div class="field-error" data-err="${e(f.name)}"></div>`;
    let ctl;
    if (f.type === "select") {
      ctl = `<select ${nm}><option value="">Select...</option>${(f.options || []).map((o) =>
        `<option value="${e(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${e(o.label)}</option>`).join("")}</select>`;
    } else if (f.type === "multicheck") {
      const sel = (Array.isArray(v) ? v : []).map(String);
      ctl = `<div class="multicheck">${(f.options || []).map((o) =>
        `<label class="multicheck-item"><input type="checkbox" name="${e(f.name)}" value="${e(o.value)}" ${sel.includes(String(o.value)) ? "checked" : ""}><span>${e(o.label)}</span></label>`).join("")}</div>`;
    } else if (f.type === "textarea") {
      ctl = `<textarea ${nm} rows="3" placeholder="${e(f.placeholder || "")}">${e(v)}</textarea>`;
    } else if (f.type === "checkbox") {
      return `<div class="field${f.full ? " full" : ""}"><label class="multicheck-item"><input type="checkbox" ${nm} ${v ? "checked" : ""}><span>${e(f.label)}</span></label>${tail}</div>`;
    } else {
      const type = ["text", "tel", "email", "number", "date", "month"].includes(f.type) ? f.type : "text";
      ctl = `<input type="${type}" ${nm} value="${e(v)}" placeholder="${e(f.placeholder || "")}"${f.maxlength ? ` maxlength="${Number(f.maxlength)}"` : ""}>`;
    }
    return `<div class="field${f.full || f.type === "multicheck" || f.type === "textarea" ? " full" : ""}"><label>${e(f.label)}${req}</label>${ctl}${tail}</div>`;
  }

  function readValues(form, fields) {
    const out = {};
    for (const f of fields) {
      const els = [...form.elements].filter((x) => x.name === f.name);
      if (f.type === "multicheck") {
        const vals = els.filter((x) => x.checked).map((x) => x.value);
        const numeric = (f.options || []).length && f.options.every((o) => o.value !== "" && !isNaN(Number(o.value)));
        out[f.name] = numeric ? vals.map(Number) : vals;
      } else if (f.type === "checkbox") out[f.name] = !!(els[0] && els[0].checked);
      else if (f.type === "number") { const raw = els[0] ? els[0].value.trim() : ""; out[f.name] = raw === "" ? "" : Number(raw); }
      else out[f.name] = els[0] ? (f.type === "textarea" ? els[0].value : els[0].value.trim()) : "";
    }
    return out;
  }

  function form(opts) {
    const fields = opts.fields || [];
    const values = opts.values || {};
    const html = `<form class="ui-form" novalidate><div class="form-grid">${fields.map((f) => fieldHtml(f, values)).join("")}</div>
      <div class="field-error ui-form-error" data-err="_form"></div>
      <div class="form-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn teal">${e(opts.submitLabel || "Save")}</button></div></form>`;
    openModal(e(opts.title || ""), html);
    const fm = document.querySelector("#modalOverlay .ui-form");
    const setErr = (name, msg) => { const el = fm.querySelector(`[data-err="${name}"]`); if (el) el.textContent = msg || ""; };
    fm.querySelector("[data-cancel]").addEventListener("click", () => closeModal());
    fm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const vals = readValues(fm, fields);
      let bad = false;
      setErr("_form", "");
      for (const f of fields) {
        const v = vals[f.name];
        const empty = v === "" || v == null || v === false || (Array.isArray(v) && !v.length);
        let msg = null;
        if (f.required && empty) msg = `${f.label} is required`;
        else if (f.validate && !empty) msg = f.validate(v, vals) || null;
        setErr(f.name, msg);
        if (msg) bad = true;
      }
      if (bad) {
        const first = fm.querySelector(".field .field-error:not(:empty)");
        const c = first && first.parentElement.querySelector("input,select,textarea");
        if (c) c.focus();
        return;
      }
      const err = opts.onSubmit ? opts.onSubmit(vals, closeModal) : null;
      if (err) setErr("_form", err); else closeModal();
    });
    const firstCtl = fm.querySelector("input:not([type=checkbox]),select,textarea");
    if (firstCtl) firstCtl.focus();
  }

  function confirmDialog(message, onYes, o = {}) {
    openModal(e(o.title || "Confirm"), `<p class="ui-confirm-msg">${e(message)}</p>
      <div class="form-actions"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn danger" data-yes>${e(o.yesLabel || "Confirm")}</button></div>`);
    const box = document.querySelector("#modalOverlay .modal-body");
    box.querySelector("[data-no]").addEventListener("click", () => closeModal());
    box.querySelector("[data-yes]").addEventListener("click", () => { closeModal(); if (onYes) onYes(); });
    box.querySelector("[data-no]").focus();
  }

  function readImage(file, maxBytes = 1048576) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || "")) return reject(new Error("Choose an image file"));
      if (file.size > maxBytes) return reject(new Error("Image must be under 1 MB"));
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Could not read the image"));
      r.readAsDataURL(file);
    });
  }

  return { filterRows, paginate, tableHost, refresh, mountAll, switchHtml, form, confirm: confirmDialog, tabs, showTab, readImage };
})();
