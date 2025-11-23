import * as kv from './kv_store.tsx';

export interface Sound {
  id: string;
  title: string;
  audioUrl: string;
  tags: string[];
  equipment?: string;
  format?: string;
  createdAt: number;
}

const SOUNDS_PREFIX = 'sound:';

export async function getAllSounds(): Promise<Sound[]> {
  try {
    const sounds = await kv.getByPrefix(SOUNDS_PREFIX);
    return sounds.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting all sounds:', error);
    return [];
  }
}

export async function getSound(id: string): Promise<Sound | null> {
  try {
    return await kv.get(`${SOUNDS_PREFIX}${id}`);
  } catch (error) {
    console.error('Error getting sound:', error);
    return null;
  }
}

export async function createSound(sound: Omit<Sound, 'id' | 'createdAt'>): Promise<Sound> {
  const id = crypto.randomUUID();
  const newSound: Sound = {
    ...sound,
    id,
    createdAt: Date.now(),
  };
  
  await kv.set(`${SOUNDS_PREFIX}${id}`, newSound);
  return newSound;
}

export async function updateSound(id: string, updates: Partial<Sound>): Promise<Sound | null> {
  const existing = await getSound(id);
  if (!existing) {
    return null;
  }
  
  const updated = { ...existing, ...updates };
  await kv.set(`${SOUNDS_PREFIX}${id}`, updated);
  return updated;
}

export async function deleteSound(id: string): Promise<boolean> {
  try {
    await kv.del(`${SOUNDS_PREFIX}${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting sound:', error);
    return false;
  }
}