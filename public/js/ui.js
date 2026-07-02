// ============================================================
// ui.js · Render de vistas y modales
// En este paso: alternar login <-> app y mostrar errores.
// ============================================================
import { state, $ } from "./state.js";

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
  $("#app-main").innerHTML = `<p class="error">${msg}</p>`;
}

export function renderResumen() {
  const cuentas = state.accounts
    .map(
      (a) => `
    <div class="row">
      <span>${a.name}</span>
      <span class="chip">${a.type}</span>
    </div>`
    )
    .join("");

  $("#app-main").innerHTML = `
    <div class="kpis">
      <div class="kpi">
        <div class="kpi-label">Categorías</div>
        <div class="kpi-value">${state.categories.length}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Cuentas</div>
        <div class="kpi-value">${state.accounts.length}</div>
      </div>
    </div>
    <div class="cards">
      <div class="card">
        <h2>Tus cuentas</h2>
        ${cuentas}
      </div>
    </div>`;
}