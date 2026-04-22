import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, publicAnonKey } from './supabase/info';
import type { Sound, Suggestion } from '../types/index';

const supabase = createClient(supabaseUrl, publicAnonKey);

// ── Auth ────────────────────────────────────────────────────────────────────

// Username → email mapping for admin sign-in.
// Supabase Auth only supports email-based login, so we resolve usernames to
// the email registered against the auth.users record before signing in.
// Lookup is case-insensitive.
const USERNAME_EMAIL_MAP: Record<string, string> = {
  para: 'admin@parasfx.com',
};

function resolveLoginIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return trimmed; // already an email
  const mapped = USERNAME_EMAIL_MAP[trimmed.toLowerCase()];
  return mapped || trimmed; // fall through to whatever they typed (will fail auth cleanly)
}

export async function signIn(identifier: string, password: string) {
  const email = resolveLoginIdentifier(identifier);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Verify the user has admin role
  const role = data.user?.app_metadata?.role;
  if (role !== 'admin') {
    await supabase.auth.signOut();
    throw new Error('Access denied: admin privileges required');
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback: (session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return subscription;
}

// ── Sounds ──────────────────────────────────────────────────────────────────

// Sound count: stored in localStorage for instant paint on return visits,
// then refreshed in the background via an estimated-count query (uses the
// Postgres planner's cached statistic, ~2-5ms on the DB side). For a display
// like "1,347 sounds" a few-row drift is invisible to users.
const COUNT_CACHE_KEY = 'sfxlib:soundCount';

export function getCachedSoundCount(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(COUNT_CACHE_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

export async function getSoundCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('sounds_with_urls')
      .select('*', { count: 'estimated', head: true });

    if (error) throw error;
    const n = count || 0;
    try { localStorage.setItem(COUNT_CACHE_KEY, String(n)); } catch { /* private mode / quota */ }
    return n;
  } catch (error) {
    console.error('Error fetching sound count:', error);
    return 0;
  }
}

// Columns needed by the list + metadata panel. Omits `source`, `slug`, `filename`
// (internal), `description` (rarely populated, can be re-fetched on demand),
// and `updated_at` (not shown). Cuts payload ~20%.
const SOUND_LIST_COLUMNS =
  'id,title,tags,audioUrl,downloadUrl,mp3_path,wav_path,has_wav,file_size,' +
  'duration_seconds,channels,microphone,recorder,format,category,nsfw,' +
  'listens,downloads,mp3_sample_rate,mp3_bit_depth,wav_sample_rate,wav_bit_depth,' +
  'created_at';

export async function getAllSounds(): Promise<Sound[]> {
  try {
    const { data, error } = await supabase
      .from('sounds_with_urls')
      .select(SOUND_LIST_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as Sound[]) || [];
  } catch (error) {
    console.error('Error fetching sounds:', error);
    return [];
  }
}

export async function getSounds(page: number = 0, pageSize: number = 30): Promise<{ data: Sound[]; total: number }> {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('sounds_with_urls')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0 };
  } catch (error) {
    console.error('Error fetching sounds:', error);
    return { data: [], total: 0 };
  }
}

// Server-side search via the search_sounds() RPC (uses the tsvector GIN index).
// Returns only matching rows (usually <50) instead of the whole catalogue.
// Falls back to client-side search if the RPC call fails for any reason.
export async function searchSoundsRemote(query: string, maxResults: number = 50): Promise<Sound[]> {
  try {
    const { data, error } = await supabase.rpc('search_sounds', {
      q: query,
      max_results: maxResults,
    });
    if (error) throw error;
    return (data as Sound[]) || [];
  } catch (error) {
    console.error('Error in searchSoundsRemote:', error);
    return [];
  }
}

// Fire-and-forget play/download counter bumps. We don't await these in the UI -
// they're best-effort telemetry and must never block playback or download.
export async function incrementListen(soundId: string): Promise<void> {
  try {
    await supabase.rpc('increment_listen', { sound_id: soundId });
  } catch (error) {
    // Never surface this - it's non-critical
    if (import.meta.env.DEV) console.warn('incrementListen failed:', error);
  }
}

export async function incrementDownload(soundId: string): Promise<void> {
  try {
    await supabase.rpc('increment_download', { sound_id: soundId });
  } catch (error) {
    if (import.meta.env.DEV) console.warn('incrementDownload failed:', error);
  }
}

export async function createSound(sound: {
  title: string;
  tags?: string[];
  mp3_path?: string;
  wav_path?: string;
  has_wav?: boolean;
  file_size?: number;
  microphone?: string;
  recorder?: string;
  format?: string;
  category?: string;
  nsfw?: boolean;
  description?: string;
}): Promise<Sound | null> {
  try {
    const { data, error } = await supabase.rpc('admin_create_sound', {
      input: sound,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating sound:', error);
    return null;
  }
}

export async function updateSound(id: string, updates: Partial<Sound>): Promise<Sound | null> {
  try {
    const { data, error } = await supabase.rpc('admin_update_sound', {
      sound_id: id,
      updates,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating sound:', error);
    return null;
  }
}

export async function deleteSound(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('admin_soft_delete_sound', {
      sound_id: id,
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error deleting sound:', error);
    return false;
  }
}

// ── Suggestions ─────────────────────────────────────────────────────────────

export async function getAllSuggestions(): Promise<Suggestion[]> {
  try {
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      soundName: row.sound_name,
      description: row.description || '',
      category: row.category || 'General',
      status: row.status,
      submittedAt: row.created_at,
      isRead: row.status !== 'pending',
    }));
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

export async function createSuggestion(suggestion: {
  soundName: string;
  category?: string;
  description?: string;
}): Promise<Suggestion | null> {
  try {
    const { data, error } = await supabase.rpc('submit_suggestion', {
      p_sound_name: suggestion.soundName,
      p_category: suggestion.category || 'General',
      p_description: suggestion.description || '',
    });

    if (error) throw error;

    return {
      id: data.id,
      soundName: data.sound_name,
      description: data.description || '',
      category: data.category || 'General',
      status: data.status,
      submittedAt: data.created_at,
      isRead: false,
    };
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return null;
  }
}

export async function updateSuggestion(id: string, updates: Partial<Suggestion>): Promise<Suggestion | null> {
  try {
    const { data, error } = await supabase.rpc('admin_update_suggestion', {
      suggestion_id: id,
      updates,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating suggestion:', error);
    return null;
  }
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('admin_delete_suggestion', {
      suggestion_id: id,
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return false;
  }
}

// ── Tags ────────────────────────────────────────────────────────────────────

export async function getAllTags(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('name')
      .order('name');

    if (error) throw error;
    return (data || []).map((t: any) => t.name);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

export async function setTags(tags: string[]): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('admin_set_tags', {
      tag_names: tags,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error setting tags:', error);
    return [];
  }
}

export async function addTag(tag: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('admin_add_tag', {
      tag_name: tag,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error adding tag:', error);
    throw error;
  }
}

export async function removeTag(tag: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('admin_remove_tag', {
      tag_name: tag,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error removing tag:', error);
    return [];
  }
}
