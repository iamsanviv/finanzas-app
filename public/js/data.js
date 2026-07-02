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

async function cargarCategorias() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(`Cargando categorías: ${error.message}`);
  state.categories = data;
}

async function cargarCuentas() {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Cargando cuentas: ${error.message}`);
  state.accounts = data;
}