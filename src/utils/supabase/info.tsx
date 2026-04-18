// Supabase connection config — sourced ONLY from environment variables.
// Local dev:    set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `.env.local` (git-ignored)
// Production:   set the same vars in Cloudflare Pages project settings
//
// DO NOT hardcode fallback values here — secrets must never be committed to source control.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (dev) or your deployment environment (prod).'
  );
}

export const supabaseUrl: string = url;
export const publicAnonKey: string = anonKey;
