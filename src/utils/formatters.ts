/**
 * Capitalizes the first letter of each word in a string
 * @param text - The text to capitalize
 * @returns The text with each word capitalized
 */
export function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
