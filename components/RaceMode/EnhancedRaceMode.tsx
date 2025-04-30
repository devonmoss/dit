import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from './RaceMode.module.css';
import { createAudioContext, isBrowser } from '../../utils/morse';
import supabase from '../../utils/supabase'; // Still needed for realtime channels
import { useMorseAudio } from '../../hooks/useMorseAudio';
import { useAppState } from '../../contexts/AppStateContext';
import useAuth from '../../hooks/useAuth';
import RaceInfo from '../RaceInfo/RaceInfo';
import RaceShareUI from '../RaceShareUI/RaceShareUI';
import RaceParticipants from '../RaceParticipants/RaceParticipants';
import CountdownTimer from '../CountdownTimer/CountdownTimer';
import { trainingLevels } from '../../utils/levels';
import { v4 as uuidv4 } from 'uuid';
import { calculateRaceXp, XpSource } from '../../utils/xpSystem';
import * as raceService from '../../services/raceService';
import * as xpService from '../../services/xpService';

// Utility type for suppressing eslint errors
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface RaceParticipant {
  id: string;
  name: string;
  progress: number;
  finished: boolean;
  finishTime?: number;
  errorCount?: number;
  raceTime?: number; // Duration in seconds
}

// No unused empty functions
/* eslint-disable @typescript-eslint/no-unused-vars */
// Message type for WebSocket participant updates (for future implementation)
interface ParticipantUpdateMessage {
  type: 'progress_update' | 'finish_race';
  user_id: string;
  race_id: string;
  progress: number;
  finished?: boolean;
  finish_time?: number;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

enum RaceStage {
  INFO = 'info',
  SHARE = 'share',
  COUNTDOWN = 'countdown',
  RACING = 'racing',
  RESULTS = 'results'
}

// Type for anonymous user
interface AnonymousUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

// Race mode selector component
const RaceModeSelector: React.FC<{
  onSelectMode: (mode: 'copy' | 'send') => void;
  selectedMode: 'copy' | 'send';
}> = ({ onSelectMode, selectedMode }) => {
  return (
    <div className={styles.raceModeSelector}>
      <h3>Select Race Mode</h3>
      <div className={styles.modeButtonsContainer}>
        <button 
          className={`${styles.modeButton} ${selectedMode === 'copy' ? styles.selectedMode : ''}`}
          onClick={() => onSelectMode('copy')}
        >
          <h4>Copy Mode</h4>
          <p>Identify the characters you hear</p>
        </button>
        <button 
          className={`${styles.modeButton} ${selectedMode === 'send' ? styles.selectedMode : ''}`}
          onClick={() => onSelectMode('send')}
        >
          <h4>Send Mode</h4>
          <p>Send the characters you see</p>
        </button>
      </div>
    </div>
  );
};

const EnhancedRaceMode: React.FC = () => {
  const router = useRouter();
  const { id: queryId } = router.query;
  const { state } = useAppState();
  const { user, refreshXpInfo } = useAuth();
  const { playMorseCode, playMorseChar, stopAudio } = useMorseAudio();
  
  // Initialize audio context on client-side only
  const [audioContext, setAudioContext] = useState<ReturnType<typeof createAudioContext> | null>(null);
  useEffect(() => {
    if (isBrowser) {
      setAudioContext(createAudioContext());
    }
  }, []);
  
  // Race state
  const [raceId, setRaceId] = useState<string | null>(null);
  const [raceStage, setRaceStage] = useState<RaceStage>(RaceStage.INFO);
  const [raceText, setRaceText] = useState('');
  const [raceMode, setRaceMode] = useState<'copy' | 'send'>(state.mode === 'copy' || state.mode === 'send' ? state.mode : 'copy');
  const [raceStatus, setRaceStatus] = useState<string>('created');
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  // Presence state for connected participants
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [userProgress, setUserProgress] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [finishTime, setFinishTime] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [userInput, setUserInput] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [xpEarned, setXpEarned] = useState<{ total: number, breakdown: Record<string, number> } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [leveledUp, setLeveledUp] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const [anonymousUser, setAnonymousUser] = useState<AnonymousUser | null>(null);
  
  // Reference to store the latest progress for database syncing
  const latestProgressRef = useRef<number>(0);
  // Track when we last sent a database update to avoid too many requests
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<boolean>(false);
  const raceFinishedRef = useRef<boolean>(false);
  
  // First, add a state for the visual feedback
  const [showCorrectIndicator, setShowCorrectIndicator] = useState(false);
  
  // Add a reference to store the mapped anonymous user IDs
  const anonUserIdMapRef = useRef<{[key: string]: string}>({});
  
  // Add a reference to store the updateProgress function
  const updateProgressRef = useRef<((progress: number) => void) | null>(null);
  
  // Add a reference to track the last activity time
  const lastActivityTimeRef = useRef<number>(0);
  
  // Add a reference to track the inactivity check interval
  const inactivityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // For send mode with arrow keys (similar to SendingMode)
  const keyStateRef = useRef({ ArrowLeft: false, ArrowRight: false });
  const [keyerOutput, setKeyerOutput] = useState('');
  const sendQueueRef = useRef<string[]>([]);
  
  // Define a proper type for user to avoid type errors
  type User = {
    id: string;
    user_metadata?: {
      username?: string;
      full_name?: string;
    };
  };
  
  // Helper function to get display name for a user
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const getUserDisplayName = useCallback((user: User | any) => {
    if (!user) return 'Anonymous';
    return user.user_metadata?.username || user.user_metadata?.full_name || 'Anonymous';
  }, []);
  
  // Throttled function to update the database - only sends updates every 500ms at most
  const updateProgressInDatabase = useCallback((progress: number, userId: string) => {
    if (!raceId) return;
    
    // For anonymous users, use the mapped UUID
    let dbUserId = userId;
    if (userId.startsWith('anon-') && anonUserIdMapRef.current[userId]) {
      dbUserId = anonUserIdMapRef.current[userId];
    }
    
    const now = Date.now();
    // Only update if it's been more than 500ms since last update or if progress has changed significantly
    if (now - lastUpdateTimeRef.current > 500) {
      console.log('Sending throttled database update, progress:', progress, 'errors:', errorCount);
      
      // Call API endpoint to update progress
      raceService.updateProgress(raceId, dbUserId, progress, errorCount)
        .catch(error => {
          console.error('Error updating progress:', error);
        });
        
      // Update the last update timestamp
      lastUpdateTimeRef.current = now;
      pendingUpdateRef.current = false;
    } else {
      // If we're throttling, mark that we have a pending update
      pendingUpdateRef.current = true;
    }
  }, [raceId, errorCount]);
  
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
  
  // Modify the anonymous user handling
  const getCurrentUser = useCallback(() => {
    if (user) return user;
    
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
  }, [user, anonymousUser]);
  
  // Use effect to initialize anonymous user on client side
  useEffect(() => {
    if (!user && isBrowser) {
      getCurrentUser();
    }
  }, [user, getCurrentUser]);
  
  // Add a state to track race creator
  const [raceCreator, setRaceCreator] = useState<string | null>(null);
  
  // Modify the joinRace function to handle anonymous user persistence
  const joinRace = useCallback(async (raceId: string) => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
      console.log('Joining race:', raceId, 'as user:', currentUser.id);
      
      // For anonymous users, generate a consistent UUID
      let participantUserId = currentUser.id;
      if (currentUser.id.startsWith('anon-')) {
        // Check for stored UUID for this race in localStorage first
        const raceParticipantKey = `morse_race_${raceId}_participant_${currentUser.id}`;
        let storedUuid = '';
        
        if (isBrowser) {
          storedUuid = localStorage.getItem(raceParticipantKey) || '';
        }
        
        if (storedUuid) {
          // Use the stored UUID
          console.log('Using stored UUID for anonymous user:', storedUuid);
          participantUserId = storedUuid;
          // Update the ref map
          anonUserIdMapRef.current[currentUser.id] = storedUuid;
        } else {
          // Check if we already have a UUID for this anonymous user
          if (!anonUserIdMapRef.current[currentUser.id]) {
            // Generate a new UUID and store it
            const newUuid = uuidv4();
            anonUserIdMapRef.current[currentUser.id] = newUuid;
            
            // Store in localStorage for persistence
            if (isBrowser) {
              localStorage.setItem(raceParticipantKey, newUuid);
              // Also update the overall mapping
              localStorage.setItem('morse_anon_user_uuid_map', 
                JSON.stringify(anonUserIdMapRef.current));
            }
          }
          participantUserId = anonUserIdMapRef.current[currentUser.id];
        }
      }
      
      // Get race details from API
      const race = await raceService.getRaceDetails(raceId);
      console.log('Race data retrieved:', race);
      
      // Store the race creator
      if (race.created_by) {
        setRaceCreator(race.created_by);
      }
      
      // Set race text and mode
      setRaceText(race.text || '');
      setRaceMode(race.mode || 'copy');
      
      // Set race status - ENSURE we set to 'created' if the race hasn't actually started
      if (race.status === 'countdown' || race.status === 'racing' || race.status === 'finished') {
        setRaceStatus(race.status);
      } else {
        // Default to 'created' for any other status or if status is not set
        setRaceStatus('created');
      }
      
      // Join the race through API
      const joinResult = await raceService.joinRace(raceId, {
        user_id: participantUserId,
        name: getUserDisplayName(currentUser)
      });
      
      if (joinResult.participants) {
        console.log('All participants:', joinResult.participants);
        
        // Find this user's participant data
        const userParticipant = joinResult.participants.find(
          (p: { user_id: string; progress?: number; finished?: boolean; finish_time?: number; error_count?: number; race_time?: number }) => 
            p.user_id === participantUserId
        );
        
        // If this user already participated and has progress or is finished
        if (userParticipant) {
          if (userParticipant.finished) {
            console.log('User already finished the race - showing results');
            // Set user progress and mark as finished
            setUserProgress(100);
            raceFinishedRef.current = true;
            setFinishTime(userParticipant.finish_time);
            setStartTime(race.start_time);
            setErrorCount(userParticipant.error_count || 0);
            // Set character index to the end
            setCurrentCharIndex(race.text?.length || 0);
          } else if (userParticipant.progress > 0) {
            console.log('User has existing progress:', userParticipant.progress);
            // Restore user progress
            const progressPercent = Math.round((userParticipant.progress / (race.text?.length || 1)) * 100);
            setUserProgress(progressPercent);
            latestProgressRef.current = userParticipant.progress;
            // Set character index to their progress
            setCurrentCharIndex(userParticipant.progress);
            setErrorCount(userParticipant.error_count || 0);
          }
        }
        
        setParticipants(joinResult.participants.map((p: { 
          user_id: string; 
          name?: string; 
          progress?: number; 
          finished?: boolean; 
          finish_time?: number; 
          error_count?: number; 
          race_time?: number 
        }) => ({
          id: p.user_id,
          name: p.name || 'Anonymous',
          progress: p.progress || 0,
          finished: p.finished || false,
          finishTime: p.finish_time,
          errorCount: p.error_count || 0,
          raceTime: p.race_time
        })));
      }
      
      // Check race status and update the UI stage accordingly
      if (race.status === 'countdown') {
        setRaceStage(RaceStage.COUNTDOWN);
        setRaceStatus('countdown');
      } else if (race.status === 'racing') {
        setRaceStage(RaceStage.RACING);
        setRaceStatus('racing');
        setStartTime(race.start_time);
      } else if (race.status === 'finished') {
        setRaceStage(RaceStage.RESULTS);
        setRaceStatus('finished');
        stopAudio();
      } else {
        // Default to share stage if status is not set or in 'created' state
        setRaceStage(RaceStage.SHARE);
      }
      
    } catch (err) {
      console.error('Error joining race:', err);
      alert('Could not join race. Please try again.');
    }
  }, [getCurrentUser, getUserDisplayName, stopAudio]);
  
  // Initialize race ID from URL if present
  useEffect(() => {
    if (queryId && typeof queryId === 'string' && !raceId) {
      // Set race ID and join the race
      setRaceId(queryId);
      joinRace(queryId);
      setRaceStage(RaceStage.SHARE);
    }
  // Only depend on queryId to prevent re-joining when raceId changes for other reasons
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId]);

  // Add separate effect to clear query parameter when going to INFO stage
  useEffect(() => {
    if (raceStage === RaceStage.INFO && router.query.id) {
      // Remove race ID from URL without full navigation
      const newUrl = window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      // Also clear the router's query object
      router.replace(router.pathname, undefined, { shallow: true });
    }
  }, [raceStage, router]);
  
  // Set up and clean up the channel subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    // Only set up a channel if we have a race ID
    const currentUser = getCurrentUser();
    if (raceId && currentUser) {
      console.log('Setting up realtime channel for race:', raceId, 'user:', currentUser.id);
      
      // Get the mapped UUID for anonymous users
      let presenceUserId = currentUser.id;
      if (currentUser.id.startsWith('anon-')) {
        // Check if we already have a UUID for this anonymous user
        if (!anonUserIdMapRef.current[currentUser.id]) {
          // Generate a new UUID and store it
          anonUserIdMapRef.current[currentUser.id] = uuidv4();
        }
        presenceUserId = anonUserIdMapRef.current[currentUser.id];
      }
      
      // Open a realtime channel with presence enabled
      channel = supabase.channel(`race_${raceId}`, {
        config: { 
          broadcast: { self: true },
          presence: { key: presenceUserId }
        }
      });
      
      // Send progress updates via broadcast
      const updateProgress = (progress: number) => {
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'progress_update',
            payload: {
              user_id: currentUser.id,
              progress,
              errorCount
            }
          });
        }
      };
      
      // Store the function in a ref for access elsewhere
      updateProgressRef.current = updateProgress;
      
      // Listen for broadcast events
      channel.on('broadcast', { event: 'progress_update' }, (payload) => {
        const { user_id, progress, errorCount } = payload;
        
        // Update last activity time when progress is received
        lastActivityTimeRef.current = Date.now();
        
        // Update local participant state without database calls
        setParticipants(prev => 
          prev.map(p => p.id === user_id ? { ...p, progress, errorCount } : p)
        );
      });
      
      // Listen for race status changes
      channel
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'races',
          filter: `id=eq.${raceId}`
        }, (payload: { new: AnyRecord }) => {
          console.log('Race update received:', payload);
          // Handle race state changes
          const race = payload.new;
          
          if (!race) return;
          
          // Update UI immediately based on race status
          if (race.status === 'countdown') {
            setRaceStage(RaceStage.COUNTDOWN);
            setRaceStatus('countdown');
          } else if (race.status === 'racing') {
            setRaceStage(RaceStage.RACING);
            setRaceStatus('racing');
            setStartTime(race.start_time);
            
            // Reset last activity time when race starts
            lastActivityTimeRef.current = Date.now();
          } else if (race.status === 'finished') {
            setRaceStage(RaceStage.RESULTS);
            setRaceStatus('finished');
            stopAudio();
          }
        })
        // Listen for participant changes via database
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'race_participants',
          filter: `race_id=eq.${raceId}`
        }, async (payload: { new: AnyRecord }) => {
          console.log('Participant database change:', payload);
          
          // Extract the changed participant data directly from the payload
          const changedParticipant = payload.new;
          
          if (!changedParticipant) return;
          
          // Update participants state directly from the payload data without making a GET request
          setParticipants(prev => {
            // Check if this participant already exists in our state
            const participantExists = prev.some(p => p.id === changedParticipant.user_id);
            
            // Update last activity time when participant data changes
            if (changedParticipant.progress > 0) {
              lastActivityTimeRef.current = Date.now();
            }
            
            let updatedParticipants;
            
            if (participantExists) {
              // Update existing participant
              updatedParticipants = prev.map(p => {
                if (p.id === changedParticipant.user_id) {
                  return {
                    ...p,
                    progress: changedParticipant.progress || 0,
                    finished: changedParticipant.finished || false,
                    finishTime: changedParticipant.finish_time,
                    errorCount: changedParticipant.error_count || 0,
                    raceTime: changedParticipant.race_time
                  };
                }
                return p;
              });
            } else {
              // This is a new participant, add them to the array
              updatedParticipants = [
                ...prev,
                {
                  id: changedParticipant.user_id,
                  name: changedParticipant.name || 'Anonymous',
                  progress: changedParticipant.progress || 0,
                  finished: changedParticipant.finished || false,
                  finishTime: changedParticipant.finish_time,
                  errorCount: changedParticipant.error_count || 0,
                  raceTime: changedParticipant.race_time
                }
              ];
            }
            
            // If this was a finish update, check if all participants are now finished
            if (changedParticipant.finished) {
              const allFinished = updatedParticipants.every(p => p.finished);
              
              if (allFinished) {
                console.log('All participants finished! Updating race status.');
                // Update race status using API
                raceService.updateRaceStatus(raceId, 'finished')
                  .catch(error => {
                    console.error('Error updating race status to finished:', error);
                  });
              }
            }
            
            return updatedParticipants;
          });
        });
      
      // Presence: sync, join, and leave events (Supabase JS v2)
      if (channel) {
        channel
          .on('presence', { event: 'sync' }, () => {
            if (!channel) return;
            const state = channel.presenceState();
            
            // state values are arrays of metadata objects
            // Safely type and process the presence state
            type PresenceState = Record<string, any[]>;
            const typedState = state as PresenceState;
            
            const users: AnyRecord[] = [];
            
            // Loop through the state keys and values to extract users
            Object.keys(typedState).forEach(key => {
              const presences = typedState[key];
              if (Array.isArray(presences) && presences.length > 0) {
                users.push(presences[0]);
              }
            });
            
            setOnlineUsers(users);
          })
          .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: Array<AnyRecord> }) => {
            // newPresences is an array of metadata objects
            setOnlineUsers((prev: AnyRecord[]) => [...prev, ...newPresences]);
          })
          .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<AnyRecord> }) => {
            // leftPresences is an array of metadata objects
            setOnlineUsers((prev: AnyRecord[]) => prev.filter(u => !leftPresences.some((l: AnyRecord) => l.user_id === u.user_id)));
          });
      }

      // Subscribe to presence and then announce ourselves once joined
      channel?.subscribe((status: string) => {
        console.log('Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Channel subscribed, tracking presence for user:', presenceUserId);
          channel?.track({ 
            user_id: presenceUserId, 
            name: getUserDisplayName(currentUser)
          });
        } else if (status === 'SUBSCRIPTION_ERROR') {
          console.error('Channel subscription error - check Supabase credentials and connection');
        } else if (status === 'CLOSED') {
          console.log('Channel closed');
        } else if (status === 'TIMED_OUT') {
          console.error('Channel subscription timed out');
        }
      });
      channelRef.current = channel;
      
      console.log('Channel reference set:', channelRef.current);
    }
    
    // Clean up the subscription when unmounting or when race ID changes
    return () => {
      if (channel) {
        console.log('Removing channel for race:', raceId);
        supabase.removeChannel(channel);
      }
      stopAudio();
    };
  }, [raceId, getCurrentUser, playMorseCode, stopAudio, getUserDisplayName, playMorseChar]);
  
  // Create a new race
  const createRace = useCallback(async (options?: { mode: 'copy' | 'send' }) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Error creating anonymous user');
      return;
    }
    
    // Get the selected mode or default to 'copy'
    const mode = options?.mode || 'copy';
    setRaceMode(mode);
    
    // Generate random race text based on current level
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
    
    try {
      // For the created_by field, ensure we use a valid UUID
      // If it's an anonymous user, generate a UUID instead of using their anon-ID
      const createdById = currentUser.id.startsWith('anon-') ? uuidv4() : currentUser.id;
      
      // Set the race creator
      setRaceCreator(createdById);
      
      // Create race through API
      const race = await raceService.createRace({
        created_by: createdById,
        mode: mode,
        char_sequence: text.split(''),
        text: text,
        level_id: state.selectedLevelId
      });
      
      // For the user_id in race_participants, also use UUID for anonymous users
      const participantUserId = currentUser.id.startsWith('anon-') ? createdById : currentUser.id;
      
      // Join race automatically through API
      const joinResult = await raceService.joinRace(race.id, {
        user_id: participantUserId,
        name: getUserDisplayName(currentUser)
      });
      
      // Update local state
      setRaceId(race.id);
      setRaceText(text);
      setRaceStatus('created'); // Make sure status is set to created
      setParticipants([{
        id: participantUserId,
        name: getUserDisplayName(currentUser),
        progress: 0,
        finished: false
      }]);
      
      // Move to share stage
      setRaceStage(RaceStage.SHARE);
      
      // Navigate to /race?id=race.id
      router.push(`/race?id=${race.id}`);
      
    } catch (err) {
      console.error('Error creating race:', err);
      alert('Could not create race. Please try again.');
    }
  }, [getCurrentUser, state.chars, state.selectedLevelId, router, getUserDisplayName]);
  
  // Start the race
  const startRace = useCallback(async () => {
    if (!raceId) return;
    
    try {
      // Update race status to countdown through API
      await raceService.startRaceCountdown(raceId);
      
      setRaceStage(RaceStage.COUNTDOWN);
      setRaceStatus('countdown');
      setCountdownSeconds(5);
      
    } catch (err) {
      console.error('Error starting race:', err);
    }
  }, [raceId]);
  
  // Start racing after countdown
  const startRacing = useCallback(async () => {
    if (!raceId) return;
    
    try {
      const startTime = Date.now();
      
      // Begin racing through API
      await raceService.beginRacing(raceId);
      
      setRaceStage(RaceStage.RACING);
      setRaceStatus('racing');
      setStartTime(startTime);
      setUserInput('');
      
      // Start playing just the first character
      // setCurrentCharIndex(0);
      // if (raceText && raceText.length > 0) {
      //   console.log('Playing first character: ', raceText[0]);
      //   playMorseChar(raceText[0]);
      // }
      
    } catch (err) {
      console.error('Error starting race:', err);
    }
  }, [raceId, raceText, playMorseChar]);
  
  // Finish the race for a user
  const finishRace = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !raceId || !startTime) return;
    
    // Prevent multiple executions
    if (raceFinishedRef.current) {
      console.log('Race already finished, preventing duplicate execution');
      return;
    }
    raceFinishedRef.current = true;
    
    const endTime = Date.now();
    setFinishTime(endTime);
    
    // Calculate race duration in seconds
    const raceDuration = (endTime - startTime) / 1000;
    
    // For anonymous users, use the mapped UUID
    let dbUserId = currentUser.id;
    if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
      dbUserId = anonUserIdMapRef.current[currentUser.id];
    }
    
    try {
      console.log('User finished race - updating final state');
      
      // Finish race through API
      await raceService.finishRace(raceId, dbUserId, {
        finish_time: endTime,
        error_count: errorCount,
        race_time: raceDuration
      });
      
      console.log('Race finish state persisted to database');
      
      // Award XP for race completion (only for authenticated users)
      if (user && !currentUser.id.startsWith('anon-')) {
        // Get list of participants to determine position
        const raceParticipants = await raceService.getRaceParticipants(raceId);
        
        if (raceParticipants && raceParticipants.length > 0) {
          // Find user's position (sort by race_time ascending)
          const sortedParticipants = [...raceParticipants].sort((a, b) => 
            (a.race_time || Infinity) - (b.race_time || Infinity)
          );
          const userPosition = sortedParticipants.findIndex(p => p.user_id === user.id) + 1;
          
          // Check if this is a personal best
          const isPersonalBest = false; // TODO: Implement personal best detection
          
          // Calculate XP using the function
          const xpResult = calculateRaceXp(
            raceText.length,  // Correct chars
            errorCount,       // Mistake count
            true,             // Completed
            userPosition,     // Position
            raceParticipants.length,  // Total participants
            isPersonalBest   // Is personal best
          );
          
          // Store XP earned for display in results
          setXpEarned(xpResult);
          
          // Award XP
          if (xpResult.total > 0) {
            try {
              const result = await xpService.awardXp(
                user.id,
                xpResult.total,
                XpSource.RACE,
                {
                  race_id: raceId,
                  position: userPosition,
                  total_participants: raceParticipants.length,
                  mode: raceMode,
                  chars_completed: raceText.length,
                  mistakes: errorCount,
                  race_time: raceDuration,
                  xp_breakdown: xpResult.breakdown
                }
              );
              
              // If refreshXpInfo is available (should be passed from useAuth), use it
              if (refreshXpInfo) {
                await refreshXpInfo();
                
                // Show XP animation
                setShowXpAnimation(true);
                setTimeout(() => setShowXpAnimation(false), 3000);
                
                // Check if user leveled up
                if (result?.leveledUp) {
                  setLeveledUp(true);
                }
              }
            } catch (xpError) {
              console.error('Error awarding XP:', xpError);
              // Still show XP animation even if there was an error with the API
              setShowXpAnimation(true);
              setTimeout(() => setShowXpAnimation(false), 3000);
            }
          }
        }
      }
      
      // Check if all participants are finished - we can rely on the database for this
      // Once finished state is detected by each client via postgres_changes, they'll update UI accordingly
    } catch (err) {
      console.error('Error finishing race:', err);
    }
  }, [raceId, startTime, getCurrentUser, raceText.length, errorCount, user, raceMode, refreshXpInfo]);
  
  // Handle user input during race 
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (raceStage !== RaceStage.RACING) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const value = e.target.value;
    setUserInput(value);
    
    // Count correct characters
    let correctCount = 0;
    for (let i = 0; i < value.length && i < raceText.length; i++) {
      if (value[i] === raceText[i]) {
        correctCount++;
      }
    }
    
    // Calculate progress percentage
    const progress = Math.round((correctCount / raceText.length) * 100);
    setUserProgress(progress);
    console.log(`Progress updated: ${correctCount}/${raceText.length} (${progress}%)`);
    
    // Update latest progress reference for database syncing
    latestProgressRef.current = correctCount;
    
    // Check if user has entered the current character correctly
    if (value.length > 0 && value.length <= raceText.length) {
      // Only check the last character entered
      const lastCharIndex = value.length - 1;
      
      if (lastCharIndex >= 0 && lastCharIndex === currentCharIndex && value[lastCharIndex] === raceText[lastCharIndex]) {
        // User entered current character correctly
        // Play the next character if there is one
        const nextCharIndex = currentCharIndex + 1;
        setCurrentCharIndex(nextCharIndex);
        
        // Send progress update by updating the database - realtime changes will propagate to all clients
        if (raceId && channelRef.current) {
          // Update our progress reference
          latestProgressRef.current = correctCount;
          
          // Mark that we have a new update, but let the throttling handle when to actually send it
          pendingUpdateRef.current = true;
          
          // Get the mapped ID for anonymous users
          let userId = currentUser.id;
          if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
            userId = anonUserIdMapRef.current[currentUser.id];
          }
          
          // Try to update, but the throttle mechanism will decide if it happens now or later
          updateProgressInDatabase(correctCount, userId);
          
          // Also broadcast for immediate UI updates
          if (updateProgressRef.current) updateProgressRef.current(correctCount);
        }
        
        if (nextCharIndex < raceText.length) {
          playMorseChar(raceText[nextCharIndex]);
        }
      } else if (value.length > userInput.length && lastCharIndex === currentCharIndex && value[lastCharIndex] !== raceText[lastCharIndex]) {
        // User entered an incorrect character - play error sound and replay the current character
        // Only trigger this when a new character is added (to avoid repeating for each keystroke)
        if (audioContext) {
          audioContext.playErrorSound().then(() => {
            // Short delay before replaying the character
            setTimeout(() => {
              if (currentCharIndex < raceText.length) {
                playMorseChar(raceText[currentCharIndex]);
              }
            }, 750); // Match the delay used in training mode
          }).catch(err => {
            console.error("Error playing error sound:", err);
            // Even if error sound fails, still replay the character
            setTimeout(() => {
              if (currentCharIndex < raceText.length) {
                playMorseChar(raceText[currentCharIndex]);
              }
            }, 750);
          });
        }
      }
    }
    
    // Check if user has completed the race
    if (correctCount === raceText.length && raceId) {
      finishRace();
      stopAudio();
    }
    
    // Count errors
    let errors = 0;
    for (let i = 0; i < value.length && i < raceText.length; i++) {
      if (value[i] !== raceText[i]) {
        errors++;
      }
    }
    setErrorCount(errors);
    
  }, [raceStage, raceText, raceId, getCurrentUser, finishRace, stopAudio, currentCharIndex, playMorseChar, audioContext, userInput, updateProgressInDatabase]);
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // Add a replay function to replay current character
  const replayCurrent = useCallback(() => {
    if (raceStage !== RaceStage.RACING || currentCharIndex >= raceText.length) return;
    
    // Play the current character again
    playMorseChar(raceText[currentCharIndex]);
  }, [raceStage, raceText, currentCharIndex, playMorseChar]);
  
  // Play sound for a dot or dash - similar to playSendSymbol in SendingMode
  const playSendSymbol = useCallback(async (symbol: string) => {
    if (!audioContext) return;
    const sendUnit = 1200 / state.sendWpm;
    const duration = symbol === '.' ? sendUnit : sendUnit * 3;
    
    return new Promise<void>((resolve) => {
      if (window.AudioContext) {
        const tmpContext = audioContext.getRawContext();
        const osc = tmpContext.createOscillator();
        osc.frequency.value = 600; 
        osc.type = 'sine';
        osc.connect(tmpContext.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          resolve();
        }, duration);
      } else {
        setTimeout(resolve, duration);
      }
    });
  }, [audioContext, state.sendWpm]);

  // Process Morse code for send mode
  const decodeMorseCode = useCallback((code: string) => {
    // This is the inverse morse mapping from morse representation to characters
    const invMorseMap: {[key: string]: string} = {
      ".-": "a", "-...": "b", "-.-.": "c", "-..": "d", ".": "e",
      "..-.": "f", "--.": "g", "....": "h", "..": "i", ".---": "j",
      "-.-": "k", ".-..": "l", "--": "m", "-.": "n", "---": "o",
      ".--.": "p", "--.-": "q", ".-.": "r", "...": "s", "-": "t",
      "..-": "u", "...-": "v", ".--": "w", "-..-": "x", "-.--": "y",
      "--..": "z", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
      ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
      "-----": "0", ".-.-.-": ".", "--..--": ",", "..--..": "?", 
      ".----.": "'", "-.-.--": "!", "-..-.": "/", "-.--.": "(", 
      "-.--.-": ")", ".-...": "&", "---...": ":", "-.-.-.": ";", 
      "-...-": "=", ".-.-.": "+", "-....-": "-", "..--.-": "_",
      ".-..-.": "\"", "...-..-": "$", ".--.-": "@", "/": " "
    };
    
    return invMorseMap[code] || "?";
  }, []);

  // Handle completed morse input
  const handleMorseComplete = useCallback((code: string) => {
    if (raceStage !== RaceStage.RACING) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const decodedChar = decodeMorseCode(code);
    const expectedChar = raceText[currentCharIndex]?.toLowerCase();
    
    if (decodedChar === expectedChar) {
      // Show correct indicator
      setShowCorrectIndicator(true);
      
      // Slight pause before continuing
      setTimeout(() => {
        setShowCorrectIndicator(false);
        
        // Correct input
        const newInput = userInput + decodedChar;
        setUserInput(newInput);
        
        // Calculate new progress
        const newProgress = Math.round(((currentCharIndex + 1) / raceText.length) * 100);
        setUserProgress(newProgress);
        
        // Update latest progress reference for database syncing
        latestProgressRef.current = currentCharIndex + 1;
        
        // Clear keyer output and code buffer
        setKeyerOutput('');
        // Code buffer is now handled locally
        
        // Move to next character
        const nextCharIndex = currentCharIndex + 1;
        setCurrentCharIndex(nextCharIndex);
        
        // Update progress in database
        if (raceId) {
          // Send progress update by updating the database - realtime changes will propagate to all clients
          if (channelRef.current) {
            // Update our progress reference
            latestProgressRef.current = currentCharIndex + 1;
            
            // Mark that we have a new update, but let the throttling handle when to actually send it
            pendingUpdateRef.current = true;
            
            // Get the mapped ID for anonymous users
            let userId = currentUser.id;
            if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
              userId = anonUserIdMapRef.current[currentUser.id];
            }
            
            // Try to update, but the throttle mechanism will decide if it happens now or later
            updateProgressInDatabase(currentCharIndex + 1, userId);
            
            // Also broadcast for immediate UI updates
            if (updateProgressRef.current) updateProgressRef.current(currentCharIndex + 1);
          }
          
          // Check if user has completed the race
          if (nextCharIndex >= raceText.length) {
            finishRace();
            stopAudio();
          }
        }
      }, 400); // 400ms pause
    } else {
      // Incorrect input - play error sound
      setErrorCount(prev => prev + 1);
      
      // Clear keyer output and code buffer for next attempt
      setKeyerOutput('');
      // Code buffer is now handled locally
      
      if (audioContext) {
        audioContext.playErrorSound().catch(err => {
          console.error("Error playing error sound:", err);
        });
      }
    }
  }, [raceStage, getCurrentUser, decodeMorseCode, raceText, currentCharIndex, userInput, raceId, 
      channelRef, anonUserIdMapRef, updateProgressInDatabase, finishRace, stopAudio, audioContext, updateProgressRef]);

  // Key processing interval for send mode - properly implementing iambic keyer behavior
  useEffect(() => {
    if (raceStage !== RaceStage.RACING || raceMode !== 'send') return;
    
    let lastTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;
    let active = true;
    let lastSymbol: string | null = null;
    
    // Track the local code buffer for closure
    let localCodeBuffer = '';
    
    const wait = (ms: number): Promise<void> => {
      return new Promise(resolve => {
        timeoutId = setTimeout(() => {
          resolve();
        }, ms);
      });
    };
    
    const sendLoop = async () => {
      while (active && raceStage === RaceStage.RACING && raceMode === 'send') {
        const now = Date.now();
        const gap = now - lastTime;
        const sendUnit = 1200 / state.sendWpm;
        
        // Word gap detection: >=7 units and we have code to process
        if (gap >= sendUnit * 7 && localCodeBuffer) {
          // Process the code
          handleMorseComplete(localCodeBuffer);
          
          // Reset local code buffer
          localCodeBuffer = '';
          // Code buffer is now handled locally
          setKeyerOutput('');
          
          lastTime = now;
          await wait(10);
          continue;
        }
        
        // Letter gap detection: >=3 units and we have code to process
        if (gap >= sendUnit * 3 && localCodeBuffer) {
          // Process the code
          handleMorseComplete(localCodeBuffer);
          
          // Reset local code buffer
          localCodeBuffer = '';
          // Code buffer is now handled locally
          setKeyerOutput('');
          
          lastTime = now;
        }
        
        // determine next symbol - exactly like the original SendingMode component
        let symbol: string | undefined;
        
        // Exactly match original implementation using shift() to remove and return the first element
        if (sendQueueRef.current.length > 0) {
          symbol = sendQueueRef.current.shift();
        } else {
          // Use the ref for immediate access to current key state
          const left = keyStateRef.current.ArrowLeft;
          const right = keyStateRef.current.ArrowRight;
          
          if (!left && !right) {
            await wait(10);
            continue;
          } else if (left && right) {
            // Iambic keying - alternate between dot and dash exactly like the original
            symbol = lastSymbol === "." ? "-" : ".";
          } else if (left) {
            symbol = ".";
          } else {
            symbol = "-";
          }
        }
        
        if (symbol) {
          // play and display symbol
          await playSendSymbol(symbol);
          setKeyerOutput(prev => prev + symbol);
          // Code buffer is now handled locally
          localCodeBuffer += symbol;
          lastSymbol = symbol;
          
          // inter-element gap
          await wait(sendUnit);
          lastTime = Date.now();
        }
      }
    };
    
    // Start the send loop
    sendLoop();
    
    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [raceStage, raceMode, state.sendWpm, handleMorseComplete, playSendSymbol]);

  // Update the handleKeyDown function to handle both copy and send modes
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (raceStage !== RaceStage.RACING) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Tab key for replaying current character (in copy mode only)
    if (e.key === 'Tab') {
      e.preventDefault(); // Prevent tab from changing focus
      if (raceMode === 'copy') {
        replayCurrent();
      }
      return;
    }
    
    // Special handling for send mode with arrow keys
    if (raceMode === 'send') {
      // Handle paddle key presses for send mode
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        console.log(`ArrowLeft DOWN (ref state: ${JSON.stringify(keyStateRef.current)})`);
        
        // Only queue a dot if key wasn't already pressed
        if (!keyStateRef.current.ArrowLeft) {
          console.log('Queueing a DOT');
          sendQueueRef.current.push('.');
        }
        
        // Update ref state immediately
        keyStateRef.current.ArrowLeft = true;
        
        // Update React state for UI rendering
        // No need to update UI state as we're using refs for key state
        return;
      } 
      else if (e.key === 'ArrowRight') {
        e.preventDefault();
        console.log(`ArrowRight DOWN (ref state: ${JSON.stringify(keyStateRef.current)})`);
        
        // Only queue a dash if key wasn't already pressed
        if (!keyStateRef.current.ArrowRight) {
          console.log('Queueing a DASH');
          sendQueueRef.current.push('-');
        }
        
        // Update ref state immediately
        keyStateRef.current.ArrowRight = true;
        
        // Update React state for UI rendering
        // No need to update UI state as we're using refs for key state
        return;
      }
      
      // Process other keys in send mode
      if (e.key === 'Escape') {
        // Cancel race
        e.preventDefault();
        // Clear send queue and state
        sendQueueRef.current = [];
        keyStateRef.current = { ArrowLeft: false, ArrowRight: false };
        // No need to update UI state as we're using refs for key state
        return;
      }
      
      return; // Don't process other keys in send mode
    }
    
    // Below is the copy mode logic (only process character keys in copy mode)
    // Only process alphanumeric keys and basic punctuation
    if (!/^[a-zA-Z0-9\s.,?!]$/.test(e.key)) return;
    
    const input = e.key.toLowerCase();
    const expectedChar = raceText[currentCharIndex]?.toLowerCase();
    
    if (!expectedChar) return;
    
    // Process the character input
    if (input === expectedChar) {
      // Show correct indicator
      setShowCorrectIndicator(true);
      
      // Slight pause before continuing (200ms)
      setTimeout(() => {
        setShowCorrectIndicator(false);
        
        // Correct input
        const newInput = userInput + input;
        setUserInput(newInput);
        
        // Calculate new progress
        const newProgress = Math.round(((currentCharIndex + 1) / raceText.length) * 100);
        setUserProgress(newProgress);
        
        // Update latest progress reference for database syncing
        latestProgressRef.current = currentCharIndex + 1;
        
        // Move to next character
        const nextCharIndex = currentCharIndex + 1;
        setCurrentCharIndex(nextCharIndex);
        
        // Update progress in database
        if (raceId) {
          // Send progress update by updating the database - realtime changes will propagate to all clients
          if (channelRef.current) {
            // Update our progress reference
            latestProgressRef.current = currentCharIndex + 1;
            
            // Mark that we have a new update, but let the throttling handle when to actually send it
            pendingUpdateRef.current = true;
            
            // Get the mapped ID for anonymous users
            let userId = currentUser.id;
            if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
              userId = anonUserIdMapRef.current[currentUser.id];
            }
            
            // Try to update, but the throttle mechanism will decide if it happens now or later
            updateProgressInDatabase(currentCharIndex + 1, userId);
            
            // Also broadcast for immediate UI updates
            if (updateProgressRef.current) updateProgressRef.current(currentCharIndex + 1);
          }
          
          // Check if user has completed the race
          if (nextCharIndex >= raceText.length) {
            finishRace();
            stopAudio();
          } else if (raceMode === 'copy') {
            // Only play the next character in copy mode
            playMorseChar(raceText[nextCharIndex]);
          }
        } else if (nextCharIndex < raceText.length && raceMode === 'copy') {
          // If no database update, still play next character (in copy mode only)
          playMorseChar(raceText[nextCharIndex]);
        }
      }, 400); // 400ms pause
    } else {
      // Incorrect input - play error sound
      setErrorCount(prev => prev + 1);
      
      if (audioContext) {
        audioContext.playErrorSound().then(() => {
          // Short delay before replaying the current character (in copy mode only)
          if (raceMode === 'copy') {
            setTimeout(() => {
              if (currentCharIndex < raceText.length) {
                playMorseChar(raceText[currentCharIndex]);
              }
            }, 750); // Match the delay used in training mode
          }
        }).catch(err => {
          console.error("Error playing error sound:", err);
          // Even if error sound fails, still replay the character (in copy mode only)
          if (raceMode === 'copy') {
            setTimeout(() => {
              if (currentCharIndex < raceText.length) {
                playMorseChar(raceText[currentCharIndex]);
              }
            }, 750);
          }
        });
      }
    }
  }, [raceStage, raceText, raceId, getCurrentUser, finishRace, stopAudio, currentCharIndex, 
      playMorseChar, audioContext, userInput, updateProgressInDatabase, raceMode, replayCurrent, updateProgressRef]);
  
  // Calculate race statistics for results view - use useMemo directly
  const stats = React.useMemo(() => {
    if (!startTime || !finishTime) return null;
    
    const durationSeconds = (finishTime - startTime) / 1000;
    const minutes = durationSeconds / 60;
    // Calculate words per minute (assuming 5 chars per word)
    const wpm = Math.round((raceText.length / 5) / minutes);
    
    return {
      time: durationSeconds,
      wpm,
      errors: errorCount
    };
  }, [startTime, finishTime, raceText.length, errorCount]);
  
  // Handle keyup event for send mode
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (raceStage !== RaceStage.RACING || raceMode !== 'send') return;
    
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      console.log(`${e.key} UP (ref state: ${JSON.stringify(keyStateRef.current)})`);
      
      // Update ref state immediately
      keyStateRef.current[e.key as 'ArrowLeft' | 'ArrowRight'] = false;
      
      // Update React state for UI rendering
      // No need to update UI state as we're using refs for key state
    }
  }, [raceStage, raceMode]);

  // Set up keyboard listeners for racing
  useEffect(() => {
    if (raceStage !== RaceStage.RACING) return;
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Add keyup listener for send mode
    if (raceMode === 'send') {
      document.addEventListener('keyup', handleKeyUp);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Clean up keyup listener
      if (raceMode === 'send') {
        document.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [raceStage, handleKeyDown, raceMode, handleKeyUp]);
  
  // Effect to start the race when race begins (only play sound in copy mode)
  useEffect(() => {
    if (raceStage === RaceStage.RACING && raceText && raceText.length > 0 && currentCharIndex === 0) {
      const currentUser = getCurrentUser();
      
      // Check if user has already finished - don't play or reset progress
      if (raceFinishedRef.current) {
        console.log('User already finished this race - skipping sound and progress reset');
        return;
      }
      
      // Make sure our progress is set to 0 in the database when race starts
      if (currentUser && raceId) {
        console.log('Race starting: Initializing progress in database');
        
        // Only reset progress if user hasn't made progress already
        if (latestProgressRef.current === 0) {
          // Get proper user ID - for anonymous users, use the mapped UUID
          let dbUserId = currentUser.id;
          if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
            dbUserId = anonUserIdMapRef.current[currentUser.id];
            console.log('Using mapped UUID for anonymous user:', { 
              anonId: currentUser.id, 
              mappedId: dbUserId 
            });
          } else if (currentUser.id.startsWith('anon-')) {
            console.error('No mapped UUID found for anonymous user. This will cause errors:', currentUser.id);
          }
          
          // Reset progress through API
          raceService.updateProgress(raceId, dbUserId, 0, 0)
            .then(() => {
              console.log('Initial state set in database - progress reset to 0');
            })
            .catch(error => {
              console.error('Error initializing progress in database:', error);
            });
        }
      }
      
      // Only play the sound in copy mode, not in send mode,
      // and only if the user hasn't already made progress
      if (raceMode === 'copy' && latestProgressRef.current === 0) {
        // Slight delay to make sure UI is ready
        setTimeout(() => {
          console.log('Playing first character: ', raceText[0]);
          playMorseChar(raceText[0])
            .catch(err => {
              console.error("Error playing first character:", err);
              // If there's an error, we still want to allow the user to progress
              // by providing a replay button
            });
        }, 500);
      }
    }
  }, [raceStage, raceText, currentCharIndex, playMorseChar, getCurrentUser, raceId, raceMode]);
  
  // Add cleanup effect to ensure final state is persisted
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentUser = getCurrentUser();
      // If race is in progress and we have progress data that might not have been saved yet, persist it before leaving
      if (currentUser && raceId && raceStage === RaceStage.RACING && latestProgressRef.current > 0 && pendingUpdateRef.current) {
        try {
          // Get the mapped UUID for anonymous users
          let dbUserId = currentUser.id;
          if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
            dbUserId = anonUserIdMapRef.current[currentUser.id];
          }
          
          // For best-effort final save, use sendBeacon to our API
          if (navigator.sendBeacon) {
            const formData = new FormData();
            formData.append('user_id', dbUserId);
            formData.append('progress', latestProgressRef.current.toString());
            formData.append('error_count', errorCount.toString());
            navigator.sendBeacon(
              `/api/races/${raceId}/progress-beacon`,
              formData
            );
            console.log('Final progress sent via beacon before page unload');
          }
        } catch (e) {
          console.error('Failed to save progress before unload:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [raceId, raceStage, getCurrentUser]);
  
  // Effect to process pending updates
  useEffect(() => {
    if (!raceStage || raceStage !== RaceStage.RACING) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Capture current values to prevent closure issues
    const userIdMap = { ...anonUserIdMapRef.current };
    
    // Set up an interval to check for pending updates
    const intervalId = setInterval(() => {
      if (pendingUpdateRef.current) {
        // Use the mapped ID for anonymous users
        let userId = currentUser.id;
        if (currentUser.id.startsWith('anon-') && userIdMap[currentUser.id]) {
          userId = userIdMap[currentUser.id];
        }
        
        updateProgressInDatabase(latestProgressRef.current, userId);
        
        // Also broadcast for immediate UI updates
        if (updateProgressRef.current) updateProgressRef.current(latestProgressRef.current);
      }
    }, 500);
    
    return () => {
      clearInterval(intervalId);
      
      // Do a final update when unmounting if we have pending changes
      if (pendingUpdateRef.current) {
        // Use the mapped ID for anonymous users - using the captured map
        let userId = currentUser.id;
        if (currentUser.id.startsWith('anon-') && userIdMap[currentUser.id]) {
          userId = userIdMap[currentUser.id];
        }
        
        updateProgressInDatabase(latestProgressRef.current, userId);
        
        // Also broadcast for immediate UI updates
        if (updateProgressRef.current) updateProgressRef.current(latestProgressRef.current);
      }
    };
  }, [raceStage, updateProgressInDatabase, getCurrentUser, updateProgressRef]);
  
  // Helper function to get the user ID to display (either mapped UUID or regular ID)
  const getUserIdForDisplay = useCallback((userId: string) => {
    if (userId.startsWith('anon-') && anonUserIdMapRef.current[userId]) {
      return anonUserIdMapRef.current[userId];
    }
    return userId;
  }, []);
  
  // Function to end an inactive race
  const endInactiveRace = useCallback(() => {
    if (!raceId || raceStatus !== 'racing') return;
    
    const now = Date.now();
    const inactiveTime = now - lastActivityTimeRef.current;
    const inactivityThreshold = 10000; // 10 seconds
    
    console.log(`Checking race activity: ${inactiveTime}ms since last activity`);
    
    if (inactiveTime > inactivityThreshold) {
      console.log('Race inactive for more than 10 seconds - ending race');
      raceService.updateRaceStatus(raceId, 'finished')
        .then(() => {
          console.log('Race ended due to inactivity');
          setRaceStage(RaceStage.RESULTS);
          setRaceStatus('finished');
          stopAudio();
        })
        .catch(error => {
          console.error('Error ending inactive race:', error);
        });
    }
  }, [raceId, raceStatus, stopAudio]);
  
  // Effect to track activity and end inactive races
  useEffect(() => {
    // Only monitor activity during racing state
    if (raceStatus !== 'racing') {
      // Clear any existing interval when not racing
      if (inactivityIntervalRef.current) {
        clearInterval(inactivityIntervalRef.current);
        inactivityIntervalRef.current = null;
      }
      return;
    }
    
    // Initialize the last activity time when race starts
    lastActivityTimeRef.current = Date.now();
    
    // Set up interval to check for inactivity
    inactivityIntervalRef.current = setInterval(endInactiveRace, 5000); // Check every 5 seconds
    
    return () => {
      if (inactivityIntervalRef.current) {
        clearInterval(inactivityIntervalRef.current);
        inactivityIntervalRef.current = null;
      }
    };
  }, [raceStatus, endInactiveRace]);
  
  // Helper function to determine if the current user is the race creator
  const isRaceCreator = useCallback(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || !raceCreator) return false;
    
    // For anonymous users, check their mapped UUID
    if (currentUser.id.startsWith('anon-')) {
      const mappedId = anonUserIdMapRef.current[currentUser.id];
      const isCreator = mappedId === raceCreator;
      console.log('Anonymous user host check:', { mappedId, raceCreator, isCreator });
      return isCreator;
    }
    
    const isCreator = currentUser.id === raceCreator;
    console.log('Host check:', { currentUserId: currentUser.id, raceCreator, isCreator });
    return isCreator;
  }, [getCurrentUser, raceCreator]);
  
  // Get creator display name
  const getCreatorDisplayName = useCallback(() => {
    // Find the creator in the participants list
    const creator = participants.find(p => p.id === raceCreator);
    return creator?.name || 'the host';
  }, [participants, raceCreator]);
  
  /* eslint-enable @typescript-eslint/no-explicit-any */
  
  // Fix the Create New Race button to properly reset state
  const handleCreateNewRace = useCallback(() => {
    setRaceStage(RaceStage.INFO);
    setRaceStatus('created'); // Reset race status
    setRaceId(null); // Reset race ID
    stopAudio();
    // Reset other state
    setUserProgress(0);
    setCurrentCharIndex(0);
    setErrorCount(0);
    setStartTime(null);
    setFinishTime(null);
    raceFinishedRef.current = false;
    
    // Remove race ID from URL without triggering navigation events
    if (typeof window !== 'undefined') {
      const newUrl = window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }, [stopAudio]);
  
  // Debugging to ensure host detection is working
  useEffect(() => {
    if (raceStage === RaceStage.SHARE) {
      console.log('Race Share Stage: Host check', {
        isHost: isRaceCreator(),
        raceCreator,
        currentUser: getCurrentUser()?.id,
        mappedId: getCurrentUser()?.id.startsWith('anon-') ? anonUserIdMapRef.current[getCurrentUser()?.id] : null
      });
    }
  }, [raceStage, isRaceCreator, raceCreator, getCurrentUser]);
  
  // Render appropriate stage of race
  return (
    <div className={styles.container}>
      {raceStage === RaceStage.INFO && (
        <RaceInfo 
          onCreateRace={() => createRace({ mode: raceMode })} 
          raceMode={raceMode}
          modeSelector={
            <RaceModeSelector 
              onSelectMode={(mode) => setRaceMode(mode)} 
              selectedMode={raceMode} 
            />
          }
        />
      )}
      
      {raceStage === RaceStage.SHARE && (
        <>
          <RaceShareUI
            raceId={raceId || ''}
            onStartRace={startRace}
            raceStatus={raceStatus}
            isHost={isRaceCreator()}
            hostName={getCreatorDisplayName()}
          />
          <RaceParticipants
            participants={participants}
            currentUserId={getUserIdForDisplay(getCurrentUser()?.id || '')}
            raceLength={raceText.length}
            onlineUserIds={onlineUsers.map(user => user.user_id)}
          />
        </>
      )}
      
      {raceStage === RaceStage.COUNTDOWN && (
        <>
          <CountdownTimer
            seconds={countdownSeconds}
            onComplete={startRacing}
          />
          <RaceParticipants
            participants={participants}
            currentUserId={getUserIdForDisplay(getCurrentUser()?.id || '')}
            raceLength={raceText.length}
            onlineUserIds={onlineUsers.map(user => user.user_id)}
          />
        </>
      )}
      
      {raceStage === RaceStage.RACING && (
        <div className={styles.raceContainer}>
          <div className={styles.morseText}>
            <div className={styles.textDisplay}>
              <h3>{raceMode === 'copy' 
                ? 'Type the characters as you hear them:' 
                : 'Send the characters you see using Morse code:'}</h3>
              <div className={styles.textContainer}>
                {/* Display progress but not the actual characters */}
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${userProgress}%` }}
                  />
                </div>
                <div className={styles.characterCount}>
                  {Math.floor((userProgress / 100) * raceText.length)} / {raceText.length} characters
                </div>
              </div>
            </div>
            
            {/* Character display depends on mode */}
            <div className={styles.currentCharContainer}>
              <div className={styles.currentCharPrompt}>Current character:</div>
              <div className={styles.currentChar}>
                {raceMode === 'send' && !showCorrectIndicator
                  ? (raceText[currentCharIndex]?.toUpperCase() || '') 
                  : ''  /* Hide character in copy mode or when showing correct indicator */
                }
              </div>
              <div className={styles.typingInstructions}>
                {raceMode === 'copy'
                  ? 'Listen for the Morse code and type the character you hear'
                  : 'Use ← key for · and → key for – to send the character displayed'
                }
              </div>
            </div>
            
            <div className={styles.raceControls}>
              {raceMode === 'copy' ? (
                <>
                  <button 
                    onClick={replayCurrent}
                    className={styles.replayButton}
                    title="Replay current character"
                  >
                    Replay Sound
                  </button>
                  <div className={styles.hint}>
                    Press Tab to replay the current character sound
                  </div>
                </>
              ) : (
                <div className={styles.morseControls}>
                  <div className={styles.keyerDisplay}>
                    <div className={styles.keyerOutput}>{keyerOutput}</div>
                  </div>
                  <div className={styles.hint}>
                    Use ← key for · and → key for –
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <RaceParticipants
            participants={participants}
            currentUserId={getUserIdForDisplay(getCurrentUser()?.id || '')}
            raceLength={raceText.length}
            onlineUserIds={onlineUsers.map(user => user.user_id)}
            showPlacement={true}
          />
          
          <div className={`${styles.correctIndicator} ${showCorrectIndicator ? styles.visible : ''}`}>✓</div>
        </div>
      )}
      
      {raceStage === RaceStage.RESULTS && (
        <div className={styles.resultsContainer}>
          <h2>Race Complete!</h2>
          
          {stats && (
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Your Speed:</span>
                <span className={styles.statValue}>{stats.wpm} WPM</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Time:</span>
                <span className={styles.statValue}>
                  {stats.time.toFixed(2)}s
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Errors:</span>
                <span className={styles.statValue}>{errorCount}</span>
              </div>
            </div>
          )}
          
          <h3>Final Rankings</h3>
          <RaceParticipants
            participants={participants.sort((a, b) => {
              if (a.finished === b.finished) {
                if (a.finishTime && b.finishTime) {
                  return a.finishTime - b.finishTime;
                }
                return b.progress - a.progress;
              }
              return a.finished ? -1 : 1;
            })}
            currentUserId={getUserIdForDisplay(getCurrentUser()?.id || '')}
            raceLength={raceText.length}
            onlineUserIds={onlineUsers.map(user => user.user_id)}
            showPlacement={true}
          />
          
          <div className={styles.actions}>
            <button
              className={styles.newRaceButton}
              onClick={handleCreateNewRace}
            >
              Create New Race
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRaceMode;