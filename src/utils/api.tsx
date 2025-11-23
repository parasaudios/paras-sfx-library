import { projectId, publicAnonKey } from './supabase/info';
import type { Sound, Suggestion } from '../types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-27929102`;

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error(`API Error [${endpoint}]:`, error);
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getAllSounds(): Promise<Sound[]> {
  try {
    const data = await fetchAPI('/sounds');
    return data.sounds || [];
  } catch (error) {
    console.error('Error fetching sounds:', error);
    return [];
  }
}

export async function createSound(sound: Omit<Sound, 'id'>): Promise<Sound | null> {
  try {
    console.log('Creating sound:', sound);
    const data = await fetchAPI('/sounds', {
      method: 'POST',
      body: JSON.stringify(sound),
    });
    console.log('Sound created successfully:', data.sound);
    return data.sound;
  } catch (error) {
    console.error('Error creating sound:', error);
    return null;
  }
}

export async function updateSound(id: string, updates: Partial<Sound>): Promise<Sound | null> {
  try {
    console.log('Updating sound:', id, updates);
    const data = await fetchAPI(`/sounds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    console.log('Sound updated successfully:', data.sound);
    return data.sound;
  } catch (error) {
    console.error('Error updating sound:', error);
    return null;
  }
}

export async function deleteSound(id: string): Promise<boolean> {
  try {
    console.log('Deleting sound:', id);
    await fetchAPI(`/sounds/${id}`, {
      method: 'DELETE',
    });
    console.log('Sound deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting sound:', error);
    return false;
  }
}

// Suggestion API functions

export async function getAllSuggestions(): Promise<Suggestion[]> {
  try {
    const data = await fetchAPI('/suggestions');
    return data.suggestions || [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

export async function createSuggestion(suggestion: Omit<Suggestion, 'id'>): Promise<Suggestion | null> {
  try {
    console.log('Creating suggestion:', suggestion);
    const data = await fetchAPI('/suggestions', {
      method: 'POST',
      body: JSON.stringify(suggestion),
    });
    console.log('Suggestion created successfully:', data.suggestion);
    return data.suggestion;
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return null;
  }
}

export async function updateSuggestion(id: string, updates: Partial<Suggestion>): Promise<Suggestion | null> {
  try {
    console.log('Updating suggestion:', id, updates);
    const data = await fetchAPI(`/suggestions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    console.log('Suggestion updated successfully:', data.suggestion);
    return data.suggestion;
  } catch (error) {
    console.error('Error updating suggestion:', error);
    return null;
  }
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  try {
    console.log('Deleting suggestion:', id);
    await fetchAPI(`/suggestions/${id}`, {
      method: 'DELETE',
    });
    console.log('Suggestion deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return false;
  }
}

// Tag API functions

export async function getAllTags(): Promise<string[]> {
  try {
    const data = await fetchAPI('/tags');
    console.log('Fetched tags from API:', data);
    return data.tags || [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    // Return empty array instead of throwing to prevent UI breaks
    return [];
  }
}

export async function setTags(tags: string[]): Promise<string[]> {
  try {
    console.log('Setting tags:', tags);
    const data = await fetchAPI('/tags', {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
    console.log('Tags set successfully:', data.tags);
    return data.tags;
  } catch (error) {
    console.error('Error setting tags:', error);
    return [];
  }
}

export async function addTag(tag: string): Promise<string[]> {
  try {
    console.log('Adding tag:', tag);
    const data = await fetchAPI('/tags', {
      method: 'POST',
      body: JSON.stringify({ tag }),
    });
    console.log('Tag added successfully:', data.tags);
    return data.tags;
  } catch (error) {
    console.error('Error adding tag:', error);
    throw error;
  }
}

export async function removeTag(tag: string): Promise<string[]> {
  try {
    console.log('Removing tag:', tag);
    const data = await fetchAPI(`/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    });
    console.log('Tag removed successfully:', data.tags);
    return data.tags;
  } catch (error) {
    console.error('Error removing tag:', error);
    return [];
  }
}