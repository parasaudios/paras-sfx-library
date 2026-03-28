import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

export const supabase = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Storage bucket for sounds uploaded via storage scan
const SOUNDS_BUCKET = 'sounds';
// Storage bucket for sounds uploaded via Figma Make
const MAKE_BUCKET = 'make-27929102-streaming';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || 'https://nuskzxhtiusnaaungbzh.supabase.co';

export function getStreamingUrl(mp3Path: string | null, source: string | null): string {
  if (!mp3Path) return '';
  const bucket = source === 'kv_migration' ? MAKE_BUCKET : SOUNDS_BUCKET;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${mp3Path}`;
}

export function getDownloadUrl(wavPath: string | null, mp3Path: string | null, source: string | null): string {
  // Prefer WAV for downloads, fall back to MP3
  const path = wavPath || mp3Path;
  if (!path) return '';
  const bucket = source === 'kv_migration' ? MAKE_BUCKET : SOUNDS_BUCKET;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
