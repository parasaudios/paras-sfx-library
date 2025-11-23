import * as api from './api';

// Sample sounds to populate the database
// Replace these with your actual Google Drive links
const sampleSounds = [
  {
    title: 'Door Creak',
    audioUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view',
    tags: ['door', 'creak', 'wood', 'horror'],
    equipment: 'Rode NT1-A',
    format: 'WAV'
  },
  {
    title: 'Thunder Rumble',
    audioUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view',
    tags: ['thunder', 'storm', 'weather', 'ambient'],
    equipment: 'Zoom H6',
    format: 'WAV'
  },
  {
    title: 'Footsteps on Gravel',
    audioUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view',
    tags: ['footsteps', 'gravel', 'walking', 'foley'],
    equipment: 'Rode NT1-A',
    format: 'MP3'
  },
  {
    title: 'Wind Howl',
    audioUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view',
    tags: ['wind', 'howl', 'weather', 'ambient', 'horror'],
    equipment: 'Zoom H6',
    format: 'WAV'
  },
  {
    title: 'Glass Break',
    audioUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view',
    tags: ['glass', 'break', 'shatter', 'impact'],
    equipment: 'Rode NT1-A',
    format: 'WAV'
  }
];

export async function seedDatabase(): Promise<{ success: boolean; added: number; message: string }> {
  try {
    // Check if database already has sounds
    const existingSounds = await api.getAllSounds();
    
    if (existingSounds.length > 0) {
      return {
        success: true,
        added: 0,
        message: `Database already has ${existingSounds.length} sound(s). Skipping seed.`
      };
    }

    // Add sample sounds
    let addedCount = 0;
    for (const sound of sampleSounds) {
      const result = await api.createSound(sound);
      if (result) {
        addedCount++;
      }
    }

    return {
      success: true,
      added: addedCount,
      message: `Successfully added ${addedCount} sample sound(s) to database`
    };
  } catch (error) {
    console.error('Seed error:', error);
    return {
      success: false,
      added: 0,
      message: `Failed to seed database: ${error}`
    };
  }
}