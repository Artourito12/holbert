import { createClient } from "@supabase/supabase-js";
import { PLATFORM_NAME } from "@holbert/core";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    `[${PLATFORM_NAME}] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante — ajoutez-les dans .env.local à la racine du repo`
  );
}

export const supabase = createClient(url, anonKey);
