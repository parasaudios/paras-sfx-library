import * as api from './api';

// Sample sounds to populate the database
const sampleSounds = [
  {
    title: 'Door Creak',
    tags: ['door', 'creak', 'wood', 'horror'],
    microphone: 'Rode NT1-A',
    format: 'WAV'
  },
  {
    title: 'Thunder Rumble',
    tags: ['thunder', 'storm', 'weather', 'ambient'],
    microphone: 'Zoom H6',
    format: 'WAV'
  },
  {
    title: 'Footsteps on Gravel',
    tags: ['footsteps', 'gravel', 'walking', 'foley'],
    microphone: 'Rode NT1-A',
    format: 'MP3'
  },
  {
    title: 'Wind Howl',
    tags: ['wind', 'howl', 'weather', 'ambient', 'horror'],
    microphone: 'Zoom H6',
    format: 'WAV'
  },
  {
    title: 'Glass Break',
    tags: ['glass', 'break', 'shatter', 'impact'],
    microphone: 'Rode NT1-A',
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
