// ============================================================
// auth.js · Sesión con Supabase Auth (un solo usuario: tú)
// El registro público queda deshabilitado desde el panel de
// Supabase; el usuario se crea manualmente una sola vez.
// ============================================================
import { supabase } from "./supabase.js";
import { state, $ } from "./state.js";
import { showLogin, showApp, setAuthError, renderDashboard, mostrarErrorApp } from "./ui.js";
import { cargarDatosIniciales } from "./data.js";

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  applySession(session);

  supabase.auth.onAuthStateChange((event, newSession) => {
    // El refresco de token (cada ~1h) no debe re-renderizar:
    // solo actualizamos la sesión en el estado.
    if (event === "TOKEN_REFRESHED") {
      state.session = newSession;
      return;
    }
    applySession(newSession);
  });

  $("#login-form").addEventListener("submit", onLoginSubmit);
  $("#btn-logout").addEventListener("click", logout);
}

function applySession(session) {
  state.session = session;
  state.user = session?.user ?? null;
  if (state.user) {
    showApp();
    cargarDatosIniciales()
      .then(renderDashboard)
      .catch((err) => {
        console.error(err);
        mostrarErrorApp("No pude cargar tus datos: " + err.message);
      });
  } else {
    showLogin();
  }
}

async function onLoginSubmit(e) {
  e.preventDefault();
  setAuthError("");

  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  if (!email || !password) {
    setAuthError("Escribe tu correo y tu contraseña.");
    return;
  }

  const btn = $("#login-submit");
  btn.disabled = true;
  btn.textContent = "Entrando…";

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "Entrar";

  if (error) {
    setAuthError(traducirError(error.message));
    return;
  }

  // Aplicamos la sesión directamente con la respuesta del login.
  // No dependemos del evento onAuthStateChange para cambiar de vista.
  applySession(data.session);
}

async function logout() {
  await supabase.auth.signOut();
}

function traducirError(msg) {
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "El correo no está confirmado. En Supabase crea el usuario con 'Auto Confirm'.";
  if (/failed to fetch/i.test(msg)) return "Sin conexión con Supabase. Revisa la URL en config.js y tu internet.";
  return "No se pudo iniciar sesión: " + msg;
}