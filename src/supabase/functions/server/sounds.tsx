import { supabase, getStreamingUrl, getDownloadUrl } from './db.tsx';

export interface Sound {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  mp3_path: string | null;
  wav_path: string | null;
  has_wav: boolean;
  file_size: number | null;
  duration_seconds: number | null;
  microphone: string | null;
  recorder: string | null;
  format: string | null;
  category: string | null;
  nsfw: boolean;
  listens: number;
  downloads: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoundResponse extends Sound {
  audioUrl: string;
  downloadUrl: string;
}

function toResponse(row: Sound): SoundResponse {
  return {
    ...row,
    audioUrl: getStreamingUrl(row.mp3_path, row.source),
    downloadUrl: getDownloadUrl(row.wav_path, row.mp3_path, row.source),
  };
}

const COLUMNS = `
  id, title, description, tags, mp3_path, wav_path, has_wav,
  file_size, duration_seconds, microphone, recorder, format,
  category, nsfw, listens, downloads, source, created_at, updated_at
`;

export async function getAllSounds(): Promise<SoundResponse[]> {
  const { data, error } = await supabase()
    .from('sounds')
    .select(COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(toResponse);
}

export async function getSound(id: string): Promise<SoundResponse | null> {
  const { data, error } = await supabase()
    .from('sounds')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toResponse(data) : null;
}

export async function createSound(input: {
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
}): Promise<SoundResponse> {
  const { data, error } = await supabase()
    .from('sounds')
    .insert({
      title: input.title,
      tags: input.tags || [],
      mp3_path: input.mp3_path || null,
      wav_path: input.wav_path || null,
      has_wav: input.has_wav || false,
      file_size: input.file_size || null,
      microphone: input.microphone || null,
      recorder: input.recorder || null,
      format: input.format || null,
      category: input.category || null,
      nsfw: input.nsfw || false,
      description: input.description || null,
      source: 'upload',
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toResponse(data);
}

export async function updateSound(id: string, updates: Partial<Sound>): Promise<SoundResponse | null> {
  // Don't allow updating id or timestamps directly
  const { id: _id, created_at: _ca, ...safeUpdates } = updates;

  const { data, error } = await supabase()
    .from('sounds')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toResponse(data) : null;
}

export async function deleteSound(id: string): Promise<boolean> {
  // Soft delete
  const { error, count } = await supabase()
    .from('sounds')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
