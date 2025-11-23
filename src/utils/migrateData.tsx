import * as api from './api';

export async function migrateLocalStorageToSupabase(): Promise<{ success: boolean; migrated: number; message: string }> {
  try {
    // Get existing sounds from localStorage
    const stored = localStorage.getItem('customSounds');
    if (!stored) {
      return { success: true, migrated: 0, message: 'No data to migrate' };
    }

    const localSounds = JSON.parse(stored);
    if (!Array.isArray(localSounds) || localSounds.length === 0) {
      return { success: true, migrated: 0, message: 'No sounds found in localStorage' };
    }

    // Get existing sounds from API to avoid duplicates
    const existingSounds = await api.getAllSounds();
    const existingUrls = new Set(existingSounds.map(s => s.audioUrl));

    // Migrate sounds that don't already exist
    let migratedCount = 0;
    for (const sound of localSounds) {
      // Skip if already exists (same URL)
      if (existingUrls.has(sound.audioUrl)) {
        continue;
      }

      const result = await api.createSound({
        title: sound.title,
        audioUrl: sound.audioUrl,
        tags: Array.isArray(sound.tags) ? sound.tags : [],
        equipment: sound.equipment,
        format: sound.format
      });

      if (result) {
        migratedCount++;
      }
    }

    // Clear localStorage after successful migration
    if (migratedCount > 0) {
      localStorage.removeItem('customSounds');
    }

    return { 
      success: true, 
      migrated: migratedCount, 
      message: `Successfully migrated ${migratedCount} sound(s)` 
    };
  } catch (error) {
    console.error('Migration error:', error);
    return { 
      success: false, 
      migrated: 0, 
      message: `Migration failed: ${error}` 
    };
  }
}