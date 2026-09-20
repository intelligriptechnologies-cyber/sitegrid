/* Shared UI kit: searchable + paginated tables, form/confirm dialogs, tabs, switch.
   Pure helpers run in Node; DOM parts are guarded by `typeof document`.

   API reference (Phases 3-5 build on this)
   ----------------------------------------
   Tables   UI.tableHost(cfg) -> host html; UI.refresh(id); UI.mountAll(); UI.unregister(id);
            UI.getFiltered(id) -> { rows, columns }   // rows after search + whatever cfg.rows() already filtered (for export)
            cfg: { id, rows(), columns, rowActions?, onAction?, onRowClick?, emptyText?, searchPlaceholder?,
                   pageSize?, pageSizes?, toolbarHtml?(), toolbarBind?(el),
                   initialQuery?: string,               // search text on first registration only
                   footerHtml?(filteredRows) -> html,   // rendered as a <tfoot> row spanning all columns
                   rowClass?(row) -> string }           // extra class(es) on the <tr>
            column: { label, text(row), html?(row), width?, align?: "right" }
   Helpers  UI.tag(text, kind)  kind: ok | warn | danger | neutral (text is escaped); UI.emptyState(text); UI.esc(s)
            UI.switchHtml, UI.tabs/showTab, UI.readImage, UI.filterRows, UI.paginate, UI.validateField(field, value, values)
   Forms    UI.form({ title, fields, values?, submitLabel?, size?: "wide", onSubmit(vals, close) })
            field: { name, label, type: text|tel|email|number|date|month|select|multicheck|textarea|checkbox,
                     required?, hint?, placeholder?, maxlength?, min?, max?, step?, pattern?, disabled?, hidden?,
                     normalize?(raw) -> string, validate?(v, vals) -> msg|null, options?, value?, full? }
            onSubmit returns: falsy = ok (dialog closes); string = general error line;
                              object { fieldName: message, _form?: message } = field-level errors under the fields.
   Confirm  UI.confirm(message, onYes, { title?, yesLabel?, reason?: { label?, required? } })
            with reason: a textarea is shown and onYes(reasonText) receives its text; empty + required blocks with an inline error.
   Modal    openModal(title, html, { wide? }) / closeModal() live in app.js (Escape closes, focus is managed). */
const UI = (() => {
  const HAS_DOM = typeof document !== "undefined";
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const registry = new Map(); // id -> { cfg, query, page, size, view, mounted }
  const tag = (text, kind) => `<span class="tag ${e(kind || "neutral")}">${e(text)}</span>`;
  const emptyState = (text) => `<div class="ui-empty">${e(text)}</div>`;

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
      cfg, query: prev ? prev.query : String(cfg.initialQuery || ""), page: prev ? prev.page : 1,
      size: prev ? prev.size : (cfg.pageSize || sizes[0]), view: [], mounted: null,
    });
    return `<div class="ui-table" data-id="${e(cfg.id)}"></div>`;
  }

  function unregister(id) { registry.delete(id); }

  /* The table's currently visible dataset (search applied on top of cfg.rows()) and its columns, e.g. for export. */
  function getFiltered(id) {
    const st = registry.get(id);
    if (!st) return { rows: [], columns: [] };
    return { rows: filterRows(st.cfg.rows(), st.cfg.columns, st.query), columns: st.cfg.columns };
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

  function bodyHtml(st, pg, filtered) {
    const cfg = st.cfg;
    const acts = cfg.rowActions || [];
    const cls = (c) => (c.align === "right" ? " class=\"num\"" : "");
    const head = cfg.columns.map((c) => `<th${cls(c)}${c.width ? ` style="width:${e(c.width)}"` : ""}>${e(c.label)}</th>`).join("") +
      (acts.length ? `<th class="row-actions-col"></th>` : "");
    const span = cfg.columns.length + (acts.length ? 1 : 0);
    const rows = pg.rows.map((r, i) => {
      const cells = cfg.columns.map((c) => `<td${cls(c)}>${c.html ? c.html(r) : e(c.text(r))}</td>`).join("");
      const btns = acts.length ? `<td class="row-actions">${acts.filter((a) => !a.show || a.show(r)).map((a) =>
        `<button type="button" class="icon-btn${a.danger ? " danger" : ""}" data-row-act="${e(a.key)}" title="${e(a.label)}" aria-label="${e(a.label)}">${e(a.icon || a.label.slice(0, 1))}</button>`).join("")}</td>` : "";
      const rc = [cfg.onRowClick ? "clickable" : "", cfg.rowClass ? cfg.rowClass(r) || "" : ""].filter(Boolean).join(" ");
      return `<tr data-i="${i}"${rc ? ` class="${e(rc)}"` : ""}>${cells}${btns}</tr>`;
    }).join("");
    return `<div class="ui-table-scroll"><table class="table"><thead><tr>${head}</tr></thead><tbody>${rows ||
      `<tr><td colspan="${span}" class="ui-empty">${e(cfg.emptyText || "No records found")}</td></tr>`}</tbody>${
      cfg.footerHtml ? `<tfoot><tr><td colspan="${span}">${cfg.footerHtml(filtered)}</td></tr></tfoot>` : ""}</table></div>`;
  }

  function renderTable(st, host) {
    const cfg = st.cfg;
    const filtered = filterRows(cfg.rows(), cfg.columns, st.query);
    const pg = paginate(filtered, st.page, st.size);
    st.page = pg.page;
    st.view = pg.rows;
    host.querySelector('[data-part="top"]').innerHTML = pagerHtml(st, pg);
    host.querySelector('[data-part="body"]').innerHTML = bodyHtml(st, pg, filtered);
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
    const hid = f.hidden ? " hidden" : "";
    const dis = f.disabled ? " disabled" : "";
    const v = values[f.name] !== undefined ? values[f.name] : (f.value !== undefined ? f.value : "");
    const req = f.required ? " *" : "";
    const nm = `name="${e(f.name)}"${dis}`;
    const tail = `${f.hint ? `<div class="field-hint">${e(f.hint)}</div>` : ""}<div class="field-error" data-err="${e(f.name)}"></div>`;
    let ctl;
    if (f.type === "select") {
      ctl = `<select ${nm}><option value="">Select...</option>${(f.options || []).map((o) =>
        `<option value="${e(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${e(o.label)}</option>`).join("")}</select>`;
    } else if (f.type === "multicheck") {
      const sel = (Array.isArray(v) ? v : []).map(String);
      ctl = `<div class="multicheck">${(f.options || []).map((o) =>
        `<label class="multicheck-item"><input type="checkbox" name="${e(f.name)}"${dis} value="${e(o.value)}" ${sel.includes(String(o.value)) ? "checked" : ""}><span>${e(o.label)}</span></label>`).join("")}</div>`;
    } else if (f.type === "textarea") {
      ctl = `<textarea ${nm} rows="3" placeholder="${e(f.placeholder || "")}">${e(v)}</textarea>`;
    } else if (f.type === "checkbox") {
      return `<div class="field${f.full ? " full" : ""}" data-field="${e(f.name)}"${hid}><label class="multicheck-item"><input type="checkbox" ${nm} ${v ? "checked" : ""}><span>${e(f.label)}</span></label>${tail}</div>`;
    } else {
      const type = ["text", "tel", "email", "number", "date", "month"].includes(f.type) ? f.type : "text";
      ctl = `<input type="${type}" ${nm} value="${e(v)}" placeholder="${e(f.placeholder || "")}"${f.maxlength ? ` maxlength="${Number(f.maxlength)}"` : ""}${["min", "max", "step"].map((k) => (f[k] != null && f.type === "number" ? ` ${k}="${e(f[k])}"` : "")).join("")}${f.pattern ? ` pattern="${e(f.pattern)}"` : ""}>`;
    }
    return `<div class="field${f.full || f.type === "multicheck" || f.type === "textarea" ? " full" : ""}" data-field="${e(f.name)}"${hid}><label>${e(f.label)}${req}</label>${ctl}${tail}</div>`;
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
      else {
        const raw = els[0] ? (f.type === "textarea" ? els[0].value : els[0].value.trim()) : "";
        out[f.name] = f.normalize && raw !== "" ? f.normalize(raw) : raw;
      }
    }
    return out;
  }

  /* Pure per-field validation: required, min/max (numbers), pattern, then custom validate. Returns a message or null. */
  function validateField(f, v, vals) {
    const empty = v === "" || v == null || v === false || (Array.isArray(v) && !v.length);
    if (f.required && empty) return `${f.label} is required`;
    if (empty) return null;
    if (f.type === "number" && typeof v === "number") {
      if (f.min != null && v < Number(f.min)) return `${f.label} must be at least ${f.min}`;
      if (f.max != null && v > Number(f.max)) return `${f.label} must be at most ${f.max}`;
    }
    if (f.pattern && typeof v === "string") {
      let re = null;
      try { re = new RegExp("^(?:" + f.pattern + ")$"); } catch (err) { re = null; }
      if (re && !re.test(v)) return `${f.label} is not in the expected format`;
    }
    return f.validate ? f.validate(v, vals || {}) || null : null;
  }

  function form(opts) {
    const fields = opts.fields || [];
    const values = opts.values || {};
    const html = `<form class="ui-form" novalidate><div class="form-grid">${fields.map((f) => fieldHtml(f, values)).join("")}</div>
      <div class="field-error ui-form-error" data-err="_form"></div>
      <div class="form-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn teal">${e(opts.submitLabel || "Save")}</button></div></form>`;
    openModal(e(opts.title || ""), html, { wide: opts.size === "wide" });
    const fm = document.querySelector("#modalOverlay .ui-form");
    const setErr = (name, msg) => { const el = fm.querySelector(`[data-err="${name}"]`); if (el) el.textContent = msg || ""; };
    const focusFirstError = () => {
      const first = fm.querySelector(".field .field-error:not(:empty)");
      const c = first && first.parentElement.querySelector("input,select,textarea");
      if (c) c.focus();
    };
    fm.querySelector("[data-cancel]").addEventListener("click", () => closeModal());
    for (const f of fields) {
      if (!f.normalize) continue;
      const el = [...fm.elements].find((x) => x.name === f.name);
      if (el) el.addEventListener("blur", () => { if (el.value.trim() !== "") el.value = f.normalize(el.value.trim()); });
    }
    fm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const vals = readValues(fm, fields);
      let bad = false;
      setErr("_form", "");
      for (const f of fields) {
        const wrap = fm.querySelector(`[data-field="${f.name}"]`);
        const skip = f.disabled || (wrap && wrap.hidden);
        const msg = skip ? null : validateField(f, vals[f.name], vals);
        setErr(f.name, msg);
        if (msg) bad = true;
      }
      if (bad) { focusFirstError(); return; }
      const res = opts.onSubmit ? opts.onSubmit(vals, closeModal) : null;
      if (res && typeof res === "object") {
        let any = false;
        for (const [k, m] of Object.entries(res)) { if (m) { setErr(k, m); any = true; } }
        if (any) { focusFirstError(); return; }
        closeModal();
      } else if (res) setErr("_form", res);
      else closeModal();
    });
    const firstCtl = fm.querySelector(".field:not([hidden]) input:not([type=checkbox]):not([disabled]),.field:not([hidden]) select:not([disabled]),.field:not([hidden]) textarea:not([disabled])");
    if (firstCtl) firstCtl.focus();
  }

  /* o.reason = { label?, required? } adds a textarea; onYes receives its text. */
  function confirmDialog(message, onYes, o = {}) {
    const rs = o.reason ? `<div class="field ui-confirm-reason"><label>${e(o.reason.label || "Reason")}${o.reason.required ? " *" : ""}</label><textarea rows="3" data-reason></textarea><div class="field-error" data-reason-err></div></div>` : "";
    openModal(e(o.title || "Confirm"), `<p class="ui-confirm-msg">${e(message)}</p>${rs}
      <div class="form-actions"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn danger" data-yes>${e(o.yesLabel || "Confirm")}</button></div>`);
    const box = document.querySelector("#modalOverlay .modal-body");
    box.querySelector("[data-no]").addEventListener("click", () => closeModal());
    box.querySelector("[data-yes]").addEventListener("click", () => {
      let text;
      if (o.reason) {
        const ta = box.querySelector("[data-reason]");
        text = ta.value.trim();
        if (o.reason.required && !text) { box.querySelector("[data-reason-err]").textContent = `${o.reason.label || "Reason"} is required`; ta.focus(); return; }
      }
      closeModal();
      if (onYes) onYes(text);
    });
    (box.querySelector("[data-reason]") || box.querySelector("[data-no]")).focus();
  }

  /* Fit (w, h) inside a maxDim x maxDim box keeping aspect ratio; never upscales. */
  function fitDimensions(w, h, maxDim) {
    if (!maxDim || (w <= maxDim && h <= maxDim)) return { width: w, height: h };
    const k = maxDim / Math.max(w, h);
    return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
  }

  /* opts.maxDim: downscale via canvas and re-encode as JPEG (quality 0.8). The maxBytes check applies to the input file. */
  function readImage(file, maxBytes = 1048576, opts = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || "")) return reject(new Error("Choose an image file"));
      if (file.size > maxBytes) return reject(new Error("Image must be under 1 MB"));
      const r = new FileReader();
      r.onerror = () => reject(new Error("Could not read the image"));
      r.onload = () => {
        if (!opts.maxDim) return resolve(r.result);
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read the image"));
        img.onload = () => {
          const { width, height } = fitDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, opts.maxDim);
          const c = document.createElement("canvas");
          c.width = width; c.height = height;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  return { filterRows, paginate, tableHost, refresh, mountAll, unregister, getFiltered, switchHtml, form, confirm: confirmDialog,
           tabs, showTab, readImage, fitDimensions, tag, emptyState, esc: e, validateField };
})();
