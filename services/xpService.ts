// XP-related API functions
import { XpSource } from '../utils/xpSystem';

// Award XP to a user
export async function awardXp(
  userId: string,
  amount: number,
  source: XpSource,
  metadata: Record<string, any>
) {
  const response = await fetch('/api/xp/award', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      amount,
      source,
      metadata
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to award XP');
  }
  
  return response.json();
}

// Get user XP information
export async function getUserXp(userId: string) {
  const response = await fetch(`/api/xp/${userId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user XP');
  }
  
  return response.json();
}