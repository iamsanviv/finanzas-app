// ============================================================
// data.js · Consultas y escrituras a Supabase (sin renderizar)
// Incluye la siembra inicial: en tu primer login crea tus
// categorías y cuentas base. Es idempotente: si ya existen,
// no toca nada.
// ============================================================
import { supabase } from "./supabase.js";
import { state } from "./state.js";

// ---------- datos base (migrados de tu Excel) ----------
const CATEGORIAS_BASE = [
  // ingresos
  { name: "Comisión",            kind: "ingreso" },
  { name: "Trabajo extra",       kind: "ingreso" },
  { name: "Devolución préstamo", kind: "ingreso" },
  { name: "Otro ingreso",        kind: "ingreso" },
  // gastos
  { name: "Diezmo",              kind: "gasto" },
  { name: "Honra a papás",       kind: "gasto" },
  { name: "Ahorro",              kind: "gasto" },
  { name: "Arriendo",            kind: "gasto" },
  { name: "Almuerzo",            kind: "gasto" },
  { name: "Desayuno",            kind: "gasto" },
  { name: "Mercado",             kind: "gasto" },
  { name: "Aseo y hogar",        kind: "gasto" },
  { name: "Gasolina",            kind: "gasto" },
  { name: "Gimnasio",            kind: "gasto" },
  { name: "Plan celular",        kind: "gasto" },
  { name: "Suscripciones",       kind: "gasto" },
  { name: "Salidas",             kind: "gasto" },
  { name: "Tarjeta de crédito",  kind: "gasto" },
  { name: "Regalos",             kind: "gasto" },
  { name: "Grado",               kind: "gasto" },
  { name: "Campamento",          kind: "gasto" },
  { name: "Moto",                kind: "gasto" },
  { name: "Otro gasto",          kind: "gasto" },
];

const CUENTAS_BASE = [
  { name: "Efectivo",     type: "efectivo" },
  { name: "Bancolombia",  type: "banco" },
  { name: "Nu",           type: "banco" },
  { name: "Nequi",        type: "billetera" },
  { name: "DaviPlata",    type: "billetera" },
  { name: "Rappi",        type: "billetera" },
  { name: "DolarApp",     type: "billetera" },
  { name: "Binance",      type: "billetera" },
  { name: "TC Rappi",     type: "credito", credit_limit: 1400000, cut_day: 26, due_day: 10 },
];

// ---------- carga inicial (se llama tras cada login) ----------
export async function cargarDatosIniciales() {
  await sembrarSiHaceFalta();
  await Promise.all([cargarCategorias(), cargarCuentas()]);
  await cargarMes();
}

// ---------- datos del mes visible (state.period) ----------
export async function cargarMes() {
  await Promise.all([cargarTransacciones(), cargarPlan(), cargarTarjetas()]);
}

// ---------- tarjetas de crédito (deuda HISTÓRICA, no solo el mes) ----------
// La deuda de una TC es toda su historia:
//   deuda = Σ gastos con esa cuenta − Σ pago_tc − Σ ingresos con esa cuenta
// (un ingreso en la TC = reembolso/cashback → resta deuda).
async function cargarTarjetas() {
  const tarjetas = state.accounts.filter((a) => a.type === "credito");
  if (tarjetas.length === 0) {
    state.cards = [];
    return;
  }

  const ids = tarjetas.map((a) => a.id);
  const { data, error } = await supabase
    .from("transactions")
    .select("amount,kind,account_id")
    .in("account_id", ids);
  if (error) throw new Error(`Cargando tarjetas: ${error.message}`);

  state.cards = tarjetas.map((cuenta) => {
    const movs = data.filter((t) => t.account_id === cuenta.id);
    const suma = (kind) =>
      movs.filter((t) => t.kind === kind).reduce((acc, t) => acc + Number(t.amount), 0);

    const deuda = suma("gasto") - suma("pago_tc") - suma("ingreso");
    const cupo = Number(cuenta.credit_limit ?? 0);
    const utilizacion = cupo > 0 ? (deuda / cupo) * 100 : 0;

    return { cuenta, deuda, cupo, utilizacion };
  });
}

function rangoDelPeriodo(period) {
  const [y, m] = period.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  return {
    desde: `${period}-01`,
    hasta: `${period}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

async function cargarTransacciones() {
  const { desde, hasta } = rangoDelPeriodo(state.period);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", desde)
    .lte("date", hasta)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Cargando transacciones: ${error.message}`);
  state.transactions = data;
}

async function cargarPlan() {
  const { data, error } = await supabase
    .from("monthly_plans")
    .select("*")
    .eq("period", state.period)
    .maybeSingle();
  if (error) throw new Error(`Cargando plan: ${error.message}`);
  state.plan = data;
}

export async function guardarPlan(baseIncome) {
  const fila = { user_id: state.user.id, period: state.period, base_income: baseIncome };
  const { error } = await supabase
    .from("monthly_plans")
    .upsert(fila, { onConflict: "user_id,period" });
  if (error) throw new Error(`Guardando plan: ${error.message}`);
  await cargarPlan();
}

export async function crearTransaccion(tx) {
  const fila = { ...tx, user_id: state.user.id };
  const { error } = await supabase.from("transactions").insert(fila);
  if (error) throw new Error(`Guardando movimiento: ${error.message}`);
  await cargarMes();
}

export async function borrarTransaccion(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(`Borrando movimiento: ${error.message}`);
  await cargarMes();
}

export async function actualizarTransaccion(id, cambios) {
  const { error } = await supabase.from("transactions").update(cambios).eq("id", id);
  if (error) throw new Error(`Editando movimiento: ${error.message}`);
  await cargarMes();
}

// ---------- categorías (CRUD) ----------
export async function crearCategoria(name, kind) {
  const sort = state.categories.length;
  const fila = { user_id: state.user.id, name, kind, sort };
  const { error } = await supabase.from("categories").insert(fila);
  if (error) {
    if (/duplicate key/i.test(error.message))
      throw new Error(`Ya tienes una categoría "${name}" de ${kind}.`);
    throw new Error(`Creando categoría: ${error.message}`);
  }
  await cargarCategorias();
}

export async function renombrarCategoria(id, name) {
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) {
    if (/duplicate key/i.test(error.message))
      throw new Error(`Ya existe otra categoría con ese nombre.`);
    throw new Error(`Renombrando categoría: ${error.message}`);
  }
  await cargarCategorias();
}

export async function borrarCategoria(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(`Borrando categoría: ${error.message}`);
  await Promise.all([cargarCategorias(), cargarMes()]);
}

async function cargarCategorias() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort", { ascending: true });
  if (error) throw new Error(`Cargando categorías: ${error.message}`);
  state.categories = data;
}

async function sembrarSiHaceFalta() {
  const uid = state.user.id;

  const nCat = await contar("categories");
  if (nCat === 0) {
    const filas = CATEGORIAS_BASE.map((c, i) => ({ ...c, sort: i, user_id: uid }));
    await insertar("categories", filas);
  }

  const nCta = await contar("accounts");
  if (nCta === 0) {
    const filas = CUENTAS_BASE.map((a) => ({ ...a, user_id: uid }));
    await insertar("accounts", filas);
  }
}

async function contar(tabla) {
  const { count, error } = await supabase
    .from(tabla)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`Contando ${tabla}: ${error.message}`);
  return count ?? 0;
}

async function insertar(tabla, filas) {
  const { error } = await supabase.from(tabla).insert(filas);
  if (error) throw new Error(`Sembrando ${tabla}: ${error.message}`);
}

async function cargarCuentas() {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Cargando cuentas: ${error.message}`);
  state.accounts = data;
}
