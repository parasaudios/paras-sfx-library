/**
 * Converts a Google Drive share link to a direct playable audio URL
 * Supports various Google Drive URL formats
 */
export function convertGoogleDriveUrl(url: string): string {
  if (!url.includes('drive.google.com')) {
    return url; // Return as-is if not a Google Drive link
  }

  // Extract file ID from various Google Drive URL formats
  let fileId = '';
  
  // Format 1: https://drive.google.com/file/d/FILE_ID/view
  const viewMatch = url.match(/\/file\/d\/([^\/]+)/);
  if (viewMatch) {
    fileId = viewMatch[1];
  }
  
  // Format 2: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) {
    fileId = openMatch[1];
  }
  
  // Format 3: Already in direct format
  const ucMatch = url.match(/\/uc\?.*id=([^&]+)/);
  if (ucMatch) {
    fileId = ucMatch[1];
  }

  if (fileId) {
    // Use the streaming format that works better with HTML5 audio
    // Remove any query parameters from fileId
    fileId = fileId.split('?')[0].split('&')[0];
    return `https://docs.google.com/uc?export=open&id=${fileId}`;
  }

  return url; // Return original if we couldn't parse it
}

/**
 * Check if a URL is a Google Drive link
 */
export function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com/uc');
}