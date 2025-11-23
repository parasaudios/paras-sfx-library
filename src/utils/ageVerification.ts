/**
 * Age Verification Utilities
 * Manages age verification status for NSFW content
 */

const AGE_VERIFICATION_KEY = 'sfx_library_age_verified';
const VERIFICATION_EXPIRY_DAYS = 30; // Verification expires after 30 days

interface VerificationData {
  verified: boolean;
  timestamp: number;
}

/**
 * Check if the user has verified their age
 */
export function isAgeVerified(): boolean {
  try {
    const stored = localStorage.getItem(AGE_VERIFICATION_KEY);
    if (!stored) return false;

    const data: VerificationData = JSON.parse(stored);
    
    // Check if verification has expired
    const now = Date.now();
    const daysSinceVerification = (now - data.timestamp) / (1000 * 60 * 60 * 24);
    
    if (daysSinceVerification > VERIFICATION_EXPIRY_DAYS) {
      // Verification expired, clear it
      clearAgeVerification();
      return false;
    }

    return data.verified;
  } catch (error) {
    console.error('Error checking age verification:', error);
    return false;
  }
}

/**
 * Set age verification status
 */
export function setAgeVerified(verified: boolean): void {
  try {
    const data: VerificationData = {
      verified,
      timestamp: Date.now(),
    };
    localStorage.setItem(AGE_VERIFICATION_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error setting age verification:', error);
  }
}

/**
 * Clear age verification
 */
export function clearAgeVerification(): void {
  try {
    localStorage.removeItem(AGE_VERIFICATION_KEY);
  } catch (error) {
    console.error('Error clearing age verification:', error);
  }
}

/**
 * Check if a sound has NSFW content
 */
export function isNSFW(tags: string[]): boolean {
  return tags.some(tag => tag.toLowerCase() === 'nsfw');
}

/**
 * Filter NSFW sounds based on verification status
 */
export function filterNSFWSounds<T extends { tags: string[] }>(
  sounds: T[],
  isVerified: boolean
): T[] {
  if (isVerified) {
    return sounds; // Show all sounds if verified
  }
  
  // Filter out NSFW sounds if not verified
  return sounds.filter(sound => !isNSFW(sound.tags));
}
