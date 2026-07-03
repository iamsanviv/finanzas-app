// ============================================================
// ui.js · Render de vistas, modales y eventos de interfaz
// El dashboard se re-renderiza completo tras cada cambio de
// datos: la base de datos es la única fuente de verdad.
// Los modales viven en #modal-root (fuera de #app-main) para
// que un re-render del dashboard no los borre.
// ============================================================
import {
  state, $, fmtCOP, esc, parseMonto, todayISO, fmtFecha,
  periodoBonito, moverPeriodo, resumenMes, nombreCategoria, nombreCuenta,
} from "./state.js";
import {
  cargarMes, crearTransaccion, borrarTransaccion, actualizarTransaccion,
  guardarPlan, crearCategoria, renombrarCategoria, borrarCategoria,
} from "./data.js";

// ---------- vistas base ----------
export function showLogin() {
  $("#view-login").hidden = false;
  $("#view-app").hidden = true;
}

export function showApp() {
  $("#view-login").hidden = true;
  $("#view-app").hidden = false;
  $("#user-email").textContent = state.user?.email ?? "";
}

export function setAuthError(msg) {
  const el = $("#login-error");
  el.textContent = msg;
  el.hidden = !msg;
}

export function mostrarErrorApp(msg) {
  $("#app-main").innerHTML = `<p class="error">${esc(msg)}</p>`;
}

// ---------- modal ----------
function modalRoot() {
  let el = document.getElementById("modal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    document.body.appendChild(el);
  }
  return el;
}

function abrirModal(html) {
  modalRoot().innerHTML = `
  <div class="modal-overlay" data-action="modal-bg">
    <div class="modal">
      <button class="modal-x" data-action="modal-close" type="button" aria-label="Cerrar">✕</button>
      ${html}
    </div>
  </div>`;
}

function cerrarModal() {
  modalRoot().innerHTML = "";
}

// ---------- dashboard ----------
export function renderDashboard() {
  const r = resumenMes();
  $("#app-main").innerHTML = [
    navMes(),
    tarjetaPlan(r),
    tarjetaKpis(r),
    tarjetaRegla(r),
    tarjetaNuevoMovimiento(),
    tarjetaMovimientos(),
  ].join("");
}

function navMes() {
  return `
  <div class="navmes">
    <button class="btn btn-ghost" data-action="mes-prev" type="button">‹</button>
    <span class="navmes-titulo">${periodoBonito(state.period)}</span>
    <button class="btn btn-ghost" data-action="mes-next" type="button">›</button>
  </div>`;
}

function tarjetaPlan(r) {
  const valor = r.base > 0 ? String(r.base) : "";
  const hint = r.base > 0
    ? `Disponible para gastos (${r.gastos70.pct}%): <b>${fmtCOP(r.gastos70.objetivo)}</b>`
    : `Define tu comisión del mes para activar la regla 10/10/10/70.`;
  return `
  <div class="card">
    <h2>Plan del mes</h2>
    <form id="form-plan" class="plan-form">
      <label class="field plan-input">
        <span class="field-label">Comisión base (COP)</span>
        <input id="plan-base" inputmode="numeric" placeholder="2.442.000" value="${valor}">
      </label>
      <button class="btn btn-primary btn-plan" type="submit">Guardar</button>
    </form>
    <p class="hint">${hint}</p>
  </div>`;
}

function tarjetaKpis(r) {
  return `
  <div class="kpis kpis-3">
    <div class="kpi"><div class="kpi-label">Ingresos</div><div class="kpi-value ok-text">${fmtCOP(r.ingresos)}</div></div>
    <div class="kpi"><div class="kpi-label">Gastos</div><div class="kpi-value bad-text">${fmtCOP(r.gastos)}</div></div>
    <div class="kpi"><div class="kpi-label">Balance</div><div class="kpi-value">${fmtCOP(r.balance)}</div></div>
  </div>`;
}

function tarjetaRegla(r) {
  const filas = r.apartados
    .map((a) => filaRegla(`${a.nombre} (${a.pct}%)`, a.real, a.objetivo, true))
    .join("");
  const fila70 = filaRegla(`Gastos (${r.gastos70.pct}%)`, r.gastos70.real, r.gastos70.objetivo, false);
  return `
  <div class="card">
    <h2>Regla 10/10/10/70</h2>
    ${filas}
    ${fila70}
  </div>`;
}

function filaRegla(titulo, real, objetivo, buenoAlLlenar) {
  const pctUso = objetivo > 0 ? (real / objetivo) * 100 : 0;
  const ancho = Math.min(pctUso, 100);
  let clase = "fill-gold";
  if (buenoAlLlenar && pctUso >= 100) clase = "fill-ok";
  if (!buenoAlLlenar) clase = pctUso > 100 ? "fill-bad" : "fill-ok";
  const detalle = objetivo > 0
    ? `${fmtCOP(real)} de ${fmtCOP(objetivo)} · ${Math.round(pctUso)}%`
    : `${fmtCOP(real)} (sin objetivo: define la comisión)`;
  return `
  <div class="regla-fila">
    <div class="regla-top"><span>${titulo}</span><span class="regla-detalle">${detalle}</span></div>
    <div class="bar"><div class="bar-fill ${clase}" style="width:${ancho}%"></div></div>
  </div>`;
}

function opcionesCategorias(kind, selectedId = "") {
  return state.categories
    .filter((c) => c.kind === kind)
    .map((c) => `<option value="${c.id}"${c.id === selectedId ? " selected" : ""}>${esc(c.name)}</option>`)
    .join("");
}

function opcionesCuentas(selectedId = "") {
  return state.accounts
    .filter((a) => a.is_active)
    .map((a) => `<option value="${a.id}"${a.id === selectedId ? " selected" : ""}>${esc(a.name)}</option>`)
    .join("");
}

function tarjetaNuevoMovimiento() {
  return `
  <div class="card">
    <div class="card-head">
      <h2>Nuevo movimiento</h2>
      <button class="btn btn-ghost btn-mini" data-action="cats-open" type="button">Categorías</button>
    </div>
    <form id="form-tx">
      <div class="seg">
        <label class="seg-opt"><input type="radio" name="tx-tipo" value="gasto" checked><span>Gasto</span></label>
        <label class="seg-opt"><input type="radio" name="tx-tipo" value="ingreso"><span>Ingreso</span></label>
      </div>
      <label class="field">
        <span class="field-label">Monto (COP)</span>
        <input id="tx-monto" inputmode="numeric" placeholder="13.000" required>
      </label>
      <div class="grid2">
        <label class="field"><span class="field-label">Categoría</span>
          <select id="tx-cat">${opcionesCategorias("gasto")}</select></label>
        <label class="field"><span class="field-label">Cuenta</span>
          <select id="tx-cta">${opcionesCuentas()}</select></label>
      </div>
      <div class="grid2">
        <label class="field"><span class="field-label">Fecha</span>
          <input id="tx-fecha" type="date" value="${todayISO()}"></label>
        <label class="field"><span class="field-label">Nota</span>
          <input id="tx-nota" placeholder="opcional" maxlength="120"></label>
      </div>
      <button id="tx-guardar" class="btn btn-primary" type="submit">Guardar movimiento</button>
    </form>
  </div>`;
}

function tarjetaMovimientos() {
  if (state.transactions.length === 0) {
    return `<div class="card"><h2>Movimientos</h2><p class="hint">Todavía no hay movimientos en ${periodoBonito(state.period)}.</p></div>`;
  }
  const filas = state.transactions
    .map((t) => {
      const signo = t.kind === "ingreso" ? "+" : "−";
      const claseMonto = t.kind === "ingreso" ? "ok-text" : "bad-text";
      const nota = t.note ? `<span class="tx-nota">${esc(t.note)}</span>` : "";
      return `
      <div class="tx-row">
        <div class="tx-info">
          <span class="tx-cat">${esc(nombreCategoria(t.category_id))}</span>
          <span class="tx-meta">${fmtFecha(t.date)} · ${esc(nombreCuenta(t.account_id))}</span>
          ${nota}
        </div>
        <span class="tx-monto ${claseMonto}">${signo}${fmtCOP(t.amount)}</span>
        <button class="icon-btn" data-action="tx-edit" data-id="${t.id}" type="button" aria-label="Editar">✎</button>
        <button class="icon-btn" data-action="tx-del" data-id="${t.id}" type="button" aria-label="Borrar">✕</button>
      </div>`;
    })
    .join("");
  return `<div class="card"><h2>Movimientos</h2>${filas}</div>`;
}

// ---------- modal: editar movimiento ----------
function abrirEditarTx(id) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return;
  abrirModal(`
    <h2>Editar movimiento</h2>
    <form id="form-etx" data-id="${t.id}">
      <div class="seg">
        <label class="seg-opt"><input type="radio" name="etx-tipo" value="gasto" ${t.kind === "gasto" ? "checked" : ""}><span>Gasto</span></label>
        <label class="seg-opt"><input type="radio" name="etx-tipo" value="ingreso" ${t.kind === "ingreso" ? "checked" : ""}><span>Ingreso</span></label>
      </div>
      <label class="field"><span class="field-label">Monto (COP)</span>
        <input id="etx-monto" inputmode="numeric" value="${t.amount}" required></label>
      <div class="grid2">
        <label class="field"><span class="field-label">Categoría</span>
          <select id="etx-cat">${opcionesCategorias(t.kind, t.category_id)}</select></label>
        <label class="field"><span class="field-label">Cuenta</span>
          <select id="etx-cta">${opcionesCuentas(t.account_id)}</select></label>
      </div>
      <div class="grid2">
        <label class="field"><span class="field-label">Fecha</span>
          <input id="etx-fecha" type="date" value="${t.date}"></label>
        <label class="field"><span class="field-label">Nota</span>
          <input id="etx-nota" value="${esc(t.note ?? "")}" maxlength="120"></label>
      </div>
      <button class="btn btn-primary" type="submit">Guardar cambios</button>
    </form>`);
}

// ---------- modal: gestionar categorías ----------
function abrirCategorias() {
  const bloque = (kind, titulo) => {
    const filas = state.categories
      .filter((c) => c.kind === kind)
      .map((c) => `
        <div class="cat-row">
          <input class="cat-name" data-id="${c.id}" value="${esc(c.name)}" maxlength="40">
          <button class="btn btn-ghost btn-mini" data-action="cat-rename" data-id="${c.id}" type="button">Guardar</button>
          <button class="icon-btn" data-action="cat-del" data-id="${c.id}" data-name="${esc(c.name)}" type="button" aria-label="Borrar">✕</button>
        </div>`)
      .join("");
    return `
      <h3 class="cat-sub">${titulo}</h3>
      ${filas}
      <form class="cat-add" data-kind="${kind}">
        <input class="cat-new" placeholder="Nueva categoría de ${kind}" maxlength="40">
        <button class="btn btn-primary btn-mini" type="submit">Agregar</button>
      </form>`;
  };
  abrirModal(`
    <h2>Categorías</h2>
    <p class="hint">Borrar una categoría no borra tus movimientos: quedan sin categoría.</p>
    ${bloque("gasto", "Gastos")}
    ${bloque("ingreso", "Ingresos")}`);
}

// ---------- eventos (delegación única) ----------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const act = btn.dataset.action;

  try {
    if (act === "mes-prev" || act === "mes-next") {
      state.period = moverPeriodo(state.period, act === "mes-prev" ? -1 : 1);
      await cargarMes();
      renderDashboard();
    } else if (act === "tx-del") {
      if (!confirm("¿Borrar este movimiento?")) return;
      await borrarTransaccion(btn.dataset.id);
      renderDashboard();
    } else if (act === "tx-edit") {
      abrirEditarTx(btn.dataset.id);
    } else if (act === "cats-open") {
      abrirCategorias();
    } else if (act === "cat-rename") {
      const input = document.querySelector(`.cat-name[data-id="${btn.dataset.id}"]`);
      const nombre = input.value.trim();
      if (!nombre) { alert("El nombre no puede quedar vacío."); return; }
      await renombrarCategoria(btn.dataset.id, nombre);
      abrirCategorias();
      renderDashboard();
    } else if (act === "cat-del") {
      if (!confirm(`¿Borrar la categoría "${btn.dataset.name}"?`)) return;
      await borrarCategoria(btn.dataset.id);
      abrirCategorias();
      renderDashboard();
    } else if (act === "modal-close") {
      cerrarModal();
    } else if (act === "modal-bg") {
      // Solo cerrar si el clic fue en el fondo oscuro, no en un hijo
      // que "burbujeó" hasta el overlay.
      if (e.target === btn) cerrarModal();
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    if (e.target.id === "form-tx") {
      const monto = parseMonto($("#tx-monto").value);
      if (monto <= 0) { alert("Escribe un monto válido."); return; }
      const btn = $("#tx-guardar");
      btn.disabled = true;
      await crearTransaccion({
        date: $("#tx-fecha").value || todayISO(),
        kind: $('input[name="tx-tipo"]:checked').value,
        amount: monto,
        category_id: $("#tx-cat").value,
        account_id: $("#tx-cta").value,
        note: $("#tx-nota").value.trim() || null,
      });
      renderDashboard();
    } else if (e.target.id === "form-etx") {
      const id = e.target.dataset.id;
      const monto = parseMonto($("#etx-monto").value);
      if (monto <= 0) { alert("Escribe un monto válido."); return; }
      await actualizarTransaccion(id, {
        date: $("#etx-fecha").value,
        kind: $('input[name="etx-tipo"]:checked').value,
        amount: monto,
        category_id: $("#etx-cat").value,
        account_id: $("#etx-cta").value,
        note: $("#etx-nota").value.trim() || null,
      });
      cerrarModal();
      renderDashboard();
    } else if (e.target.id === "form-plan") {
      const base = parseMonto($("#plan-base").value);
      if (base <= 0) { alert("Escribe tu comisión del mes."); return; }
      await guardarPlan(base);
      renderDashboard();
    } else if (e.target.classList.contains("cat-add")) {
      const kind = e.target.dataset.kind;
      const nombre = e.target.querySelector(".cat-new").value.trim();
      if (!nombre) { alert("Escribe un nombre."); return; }
      await crearCategoria(nombre, kind);
      abrirCategorias();
      renderDashboard();
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
    const b = e.target.querySelector('button[type="submit"]');
    if (b) b.disabled = false;
  }
});

document.addEventListener("change", (e) => {
  if (e.target.name === "tx-tipo") {
    $("#tx-cat").innerHTML = opcionesCategorias(e.target.value);
  }
  if (e.target.name === "etx-tipo") {
    $("#etx-cat").innerHTML = opcionesCategorias(e.target.value);
  }
});
