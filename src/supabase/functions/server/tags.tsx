import { supabase } from './db.tsx';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  category: string | null;
  usage_count: number;
}

export async function getAllTags(): Promise<string[]> {
  const { data, error } = await supabase()
    .from('tags')
    .select('name')
    .order('name');

  if (error) throw new Error(error.message);
  return (data || []).map(t => t.name);
}

export async function getAllTagsFull(): Promise<Tag[]> {
  const { data, error } = await supabase()
    .from('tags')
    .select('*')
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function setTags(tags: string[]): Promise<void> {
  const db = supabase();

  // Get existing tags
  const { data: existing } = await db.from('tags').select('name');
  const existingNames = new Set((existing || []).map(t => t.name.toLowerCase()));

  // Filter to new tags only
  const newTags = tags
    .filter(t => t.trim().length > 0)
    .filter(t => !existingNames.has(t.trim().toLowerCase()));

  if (newTags.length > 0) {
    const rows = newTags.map(name => ({
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
    }));

    const { error } = await db.from('tags').upsert(rows, { onConflict: 'slug' });
    if (error) throw new Error(error.message);
  }
}

export async function addTag(tag: string): Promise<string[]> {
  const trimmed = tag.trim();
  if (!trimmed) throw new Error('Tag cannot be empty');

  const slug = trimmed.toLowerCase().replace(/\s+/g, '-');

  const { error } = await supabase()
    .from('tags')
    .insert({ name: trimmed, slug });

  if (error) {
    if (error.code === '23505') throw new Error('Tag already exists');
    throw new Error(error.message);
  }

  return getAllTags();
}

export async function removeTag(tag: string): Promise<string[]> {
  const { error } = await supabase()
    .from('tags')
    .delete()
    .ilike('name', tag);

  if (error) throw new Error(error.message);
  return getAllTags();
}
