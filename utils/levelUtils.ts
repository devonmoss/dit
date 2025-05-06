import { createLogger } from './logger';
import { trainingLevels } from './levels';

const logger = createLogger('levelUtils');

/**
 * Get characters for a specific level ID
 * This provides a single source of truth for level character sets
 */
export function getLevelChars(levelId: string): string[] {
  // Find the level in trainingLevels
  const level = trainingLevels.find(l => l.id === levelId);
  
  if (!level) {
    logger.error(`Could not find level with ID: ${levelId}`);
    return [];
  }
  
  logger.debug(`Found ${level.chars.length} characters for level ${levelId}`);
  return level.chars;
}

/**
 * Validates that the provided character set matches the expected level characters
 */
export function validateLevelCharacters(
  levelId: string, 
  stateChars: string[]
): { 
  valid: boolean; 
  missing: string[]; 
  extra: string[]; 
} {
  const levelChars = getLevelChars(levelId);
  
  // Check for match
  const sameLength = levelChars.length === stateChars.length;
  const allPresent = levelChars.every(c => stateChars.includes(c));
  const noExtras = stateChars.every(c => levelChars.includes(c));
  
  // Find missing characters
  const missing = levelChars.filter(c => !stateChars.includes(c));
  
  // Find extra characters
  const extra = stateChars.filter(c => !levelChars.includes(c));
  
  return {
    valid: sameLength && allPresent && noExtras,
    missing,
    extra
  };
}

/**
 * Determines if all characters in a level are mastered
 */
export function areAllCharsMastered(
  levelId: string,
  charPoints: Record<string, number>,
  targetPoints: number
): boolean {
  const levelChars = getLevelChars(levelId);
  return levelChars.every(char => (charPoints[char] || 0) >= targetPoints);
}