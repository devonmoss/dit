import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import { trainingLevels } from '../utils/levels';
import * as raceService from '../services/raceService';
import { RaceMode, RaceParticipant, RaceStage } from '../types/raceTypes';

interface UseRaceCreationOptions {
  getCurrentUser: () => any;
  getUserDisplayName: (user: any) => string;
  getMappedUserId: (userId: string, raceId?: string) => string;
  setRaceId: (id: string | null) => void;
  setRaceText: (text: string) => void;
  setRaceStatus: (status: string) => void;
  setRaceCreator: (id: string | null) => void;
  setInitialParticipants: (participants: RaceParticipant[]) => void;
  setRaceStage: (stage: RaceStage) => void;
  resetProgress: () => void;
  stopAudio: () => void;
  broadcastRedirect?: (newRaceId: string, initiatorName: string) => Promise<boolean>;
  state: {
    mode: string;
    chars: string[];
    selectedLevelId: string;
  };
  raceMode: RaceMode;
  raceId: string | null;
}

/**
 * Custom hook for race creation logic
 */
export const useRaceCreation = ({
  getCurrentUser,
  getUserDisplayName,
  getMappedUserId,
  setRaceId,
  setRaceText,
  setRaceStatus,
  setRaceCreator,
  setInitialParticipants,
  setRaceStage,
  resetProgress,
  stopAudio,
  broadcastRedirect,
  state,
  raceMode,
  raceId
}: UseRaceCreationOptions) => {
  const router = useRouter();
  const [isCreatingRace, setIsCreatingRace] = useState(false);

  /**
   * Create a new race
   */
  const createRace = useCallback(async (options?: { mode: RaceMode }) => {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      alert('Error creating anonymous user');
      return;
    }
    
    // For anonymous users, we need to create a UUID mapping before creating the race
    let createdById = currentUser.id;
    if (currentUser.id.startsWith('anon-')) {
      // Generate a proper UUID for anonymous users before creating the race
      createdById = getMappedUserId(currentUser.id);
    }
    
    // Determine race mode or use default (ensuring it's compatible with API)
    const mode = (options?.mode || state.mode) === 'race' ? 'copy' : (options?.mode || state.mode);
    
    // Generate random race text based on training level
    const chars = [...state.chars];
    let text = '';
    const textLength = 20; // Changed from 5 to 20 characters for racing
    
    // If no chars available, default to alphabet
    if (chars.length === 0) {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
      for (let i = 0; i < textLength; i++) {
        const randomIndex = Math.floor(Math.random() * alphabet.length);
        text += alphabet[randomIndex];
      }
    } else {
      for (let i = 0; i < textLength; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        text += chars[randomIndex];
      }
    }
    
    try {
      // Create race with the proper UUID
      const raceResult = await raceService.createRace({
        created_by: createdById, // Use the proper UUID for database compatibility
        mode: mode as 'copy' | 'send', // Type assertion to ensure API compatibility
        char_sequence: text.split(''),
        text: text,
        level_id: state.selectedLevelId
      });
      
      // Update local state
      setRaceId(raceResult.id);
      
      // IMPORTANT: For anonymous users, ensure we map this anonymous ID to the same UUID for this race
      if (currentUser.id.startsWith('anon-')) {
        // This ensures future getMappedUserId calls with this race ID return the same UUID
        getMappedUserId(currentUser.id, raceResult.id);
      }
      
      // After race creation, join race with the user's display name
      await raceService.joinRace(raceResult.id, {
        user_id: createdById,
        name: getUserDisplayName(currentUser)
      });
      
      // Update local state
      setRaceText(text);
      setRaceStatus('created');
      setRaceCreator(createdById);
      setInitialParticipants([{
        id: createdById,
        name: getUserDisplayName(currentUser),
        progress: 0,
        finished: false
      }]);
      
      // Move to share stage
      setRaceStage(RaceStage.SHARE);
      
      // Navigate to /race?id=race.id
      router.push(`/race?id=${raceResult.id}`);
      
    } catch (err) {
      console.error('Error creating race:', err);
      alert('Could not create race. Please try again.');
    }
  }, [
    getCurrentUser, 
    getUserDisplayName, 
    getMappedUserId, 
    state.chars, 
    state.selectedLevelId, 
    state.mode, 
    router, 
    setInitialParticipants,
    setRaceId,
    setRaceText,
    setRaceStatus,
    setRaceCreator,
    setRaceStage
  ]);

  /**
   * Create a new race after completing one
   */
  const handleRaceAgain = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Error creating race');
      return;
    }
    
    try {
      setIsCreatingRace(true);
      
      // Reset state for a new race
      stopAudio();
      resetProgress();
      
      // CRITICAL: Save current race ID before creating a new race - needed for broadcast
      const currentRaceId = raceId;
      
      // Generate new race text with the same parameters
      const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);
      const levelChars = currentLevel && currentLevel.chars.length > 0 ? 
        [...currentLevel.chars] : 
        state.chars.length > 0 ? [...state.chars] : 
        'abcdefghijklmnopqrstuvwxyz'.split('');
      
      const raceLength = 20;
      let text = '';
      
      for (let i = 0; i < raceLength; i++) {
        const randomIndex = Math.floor(Math.random() * levelChars.length);
        text += levelChars[randomIndex];
      }
      
      // Use getMappedUserId for consistent ID
      const createdById = getMappedUserId(currentUser.id, raceId || undefined);
      
      // IMPORTANT: First broadcast the redirect message to current race participants
      // BEFORE setting up the new race or changing any state
      // This ensures the channel for the old race is still active
      if (currentRaceId && broadcastRedirect) {
        const initiatorName = getUserDisplayName(currentUser);
        
        // Create the new race but don't set local state yet
        const raceResult = await raceService.createRace({
          created_by: createdById,
          mode: raceMode,
          char_sequence: text.split(''),
          text: text,
          level_id: state.selectedLevelId
        });
        
        const newRaceId = raceResult.id;
        
        // BROADCAST FIRST: Send notification to other participants about the new race
        // This happens while we're still on the old race page with the old channel active
        try {
          const broadcastSuccess = await broadcastRedirect(newRaceId, initiatorName);
          
          if (!broadcastSuccess) {
            console.warn('[Race Again] Broadcast failed - other users may not receive the invitation');
          }
          
          // Give time for the message to be delivered
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (broadcastError) {
          console.error('[Race Again] Error during broadcast:', broadcastError);
        }
        
        // Update local state
        setRaceId(newRaceId);
        
        // IMPORTANT: For anonymous users, ensure we map this anonymous ID to the same UUID for this race
        if (currentUser.id.startsWith('anon-')) {
          // This ensures future getMappedUserId calls with this race ID return the same UUID
          getMappedUserId(currentUser.id, newRaceId);
        }
        
        // Join race automatically through API
        await raceService.joinRace(newRaceId, {
          user_id: createdById,
          name: getUserDisplayName(currentUser)
        });
        
        // Set the race creator
        setRaceCreator(createdById);
        
        // Update local state
        setRaceText(text);
        setRaceStatus('created');
        setInitialParticipants([{
          id: createdById,
          name: getUserDisplayName(currentUser),
          progress: 0,
          finished: false
        }]);
        
        // Move to share stage
        setRaceStage(RaceStage.SHARE);
        
        // Navigate to new race with full page reload AFTER broadcast and state updates
        window.location.href = `/race?id=${newRaceId}`;
      } else {
        // Fallback: If no current race or broadcast function, just create new race normally
        console.warn('[Race Again] Unable to broadcast redirect - missing raceId or broadcastRedirect function');
        
        // Create race through API with the same parameters
        const raceResult = await raceService.createRace({
          created_by: createdById,
          mode: raceMode,
          char_sequence: text.split(''),
          text: text,
          level_id: state.selectedLevelId
        });
        
        // Update local state
        setRaceId(raceResult.id);
        
        // IMPORTANT: For anonymous users, ensure we map this anonymous ID to the same UUID for this race
        if (currentUser.id.startsWith('anon-')) {
          // This ensures future getMappedUserId calls with this race ID return the same UUID
          getMappedUserId(currentUser.id, raceResult.id);
        }
        
        // Join race automatically through API
        await raceService.joinRace(raceResult.id, {
          user_id: createdById,
          name: getUserDisplayName(currentUser)
        });
        
        // Update local state
        setRaceCreator(createdById);
        setRaceText(text);
        setRaceStatus('created');
        setInitialParticipants([{
          id: createdById,
          name: getUserDisplayName(currentUser),
          progress: 0,
          finished: false
        }]);
        
        // Move to share stage
        setRaceStage(RaceStage.SHARE);
        
        // Navigate to new race with full page reload
        window.location.href = `/race?id=${raceResult.id}`;
      }
    } catch (err) {
      console.error('[Race Again] Error creating race:', err);
      alert('Could not create race. Please try again.');
    } finally {
      setIsCreatingRace(false);
    }
  }, [
    getCurrentUser, 
    getUserDisplayName, 
    raceMode, 
    state.chars, 
    state.selectedLevelId, 
    stopAudio, 
    raceId, 
    getMappedUserId,
    broadcastRedirect,
    setInitialParticipants,
    resetProgress,
    setRaceId,
    setRaceText,
    setRaceStatus,
    setRaceCreator,
    setRaceStage
  ]);

  return {
    isCreatingRace,
    createRace,
    handleRaceAgain
  };
}; 