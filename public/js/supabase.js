// ============================================================
// supabase.js · Cliente único de Supabase (import por esm.sh)
// Todos los módulos importan ESTE cliente, nunca crean otro.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
