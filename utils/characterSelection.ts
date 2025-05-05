/**
 * Utility function for selecting the next character to practice based on mastery
 * Used by both TrainingMode and SendingMode components
 * 
 * @param chars Array of available characters
 * @param charPoints Object mapping characters to their mastery points
 * @param targetPoints Points needed for mastery
 * @param recentlyMastered Optional character to exclude (recently mastered)
 * @returns The next character to practice
 */
export function selectNextCharacter(
  chars: string[],
  charPoints: Record<string, number>,
  targetPoints: number,
  recentlyMastered: string | null = null
): string {
  if (!chars.length) return '';
  
  // First, separate characters into mastered and unmastered groups
  const unmastered: string[] = [];
  const mastered: string[] = [];
  
  // Keep track of whether the recentlyMastered char was found
  let foundRecentlyMastered = false;
  
  for (const char of chars) {
    const points = charPoints[char] || 0;
    
    // Check if this character was just mastered in the previous round
    const justMastered = char === recentlyMastered;
    if (justMastered) foundRecentlyMastered = true;
    
    if (points >= targetPoints) {
      // Add to mastered list, but avoid selecting if it was just mastered
      if (!justMastered) {
        mastered.push(char);
      }
    } else {
      // Add to unmastered, but also exclude the recently mastered one
      // This ensures even if points haven't updated yet, we still exclude it
      if (!justMastered) {
        unmastered.push(char);
      }
    }
  }
  
  // If there are unmastered characters, pick from them with 95% probability
  // Only 5% chance to review a mastered character
  if (unmastered.length > 0) {
    const pickFromUnmastered = Math.random() < 0.95 || mastered.length === 0;
    
    if (pickFromUnmastered) {
      // Pick randomly from unmastered characters, with weight based on how far from mastery
      const unmasteredWithWeights = unmastered.map(char => {
        const points = charPoints[char] || 0;
        // Weight is inverse to points - characters with fewer points get higher weight
        const weight = targetPoints - points;
        return { char, weight };
      });
      
      // Use weighted random selection among unmastered chars
      const totalWeight = unmasteredWithWeights.reduce((sum, p) => sum + p.weight, 0);
      let r = Math.random() * totalWeight;
      let cumulative = 0;
      
      for (const p of unmasteredWithWeights) {
        cumulative += p.weight;
        if (r < cumulative) {
          // Final check - don't return the recently mastered char
          if (p.char !== recentlyMastered) {
            return p.char;
          } else {
            // If we somehow ended up with the recently mastered char,
            // pick another one if available
            if (unmasteredWithWeights.length > 1) {
              // Find another character
              const otherChars = unmasteredWithWeights.filter(c => c.char !== recentlyMastered);
              return otherChars[Math.floor(Math.random() * otherChars.length)].char;
            }
          }
        }
      }
      
      // Fallback - make sure it's not the recently mastered char
      const lastChar = unmasteredWithWeights[unmasteredWithWeights.length - 1].char;
      if (lastChar !== recentlyMastered || unmasteredWithWeights.length === 1) {
        return lastChar;
      } else {
        return unmasteredWithWeights[0].char;
      }
    } else {
      // 5% of the time, pick from mastered for review
      // But avoid the recently mastered one
      if (mastered.length > 0) {
        const randomIndex = Math.floor(Math.random() * mastered.length);
        return mastered[randomIndex]; 
      } else {
        // If no mastered chars available, pick from unmastered
        const randomIndex = Math.floor(Math.random() * unmastered.length);
        return unmastered[randomIndex];
      }
    }
  } else if (mastered.length > 0) {
    // All characters that aren't recently mastered are mastered
    // Pick randomly from mastered
    const randomIndex = Math.floor(Math.random() * mastered.length);
    return mastered[randomIndex];
  } else if (foundRecentlyMastered) {
    // Only recently mastered char exists - we have to return it
    return recentlyMastered as string;
  } else {
    // Fall back to random selection from all chars if something's wrong
    const randomIndex = Math.floor(Math.random() * chars.length);
    return chars[randomIndex];
  }
} 