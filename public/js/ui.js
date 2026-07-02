// ============================================================
// ui.js · Render de vistas y eventos de interfaz
// El dashboard se re-renderiza completo tras cada cambio de
// datos: la base de datos es la única fuente de verdad.
// ============================================================
import {
  state, $, fmtCOP, esc, parseMonto, todayISO, fmtFecha,
  periodoBonito, moverPeriodo, resumenMes, nombreCategoria, nombreCuenta,
} from "./state.js";
import { cargarMes, crearTransaccion, borrarTransaccion, guardarPlan } from "./data.js";

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

// buenoAlLlenar=true → llegar al 100% es la meta (apartados).
// buenoAlLlenar=false → pasarse del 100% es alerta (gastos).
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

function opcionesCategorias(kind) {
  return state.categories
    .filter((c) => c.kind === kind)
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join("");
}

function opcionesCuentas() {
  return state.accounts
    .filter((a) => a.is_active)
    .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
    .join("");
}

function tarjetaNuevoMovimiento() {
  return `
  <div class="card">
    <h2>Nuevo movimiento</h2>
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
        <button class="del-btn" data-action="tx-del" data-id="${t.id}" type="button" aria-label="Borrar">✕</button>
      </div>`;
    })
    .join("");
  return `<div class="card"><h2>Movimientos</h2>${filas}</div>`;
}

// ---------- eventos (delegación: se enganchan una sola vez) ----------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  try {
    if (btn.dataset.action === "mes-prev" || btn.dataset.action === "mes-next") {
      const delta = btn.dataset.action === "mes-prev" ? -1 : 1;
      state.period = moverPeriodo(state.period, delta);
      await cargarMes();
      renderDashboard();
    }
    if (btn.dataset.action === "tx-del") {
      if (!confirm("¿Borrar este movimiento?")) return;
      await borrarTransaccion(btn.dataset.id);
      renderDashboard();
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

document.addEventListener("submit", async (e) => {
  if (e.target.id === "form-tx") {
    e.preventDefault();
    const monto = parseMonto($("#tx-monto").value);
    if (monto <= 0) { alert("Escribe un monto válido."); return; }
    const tx = {
      date: $("#tx-fecha").value || todayISO(),
      kind: $('input[name="tx-tipo"]:checked').value,
      amount: monto,
      category_id: $("#tx-cat").value,
      account_id: $("#tx-cta").value,
      note: $("#tx-nota").value.trim() || null,
    };
    const btn = $("#tx-guardar");
    btn.disabled = true;
    try {
      await crearTransaccion(tx);
      renderDashboard();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      alert(err.message);
    }
  }

  if (e.target.id === "form-plan") {
    e.preventDefault();
    const base = parseMonto($("#plan-base").value);
    if (base <= 0) { alert("Escribe tu comisión del mes."); return; }
    try {
      await guardarPlan(base);
      renderDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }
});

document.addEventListener("change", (e) => {
  if (e.target.name === "tx-tipo") {
    $("#tx-cat").innerHTML = opcionesCategorias(e.target.value);
  }
});