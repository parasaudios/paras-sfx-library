import { supabase } from './db.tsx';

export interface Suggestion {
  id: string;
  sound_name: string;
  description: string | null;
  category: string | null;
  reference_url: string | null;
  submitted_by: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Frontend-compatible shape (camelCase)
export interface SuggestionResponse {
  id: string;
  soundName: string;
  description: string;
  category: string;
  status: string;
  submittedAt: string;
  isRead: boolean;
}

function toResponse(row: Suggestion): SuggestionResponse {
  return {
    id: row.id,
    soundName: row.sound_name,
    description: row.description || '',
    category: row.category || 'General',
    status: row.status,
    submittedAt: row.created_at,
    isRead: row.status !== 'pending',
  };
}

export async function getAllSuggestions(): Promise<SuggestionResponse[]> {
  const { data, error } = await supabase()
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(toResponse);
}

export async function getSuggestion(id: string): Promise<SuggestionResponse | null> {
  const { data, error } = await supabase()
    .from('suggestions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toResponse(data) : null;
}

export async function createSuggestion(input: {
  soundName: string;
  category?: string;
  description?: string;
}): Promise<SuggestionResponse> {
  const { data, error } = await supabase()
    .from('suggestions')
    .insert({
      sound_name: input.soundName,
      category: input.category || 'General',
      description: input.description || '',
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return toResponse(data);
}

export async function updateSuggestion(id: string, updates: {
  isRead?: boolean;
  soundName?: string;
  category?: string;
  description?: string;
}): Promise<SuggestionResponse | null> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.isRead !== undefined) {
    dbUpdates.status = updates.isRead ? 'reviewed' : 'pending';
  }
  if (updates.soundName !== undefined) dbUpdates.sound_name = updates.soundName;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  const { data, error } = await supabase()
    .from('suggestions')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toResponse(data) : null;
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  const { error, count } = await supabase()
    .from('suggestions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
