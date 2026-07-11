// ============================================================
// state.js · Único objeto de estado compartido + utilidades
// + lógica de negocio (regla 10/10/10/70)
// Regla de oro: el estado mutable vive AQUÍ y solo aquí.
// ============================================================

export const state = {
  session: null,
  user: null,
  period: currentPeriod(), // mes visible en la app, 'YYYY-MM'
  accounts: [],
  categories: [],
  transactions: [],        // solo las del period visible
  plan: null,              // monthly_plan del period visible
  cards: [],               // tarjetas de crédito con su deuda calculada (histórica)
  budgets: [],
  loans: [],
  goals: [],
};

// ---------- fechas y periodos ----------
export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"];

export function periodoBonito(p) {
  const [y, m] = p.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function moverPeriodo(p, delta) {
  let [y, m] = p.split("-").map(Number);
  m += delta;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function fmtFecha(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Días hasta la próxima ocurrencia de un día del mes (ej. día de corte/pago).
// 0 = es hoy. Si el día ya pasó este mes, cuenta hasta el mes siguiente.
// Ajusta a meses cortos: si el día no existe (ej. 31 en febrero) usa el último
// día real de ese mes.
export function diasHastaDia(dia, hoy = new Date()) {
  if (!dia) return null;
  const y = hoy.getFullYear();
  const m = hoy.getMonth(); // 0-11
  const d = hoy.getDate();

  const diaReal = (año, mes) => Math.min(dia, new Date(año, mes + 1, 0).getDate());

  let objetivo;
  if (d <= diaReal(y, m)) {
    objetivo = new Date(y, m, diaReal(y, m));
  } else {
    objetivo = new Date(y, m + 1, diaReal(y, m + 1));
  }
  const msPorDia = 86400000;
  const inicioHoy = new Date(y, m, d);
  return Math.round((objetivo - inicioHoy) / msPorDia);
}

// ---------- dinero ----------
const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function fmtCOP(n) {
  return copFmt.format(Number(n) || 0);
}

// Convierte lo que el usuario escriba ("13.000", "13000", "$13.000")
// a un entero de pesos.
export function parseMonto(s) {
  return Number(String(s).replace(/[^\d]/g, "")) || 0;
}

// ---------- catálogos ----------
export function nombreCategoria(id) {
  return state.categories.find((c) => c.id === id)?.name ?? "—";
}

export function nombreCuenta(id) {
  return state.accounts.find((a) => a.id === id)?.name ?? "—";
}

// ---------- lógica de negocio: regla 10/10/10/70 ----------
export function resumenMes() {
  const txs = state.transactions;
  const suma = (arr) => arr.reduce((acc, t) => acc + Number(t.amount), 0);

  const ingresos = suma(txs.filter((t) => t.kind === "ingreso"));
  const gastos = suma(txs.filter((t) => t.kind === "gasto"));

  const base = Number(state.plan?.base_income ?? 0);
  const pctD = Number(state.plan?.pct_diezmo ?? 10);
  const pctP = Number(state.plan?.pct_papas ?? 10);
  const pctA = Number(state.plan?.pct_ahorro ?? 10);
  const pct70 = 100 - pctD - pctP - pctA;

  const gastoDe = (nombreCat) =>
    suma(txs.filter((t) => t.kind === "gasto" && nombreCategoria(t.category_id) === nombreCat));

  const realDiezmo = gastoDe("Diezmo");
  const realPapas  = gastoDe("Honra a papás");
  const realAhorro = gastoDe("Ahorro");

  return {
    ingresos,
    gastos,
    balance: ingresos - gastos,
    base,
    apartados: [
      { nombre: "Diezmo",        pct: pctD, objetivo: Math.round(base * pctD / 100), real: realDiezmo },
      { nombre: "Honra a papás", pct: pctP, objetivo: Math.round(base * pctP / 100), real: realPapas },
      { nombre: "Ahorro",        pct: pctA, objetivo: Math.round(base * pctA / 100), real: realAhorro },
    ],
    gastos70: {
      pct: pct70,
      objetivo: Math.round(base * pct70 / 100),
      real: gastos - realDiezmo - realPapas - realAhorro,
    },
  };
}

// ---------- atajos de DOM ----------
export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

// Escapa texto libre (notas) antes de meterlo al HTML.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}