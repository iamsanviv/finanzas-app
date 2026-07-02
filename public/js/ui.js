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
