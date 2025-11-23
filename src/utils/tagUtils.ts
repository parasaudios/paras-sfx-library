/**
 * Format tag for display - capitalizes NSFW and first letter of other tags
 */
export function formatTagForDisplay(tag: string): string {
  // NSFW should always be uppercase
  if (tag.toLowerCase() === 'nsfw') {
    return 'NSFW';
  }
  
  // Capitalize first letter of the tag
  if (!tag) return tag;
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
}