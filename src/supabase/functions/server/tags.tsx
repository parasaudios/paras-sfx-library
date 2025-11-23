import * as kv from './kv_store.tsx';

const TAGS_KEY = 'sfx:tags';

interface TagsData {
  tags: string[];
  updatedAt: string;
}

export async function getAllTags(): Promise<string[]> {
  try {
    const data = await kv.get(TAGS_KEY) as TagsData | null;
    if (!data) {
      console.log('No tags found, returning empty array');
      return [];
    }
    return data.tags || [];
  } catch (error) {
    console.error('Error getting tags:', error);
    // Return empty array instead of throwing
    return [];
  }
}

export async function setTags(tags: string[]): Promise<void> {
  const data: TagsData = {
    tags: tags.filter(tag => tag.trim().length > 0), // Remove empty tags
    updatedAt: new Date().toISOString(),
  };
  await kv.set(TAGS_KEY, data);
  console.log('Updated tags:', data);
}

export async function addTag(tag: string): Promise<string[]> {
  const currentTags = await getAllTags();
  const trimmedTag = tag.trim().toLowerCase();
  
  if (!trimmedTag) {
    throw new Error('Tag cannot be empty');
  }
  
  if (currentTags.some(t => t.toLowerCase() === trimmedTag)) {
    throw new Error('Tag already exists');
  }
  
  const updatedTags = [...currentTags, trimmedTag].sort();
  await setTags(updatedTags);
  return updatedTags;
}

export async function removeTag(tag: string): Promise<string[]> {
  const currentTags = await getAllTags();
  const updatedTags = currentTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
  await setTags(updatedTags);
  return updatedTags;
}