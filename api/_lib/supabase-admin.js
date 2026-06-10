import { createClient } from '@supabase/supabase-js';

// Client Supabase utilise dans les serverless functions.
// Utilise le token JWT de l'utilisateur => respecte les policies RLS.
// On NE met PAS la service_role key cote serveur pour eviter les bypass accidentels.
export function userSupabase(authHeader) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars missing');
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
