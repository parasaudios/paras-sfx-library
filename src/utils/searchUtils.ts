import type { Sound } from '../types';

/**
 * Performs a search on a collection of sounds
 * @param sounds - Array of sounds to search through
 * @param query - Search query string
 * @returns Filtered and sorted array of matching sounds
 */
export function searchSounds(sounds: Sound[], query: string): Sound[] {
  if (!query.trim()) {
    return sounds;
  }

  const searchTerms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0);

  // Pre-compute lowercase values for better performance
  const soundsWithMeta = sounds.map(sound => ({
    sound,
    titleLower: sound.title.toLowerCase(),
    tagsLower: sound.tags.map(t => t.toLowerCase()),
  }));

  // Filter sounds that match any search term
  const matchedResults = soundsWithMeta.filter(({ titleLower, tagsLower }) => {
    return searchTerms.some(term =>
      titleLower.includes(term) ||
      tagsLower.some(tag => tag.includes(term) || term.includes(tag))
    );
  });

  // Sort by relevance: exact title matches first, then partial matches
  matchedResults.sort((a, b) => {
    const aExactTitle = searchTerms.some(term => a.titleLower === term);
    const bExactTitle = searchTerms.some(term => b.titleLower === term);
    
    if (aExactTitle && !bExactTitle) return -1;
    if (!aExactTitle && bExactTitle) return 1;

    const aTitleMatch = searchTerms.some(term => a.titleLower.includes(term));
    const bTitleMatch = searchTerms.some(term => b.titleLower.includes(term));
    
    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;
    
    return 0;
  });

  return matchedResults.map(({ sound }) => sound);
}

/**
 * Extracts all unique tags from a collection of sounds
 * @param sounds - Array of sounds
 * @returns Sorted array of unique tags (lowercase)
 */
export function extractAllTags(sounds: Sound[]): string[] {
  const tagSet = new Set<string>();
  
  sounds.forEach(sound => {
    sound.tags.forEach(tag => {
      tagSet.add(tag.toLowerCase().trim());
    });
  });

  return Array.from(tagSet).sort();
}
