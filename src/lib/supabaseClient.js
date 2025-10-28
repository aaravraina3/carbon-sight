import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = globalThis.__CS_SUPABASE__ ??
    (globalThis.__CS_SUPABASE__ = createClient(url, anon, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "cs-auth" },
    }));
