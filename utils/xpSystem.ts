import supabase from './supabase';

// Types for XP system
export interface XpInfo {
  xp: number;
  level: number;
  nextLevelXp: number;
  progress: number;
  tier: string;
}

export interface XpTransaction {
  id: string;
  amount: number;
  reason: string;
  details: any;
  created_at: string;
}

export interface XpAwardResult {
  awarded: number;
  old_xp: number;
  new_xp: number;
  old_level: number;
  new_level: number;
  leveled_up: boolean;
}

// XP source constants for consistent reasons
export enum XpSource {
  TRAINING = 'training',
  CHECKPOINT = 'checkpoint',
  RACE = 'race',
  DAILY_STREAK = 'daily_streak',
  WEEKLY_COMPLETION = 'weekly_completion',
  ACHIEVEMENT = 'achievement'
}

// XP calculation constants
const XP_CONSTANTS = {
  // Training mode XP
  BASE_CHAR_XP: 10,
  LIGHTNING_SPEED_BONUS: 5,
  FAST_SPEED_BONUS: 3,
  ACCURACY_MULTIPLIER: 1.2,
  
  // Level completion XP
  STANDARD_LEVEL_XP: 50,
  CHECKPOINT_LEVEL_XP: 100,
  FIRST_TIME_BONUS: 25,
  
  // Race XP
  RACE_PARTICIPATION_XP: 30,
  RACE_COMPLETION_BONUS: 20,
  RACE_CHARS_FACTOR: 2,
  FIRST_PLACE_BONUS: 50,
  SECOND_PLACE_BONUS: 30,
  THIRD_PLACE_BONUS: 15,
  SPEED_RECORD_BONUS: 25,
  
  // Activity bonuses
  DAILY_STREAK_BONUS: 15,
  WEEKLY_COMPLETION_BONUS: 40
};

/**
 * Calculate XP for training activity
 */
export function calculateTrainingXp(
  charactersStudied: number,
  mistakesCount: number,
  responseTimes: Array<{char: string, time: number}>,
  completedTraining: boolean = false
): { total: number, breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let totalXp = 0;
  
  // Base XP for characters studied
  const baseXp = charactersStudied * XP_CONSTANTS.BASE_CHAR_XP;
  breakdown.base = baseXp;
  totalXp += baseXp;
  
  // Calculate speed factor based on response times
  const avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt.time, 0) / responseTimes.length;
  
  // Speed bonuses
  let speedBonus = 0;
  if (avgResponseTime < 0.4) {
    // Lightning fast
    speedBonus = charactersStudied * XP_CONSTANTS.LIGHTNING_SPEED_BONUS;
    breakdown.speedLightning = speedBonus;
  } else if (avgResponseTime < 0.8) {
    // Fast
    speedBonus = charactersStudied * XP_CONSTANTS.FAST_SPEED_BONUS;
    breakdown.speedFast = speedBonus;
  }
  totalXp += speedBonus;
  
  // Accuracy multiplier
  const accuracyPercent = 100 * (1 - (mistakesCount / (charactersStudied + mistakesCount)));
  if (accuracyPercent >= 80) {
    const accuracyMultiplier = 1 + (XP_CONSTANTS.ACCURACY_MULTIPLIER - 1) * (accuracyPercent / 100);
    const accuracyBonus = Math.round((totalXp * accuracyMultiplier) - totalXp);
    breakdown.accuracy = accuracyBonus;
    totalXp += accuracyBonus;
  }
  
  // Completion bonus
  if (completedTraining) {
    const completionBonus = XP_CONSTANTS.STANDARD_LEVEL_XP;
    breakdown.completion = completionBonus;
    totalXp += completionBonus;
  }
  
  return {
    total: Math.round(totalXp),
    breakdown
  };
}

/**
 * Calculate XP for level completion
 */
export function calculateLevelCompletionXp(
  levelId: string,
  isCheckpoint: boolean = false
): { total: number, breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let totalXp = 0;
  
  // Base XP for level type
  const baseXp = isCheckpoint ? 
    XP_CONSTANTS.CHECKPOINT_LEVEL_XP : 
    XP_CONSTANTS.STANDARD_LEVEL_XP;
    
  breakdown.levelCompletion = baseXp;
  totalXp += baseXp;
  
  // First-time completion bonus (always true for now - we only call this on first completion)
  const firstTimeBonus = XP_CONSTANTS.FIRST_TIME_BONUS;
  breakdown.firstTime = firstTimeBonus;
  totalXp += firstTimeBonus;
  
  return {
    total: Math.round(totalXp),
    breakdown
  };
}

/**
 * Calculate XP for checkpoint completion
 */
export function calculateCheckpointXp(
  totalCharacters: number,
  mistakeCount: number,
  isFirstTimeCompletion: boolean = false
): { total: number, breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let totalXp = 0;
  
  // Base XP for checkpoint
  const baseXp = XP_CONSTANTS.CHECKPOINT_LEVEL_XP;
  breakdown.base = baseXp;
  totalXp += baseXp;
  
  // Character count bonus
  const charBonus = totalCharacters * 2;
  breakdown.characterCount = charBonus;
  totalXp += charBonus;
  
  // Accuracy bonus (fewer mistakes = more XP)
  const mistakePercentage = Math.min(1, mistakeCount / totalCharacters);
  const accuracyMultiplier = 1 - (mistakePercentage * 0.5); // At most reduce by 50%
  const accuracyAdjustment = Math.round((totalXp * accuracyMultiplier) - totalXp);
  
  if (accuracyAdjustment !== 0) {
    breakdown.accuracy = accuracyAdjustment;
    totalXp += accuracyAdjustment;
  }
  
  // First-time completion bonus
  if (isFirstTimeCompletion) {
    const firstTimeBonus = XP_CONSTANTS.FIRST_TIME_BONUS;
    breakdown.firstTime = firstTimeBonus;
    totalXp += firstTimeBonus;
  }
  
  return {
    total: Math.round(totalXp),
    breakdown
  };
}

/**
 * Calculate XP for race participation
 */
export function calculateRaceXp(
  correctChars: number,
  mistakeCount: number,
  completed: boolean = false,
  position: number = 0,
  totalParticipants: number = 1,
  isPersonalBest: boolean = false
): { total: number, breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let totalXp = 0;
  
  // Base participation XP
  const baseXp = XP_CONSTANTS.RACE_PARTICIPATION_XP;
  breakdown.participation = baseXp;
  totalXp += baseXp;
  
  // Completed race bonus
  if (completed) {
    const completionBonus = XP_CONSTANTS.RACE_COMPLETION_BONUS;
    breakdown.completion = completionBonus;
    totalXp += completionBonus;
    
    // Character count bonus
    const charBonus = correctChars * XP_CONSTANTS.RACE_CHARS_FACTOR;
    breakdown.characterCount = charBonus;
    totalXp += charBonus;
  }
  
  // Position bonuses (only awarded if race was completed)
  if (completed && position > 0) {
    let positionBonus = 0;
    
    if (position === 1) {
      positionBonus = XP_CONSTANTS.FIRST_PLACE_BONUS;
      breakdown.firstPlace = positionBonus;
    } else if (position === 2) {
      positionBonus = XP_CONSTANTS.SECOND_PLACE_BONUS;
      breakdown.secondPlace = positionBonus;
    } else if (position === 3) {
      positionBonus = XP_CONSTANTS.THIRD_PLACE_BONUS;
      breakdown.thirdPlace = positionBonus;
    }
    
    totalXp += positionBonus;
  }
  
  // More participants = more XP (capped at 20 bonus XP)
  if (totalParticipants > 1) {
    const participantBonus = Math.min(20, (totalParticipants - 1) * 3);
    breakdown.participants = participantBonus;
    totalXp += participantBonus;
  }
  
  // Personal best bonus
  if (isPersonalBest) {
    const bestBonus = XP_CONSTANTS.SPEED_RECORD_BONUS;
    breakdown.personalBest = bestBonus;
    totalXp += bestBonus;
  }
  
  // Accuracy factor (only applied if more than 5 characters)
  if (correctChars > 5) {
    const accuracyPercent = 100 * (correctChars / (correctChars + mistakeCount));
    if (accuracyPercent >= 80) {
      const accuracyFactor = (accuracyPercent / 100) * 0.5; // At most +50% bonus
      const accuracyBonus = Math.round(totalXp * accuracyFactor);
      if (accuracyBonus > 0) {
        breakdown.accuracy = accuracyBonus;
        totalXp += accuracyBonus;
      }
    }
  }
  
  return {
    total: Math.round(totalXp),
    breakdown
  };
}

/**
 * Award XP to a user
 */
export async function awardXp(
  userId: string,
  amount: number,
  reason: XpSource | string,
  details: any = {}
): Promise<{
  success: boolean;
  result?: XpAwardResult;
  leveledUp?: boolean;
  error?: any;
}> {
  try {
    // Match the parameter order from our SQL function
    const { data, error } = await supabase
      .rpc('award_xp', {
        p_user_id: userId,
        p_amount: amount,
        p_reason: reason,
        p_details: details
      });
    
    if (error) {
      throw error;
    }
    
    const result = data as XpAwardResult;
    
    return {
      success: true,
      result,
      leveledUp: result.leveled_up
    };
  } catch (error) {
    console.error('Error awarding XP:', error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Get a user's XP information
 */
export async function getUserXpInfo(userId: string): Promise<{
  success: boolean;
  xp?: number;
  level?: number;
  nextLevelXp?: number;
  progress?: number;
  tier?: string;
  error?: any;
}> {
  try {
    // Get the user's profile with XP and level
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    if (!profile) {
      return {
        success: false,
        error: 'Profile not found'
      };
    }
    
    // Get the current level's required XP
    const { data: currentLevel, error: currentLevelError } = await supabase
      .from('xp_levels')
      .select('required_xp, tier')
      .eq('level', profile.level)
      .single();
    
    if (currentLevelError) {
      throw currentLevelError;
    }
    
    // Get the next level's required XP
    const { data: nextLevels, error: nextLevelError } = await supabase
      .from('xp_levels')
      .select('required_xp')
      .eq('level', profile.level + 1)
      .single();
    
    if (nextLevelError && nextLevelError.code !== 'PGRST116') {
      // Real error (not just "no row found")
      throw nextLevelError;
    }
    
    // Calculate progress percentage to next level
    const currentXp = profile.xp;
    const currentLevelXp = currentLevel.required_xp;
    const nextLevelXp = nextLevels?.required_xp || Infinity;
    const xpForNextLevel = nextLevelXp - currentLevelXp;
    const xpProgress = currentXp - currentLevelXp;
    const progressPercentage = Math.min(
      100,
      Math.max(0, Math.round((xpProgress / xpForNextLevel) * 100))
    );
    
    return {
      success: true,
      xp: currentXp,
      level: profile.level,
      nextLevelXp,
      progress: progressPercentage,
      tier: currentLevel.tier || 'Unknown' // Use tier if available, fallback to 'Unknown'
    };
  } catch (error) {
    console.error('Error getting user XP info:', error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Get XP history for a user
 */
export async function getXpHistory(
  userId: string,
  limit: number = 10
): Promise<{
  success: boolean;
  transactions?: XpTransaction[];
  error?: any;
}> {
  try {
    const { data, error } = await supabase
      .from('xp_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    return {
      success: true,
      transactions: data as XpTransaction[]
    };
  } catch (error) {
    console.error('Error getting XP history:', error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Get info about all XP levels
 */
export async function getAllLevels(): Promise<{
  success: boolean;
  levels?: {
    level: number;
    required_xp: number;
    tier: string;
  }[];
  error?: any;
}> {
  try {
    const { data, error } = await supabase
      .from('xp_levels')
      .select('*')
      .order('level', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    return {
      success: true,
      levels: data
    };
  } catch (error) {
    console.error('Error getting levels info:', error);
    return {
      success: false,
      error
    };
  }
}