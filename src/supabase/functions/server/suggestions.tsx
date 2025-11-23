import * as kv from './kv_store.tsx';

interface Suggestion {
  id: string;
  soundName: string;
  category: string;
  description: string;
  submittedAt: string;
  isRead: boolean;
}

const SUGGESTIONS_PREFIX = 'suggestion:';

export async function getAllSuggestions(): Promise<Suggestion[]> {
  try {
    const suggestions = await kv.getByPrefix(SUGGESTIONS_PREFIX);
    return suggestions.sort((a, b) => {
      // Unread first
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }
      // Then by date (newest first)
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  } catch (error) {
    console.error('Error getting all suggestions:', error);
    return [];
  }
}

export async function getSuggestion(id: string): Promise<Suggestion | null> {
  try {
    return await kv.get(`${SUGGESTIONS_PREFIX}${id}`);
  } catch (error) {
    console.error('Error getting suggestion:', error);
    return null;
  }
}

export async function createSuggestion(suggestion: Omit<Suggestion, 'id'>): Promise<Suggestion> {
  const id = `suggestion-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const newSuggestion: Suggestion = {
    id,
    ...suggestion,
    submittedAt: suggestion.submittedAt || new Date().toISOString(),
    isRead: false
  };
  
  await kv.set(`${SUGGESTIONS_PREFIX}${id}`, newSuggestion);
  console.log('Created suggestion:', newSuggestion);
  return newSuggestion;
}

export async function updateSuggestion(id: string, updates: Partial<Suggestion>): Promise<Suggestion | null> {
  const existing = await getSuggestion(id);
  if (!existing) {
    return null;
  }
  
  const updated: Suggestion = {
    ...existing,
    ...updates,
    id: existing.id, // Ensure ID doesn't change
  };
  
  await kv.set(`${SUGGESTIONS_PREFIX}${id}`, updated);
  console.log('Updated suggestion:', updated);
  return updated;
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  try {
    await kv.del(`${SUGGESTIONS_PREFIX}${id}`);
    console.log('Deleted suggestion:', id);
    return true;
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return false;
  }
}
