import { useState, useRef, useCallback, useEffect } from 'react';
import * as raceService from '../services/raceService';

interface RaceProgressOptions {
  raceId: string | null;
  raceText: string;
  raceStatus: string;
  broadcastProgress?: (progress: number, errorCount: number) => void;
  onComplete?: () => void;
  getMappedUserId: (userId: string) => string;
  getCurrentUser: () => { id: string } | null;
}

interface RaceProgressResult {
  userProgress: number;
  errorCount: number;
  currentCharIndex: number;
  latestProgressRef: React.RefObject<number>;
  pendingUpdateRef: React.RefObject<boolean>;
  lastActivityTimeRef: React.RefObject<number>;
  updateProgress: (progress: number, userId: string) => void;
  incrementProgress: (characterIndex: number, userId: string) => void;
  incrementErrorCount: () => void;
  resetProgress: () => void;
  checkInactivity: () => boolean;
}

/**
 * Hook for managing race progress, including throttled updates, 
 * activity tracking and error counting
 */
export function useRaceProgress({
  raceId,
  raceText,
  raceStatus,
  broadcastProgress,
  onComplete,
  getMappedUserId,
  getCurrentUser
}: RaceProgressOptions): RaceProgressResult {
  // Progress state
  const [userProgress, setUserProgress] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  
  // Reference to store the latest progress for database syncing
  const latestProgressRef = useRef<number>(0);
  // Track when we last sent a database update to avoid too many requests
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<boolean>(false);
  // Reference to track the last activity time
  const lastActivityTimeRef = useRef<number>(0);
  // Track if race is finished
  const raceFinishedRef = useRef<boolean>(false);

  // Update progress with throttling
  const updateProgress = useCallback((progress: number, userId: string) => {
    if (!raceId) return;
    
    const now = Date.now();
    // Only update if it's been more than 500ms since last update or if this is a forced update
    if (now - lastUpdateTimeRef.current > 500) {
      console.log('Sending throttled database update, progress:', progress, 'errors:', errorCount);
      
      // Call the race service to update progress
      raceService.updateProgress(raceId, userId, progress, errorCount)
        .then(() => {
          console.log('Progress updated successfully in database');
          
          // Update the last update timestamp
          lastUpdateTimeRef.current = now;
          pendingUpdateRef.current = false;
          
          // Also broadcast the update via the race channel if provided
          if (broadcastProgress) {
            broadcastProgress(progress, errorCount);
          }
          
          // Reset activity time
          lastActivityTimeRef.current = Date.now();
          
          // Check if the race is complete
          if (progress >= raceText.length && !raceFinishedRef.current) {
            console.log('Race completed in progress update');
            raceFinishedRef.current = true;
            if (onComplete) {
              onComplete();
            }
          }
        })
        .catch(error => {
          console.error('Error updating progress:', error);
        });
    } else {
      // If we're throttling, mark that we have a pending update
      pendingUpdateRef.current = true;
      console.log('Throttling update, will send in next batch');
    }
  }, [raceId, errorCount, broadcastProgress, raceText.length, onComplete]);

  // Increment progress at a specific character index
  const incrementProgress = useCallback((characterIndex: number, userId: string) => {
    // Calculate new progress percentage
    const newProgress = Math.round(((characterIndex + 1) / raceText.length) * 100);
    setUserProgress(newProgress);
    
    // Update latest progress reference for database syncing
    latestProgressRef.current = characterIndex + 1;
    
    // Move to next character
    setCurrentCharIndex(characterIndex + 1);
    
    // Mark that we have a new update, but let the throttling handle when to actually send it
    pendingUpdateRef.current = true;
    
    // Try to update, but the throttle mechanism will decide if it happens now or later
    updateProgress(characterIndex + 1, userId);
    
    // Reset activity time
    lastActivityTimeRef.current = Date.now();
  }, [raceText.length, updateProgress]);

  // Increment error count
  const incrementErrorCount = useCallback(() => {
    setErrorCount(prev => prev + 1);
  }, []);

  // Reset progress state
  const resetProgress = useCallback(() => {
    setUserProgress(0);
    setErrorCount(0);
    setCurrentCharIndex(0);
    latestProgressRef.current = 0;
    raceFinishedRef.current = false;
    lastActivityTimeRef.current = Date.now();
  }, []);

  // Check for inactivity and return true if the race is inactive
  const checkInactivity = useCallback(() => {
    if (raceStatus !== 'racing') return false;
    
    const now = Date.now();
    const inactiveTime = now - lastActivityTimeRef.current;
    const inactivityThreshold = 10000; // 10 seconds
    
    return inactiveTime > inactivityThreshold;
  }, [raceStatus]);

  // Set up a timer to periodically update database if throttled updates are pending
  useEffect(() => {
    if (!raceId || raceStatus !== 'racing') return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const intervalId = setInterval(() => {
      // Check if we have pending updates
      if (pendingUpdateRef.current && latestProgressRef.current > 0) {
        const userId = getMappedUserId(currentUser.id);
        console.log('Sending periodic update for throttled progress:', latestProgressRef.current);
        updateProgress(latestProgressRef.current, userId);
      }
    }, 500); // Check every 500ms to match the throttle time
    
    return () => {
      clearInterval(intervalId);
      
      // Do a final update when unmounting if we have pending changes
      if (pendingUpdateRef.current && latestProgressRef.current > 0) {
        const userId = getMappedUserId(currentUser.id);
        console.log('Sending final update before unmounting:', latestProgressRef.current);
        updateProgress(latestProgressRef.current, userId);
      }
    };
  }, [raceId, raceStatus, updateProgress, getCurrentUser, getMappedUserId]);

  // Initialize the activity timer when race transitions to racing state
  useEffect(() => {
    if (raceStatus === 'racing') {
      lastActivityTimeRef.current = Date.now();
      console.log('Race started/status changed - initializing activity timer');
    }
  }, [raceStatus]);

  return {
    userProgress,
    errorCount,
    currentCharIndex,
    latestProgressRef,
    pendingUpdateRef,
    lastActivityTimeRef,
    updateProgress,
    incrementProgress,
    incrementErrorCount,
    resetProgress,
    checkInactivity
  };
} 