// ============================================================
// state.js · Único objeto de estado compartido + utilidades
// Regla de oro: el estado mutable vive AQUÍ y solo aquí.
// ============================================================

export const state = {
  session: null,
  user: null,
  period: currentPeriod(), // mes visible en la app, 'YYYY-MM'
  accounts: [],
  categories: [],
  transactions: [],
  plan: null,              // monthly_plan del period visible
  budgets: [],
  loans: [],
  goals: [],
};

// ---------- utilidades de fecha ----------
export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- utilidades de dinero ----------
const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function fmtCOP(n) {
  return copFmt.format(Number(n) || 0);
}

// ---------- atajos de DOM ----------
export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}
