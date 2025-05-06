import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AnonymousUser, User } from '../types/raceTypes';
import { isBrowser } from '../utils/morse';

type AnonIdMap = {[key: string]: string};

/**
 * Hook to manage anonymous users and user ID mapping for races
 * 
 * @param authenticatedUser - The authenticated user from auth context, if available
 */
export const useAnonymousUser = (authenticatedUser: User | null) => {
  const [anonymousUser, setAnonymousUser] = useState<AnonymousUser | null>(null);
  const anonUserIdMapRef = useRef<AnonIdMap>({});
  
  // Initialize anonymous user mapping from localStorage
  useEffect(() => {
    if (isBrowser) {
      // Check for stored UUID mapping
      const storedMapping = localStorage.getItem('morse_anon_user_uuid_map');
      if (storedMapping) {
        try {
          anonUserIdMapRef.current = JSON.parse(storedMapping);
        } catch (e) {
          console.error('Error parsing stored anonymous user mapping:', e);
        }
      }
    }
  }, []);
  
  // Get current user - authenticated or anonymous
  const getCurrentUser = useCallback(() => {
    if (authenticatedUser) return authenticatedUser;
    
    // Create anonymous user if not created yet
    if (!anonymousUser) {
      // Use a consistent approach for anonymous users to prevent hydration mismatches
      let anonUserId = '';
      let anonUserName = '';
      
      // Only access localStorage on the client side
      if (isBrowser) {
        // Try to get existing anonymous user ID from localStorage
        anonUserId = localStorage.getItem('morse_anon_user_id') || '';
        anonUserName = localStorage.getItem('morse_anon_user_name') || '';
        
        // If no existing ID, create a new one and store it
        if (!anonUserId) {
          anonUserId = `anon-${Math.random().toString(36).substring(2, 10)}`;
          anonUserName = `Anonymous-${Math.floor(Math.random() * 1000)}`;
          localStorage.setItem('morse_anon_user_id', anonUserId);
          localStorage.setItem('morse_anon_user_name', anonUserName);
        }
      } else {
        // For server-side rendering, use a consistent placeholder
        // This will be replaced with the localStorage value on client
        anonUserId = 'anon-user';
        anonUserName = 'Anonymous';
      }
      
      const newAnonymousUser: AnonymousUser = {
        id: anonUserId,
        email: anonUserName,
        user_metadata: { full_name: anonUserName }
      };
      setAnonymousUser(newAnonymousUser);
      return newAnonymousUser;
    }
    
    return anonymousUser;
  }, [authenticatedUser, anonymousUser]);
  
  // Helper function to get display name for a user
  const getUserDisplayName = useCallback((user: User | any) => {
    if (!user) return 'Anonymous';
    return user.user_metadata?.username || user.user_metadata?.full_name || 'Anonymous';
  }, []);
  
  // Get the user ID to use for display or database operations
  const getMappedUserId = useCallback((userId: string, raceId?: string) => {
    // If it's not an anonymous ID, just return as is
    if (!userId.startsWith('anon-')) {
      return userId;
    }
    
    // For race-specific lookups
    if (raceId && isBrowser) {
      // Check for an existing race-specific mapping in localStorage
      const raceParticipantKey = `morse_race_${raceId}_participant_${userId}`;
      const existingRaceMapping = localStorage.getItem(raceParticipantKey);
      
      if (existingRaceMapping) {
        // Use the race-specific ID and ensure it's in the global map too
        anonUserIdMapRef.current[userId] = existingRaceMapping;
        return existingRaceMapping;
      }
    }
    
    // For anonymous users, check if we have a mapping in memory
    if (anonUserIdMapRef.current[userId]) {
      // If we're in a race, store this mapping as race-specific
      if (raceId && isBrowser) {
        const raceParticipantKey = `morse_race_${raceId}_participant_${userId}`;
        localStorage.setItem(raceParticipantKey, anonUserIdMapRef.current[userId]);
      }
      
      return anonUserIdMapRef.current[userId];
    }
    
    // If no mapping exists, create one
    const newUuid = uuidv4();
    anonUserIdMapRef.current[userId] = newUuid;
    
    // Store in localStorage for persistence
    if (isBrowser) {
      // If race ID is provided, store a race-specific mapping
      if (raceId) {
        const raceParticipantKey = `morse_race_${raceId}_participant_${userId}`;
        localStorage.setItem(raceParticipantKey, newUuid);
      }
      
      // Update the overall mapping
      localStorage.setItem('morse_anon_user_uuid_map', 
        JSON.stringify(anonUserIdMapRef.current));
    }
    
    return newUuid;
  }, []);
  
  // Check if the current user is anonymous
  const isAnonymousUser = useCallback(() => {
    const currentUser = getCurrentUser();
    return currentUser ? currentUser.id.startsWith('anon-') : true;
  }, [getCurrentUser]);
  
  // Initialize anonymous user on client side
  useEffect(() => {
    if (!authenticatedUser && isBrowser) {
      getCurrentUser();
    }
  }, [authenticatedUser, getCurrentUser]);
  
  return {
    anonymousUser,
    getCurrentUser,
    getUserDisplayName,
    getMappedUserId,
    isAnonymousUser,
    anonUserIdMap: anonUserIdMapRef.current
  };
}; 