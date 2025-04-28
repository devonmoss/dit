import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from './RaceMode.module.css';
import { createAudioContext, isBrowser } from '../../utils/morse';
import supabase from '../../utils/supabase';
import { useMorseAudio } from '../../hooks/useMorseAudio';
import { useAppState } from '../../contexts/AppStateContext';
import useAuth from '../../hooks/useAuth';
import RaceInfo from '../RaceInfo/RaceInfo';
import RaceShareUI from '../RaceShareUI/RaceShareUI';
import RaceParticipants from '../RaceParticipants/RaceParticipants';
import CountdownTimer from '../CountdownTimer/CountdownTimer';
import { trainingLevels } from '../../utils/levels';
import { v4 as uuidv4 } from 'uuid';

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
          <p>Listen to Morse code and type the character you hear</p>
        </button>
        <button 
          className={`${styles.modeButton} ${selectedMode === 'send' ? styles.selectedMode : ''}`}
          onClick={() => onSelectMode('send')}
        >
          <h4>Send Mode</h4>
          <p>See characters and type them as Morse code</p>
        </button>
      </div>
    </div>
  );
};

const EnhancedRaceMode: React.FC = () => {
  const router = useRouter();
  const { id: queryId } = router.query;
  const { state } = useAppState();
  const { user } = useAuth();
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
  const [raceMode, setRaceMode] = useState<'copy' | 'send'>('copy');
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
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const [anonymousUser, setAnonymousUser] = useState<AnonymousUser | null>(null);
  
  // Reference to store the latest progress for database syncing
  const latestProgressRef = useRef<number>(0);
  // Track when we last sent a database update to avoid too many requests
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<boolean>(false);
  
  // First, add a state for the visual feedback
  const [showCorrectIndicator, setShowCorrectIndicator] = useState(false);
  
  // Add a reference to store the mapped anonymous user IDs
  const anonUserIdMapRef = useRef<{[key: string]: string}>({});
  
  // For send mode with arrow keys (similar to SendingMode)
  const [keyState, setKeyState] = useState({ ArrowLeft: false, ArrowRight: false });
  const keyStateRef = useRef({ ArrowLeft: false, ArrowRight: false });
  const [keyerOutput, setKeyerOutput] = useState('');
  const [codeBuffer, setCodeBuffer] = useState('');
  const sendQueueRef = useRef<string[]>([]);
  
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
      
      // Update the database with both progress and error count
      supabase
        .from('race_participants')
        .update({ 
          progress,
          error_count: errorCount 
        })
        .eq('race_id', raceId)
        .eq('user_id', dbUserId)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating progress:', error);
          }
        });
        
      // Update the last update timestamp
      lastUpdateTimeRef.current = now;
      pendingUpdateRef.current = false;
    } else {
      // If we're throttling, mark that we have a pending update
      pendingUpdateRef.current = true;
    }
  }, [raceId, errorCount]);
  
  // Get the current user (either authenticated or anonymous)
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
  
  // Join an existing race - moved up before it's used
  const joinRace = useCallback(async (raceId: string) => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
      console.log('Joining race:', raceId, 'as user:', currentUser.id);
      
      // Get race data
      const { data: race, error } = await supabase
        .from('races')
        .select('*')
        .eq('id', raceId)
        .single();
        
      if (error) throw error;
      
      console.log('Race data retrieved:', race);
      
      // Set race text
      setRaceText(race.text || '');
      // Set race mode
      setRaceMode(race.mode || 'copy');
      
      // For anonymous users, generate a consistent UUID
      let participantUserId = currentUser.id;
      if (currentUser.id.startsWith('anon-')) {
        // Check if we already have a UUID for this anonymous user
        if (!anonUserIdMapRef.current[currentUser.id]) {
          // Generate a new UUID and store it
          anonUserIdMapRef.current[currentUser.id] = uuidv4();
        }
        participantUserId = anonUserIdMapRef.current[currentUser.id];
      }
      
      // Check if user is already a participant
      const { data: existingParticipant, error: participantError } = await supabase
        .from('race_participants')
        .select('*')
        .eq('race_id', raceId)
        .eq('user_id', participantUserId)
        .single();
        
      if (participantError && participantError.code !== 'PGRST116') { // Code for no rows returned
        console.error('Error checking participant:', participantError);
      }
        
      // Add user as participant if not already present
      if (!existingParticipant) {
        console.log('Adding as new participant');
        const { data: newParticipant, error: insertError } = await supabase
          .from('race_participants')
          .insert([{
            race_id: raceId,
            user_id: participantUserId,
            name: getUserDisplayName(currentUser),
            progress: 0,
            finished: false
          }])
          .select();
          
        if (insertError) {
          console.error('Error adding participant:', insertError);
        } else {
          console.log('Participant added successfully:', newParticipant);
        }
      } else {
        console.log('Already a participant:', existingParticipant);
      }
      
      // Get all participants
      const { data: participants, error: participantsError } = await supabase
        .from('race_participants')
        .select('*')
        .eq('race_id', raceId);
        
      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
      }
        
      if (participants) {
        console.log('All participants:', participants);
        setParticipants(participants.map(p => ({
          id: p.user_id,
          name: p.name || 'Anonymous',
          progress: p.progress || 0,
          finished: p.finished || false,
          finishTime: p.finish_time,
          errorCount: p.error_count || 0,
          raceTime: p.race_time
        })));
      }
    } catch (err) {
      console.error('Error joining race:', err);
      alert('Could not join race. Please try again.');
    }
  }, [getCurrentUser]);
  
  // Initialize race ID from URL if present
  useEffect(() => {
    if (queryId && typeof queryId === 'string' && !raceId) {
      setRaceId(queryId);
      joinRace(queryId);
      setRaceStage(RaceStage.SHARE);
    }
  // Only re-run when queryId or raceId change; joinRace is stable enough
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId, raceId]);
  
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
        config: { presence: { key: presenceUserId } }
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
          } else if (race.status === 'racing') {
            setRaceStage(RaceStage.RACING);
            setStartTime(race.start_time);
            
            // Play just the first character
            if (race.text && race.text.length > 0) {
              setCurrentCharIndex(0);
              playMorseChar(race.text[0]);
            }
          } else if (race.status === 'finished') {
            setRaceStage(RaceStage.RESULTS);
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
                // Update race status without waiting for response
                supabase
                  .from('races')
                  .update({ status: 'finished' })
                  .eq('id', raceId)
                  .then(({ error }) => {
                    if (error) {
                      console.error('Error updating race status to finished:', error);
                    }
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
            // Non-null assertion since we've checked above that channel is not null
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const state = channel!.presenceState();
          // state values are arrays of metadata objects
          const users = Object.values(state).map((presences: Array<AnyRecord>) => presences[0]);
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: Array<AnyRecord> }) => {
          // newPresences is an array of metadata objects
          setOnlineUsers(prev => [...prev, ...newPresences]);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<AnyRecord> }) => {
          // leftPresences is an array of metadata objects
          setOnlineUsers(prev => prev.filter(u => !leftPresences.some((l: AnyRecord) => l.user_id === u.user_id)));
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
  }, [raceId, getCurrentUser, playMorseCode, stopAudio]);
  
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
      // Generate a simple ID for the race
      const generateSimpleId = () => {
        return Math.random().toString(36).substring(2, 10);
      };
      const newRaceId = generateSimpleId();
      
      // For the created_by field, ensure we use a valid UUID
      // If it's an anonymous user, generate a UUID instead of using their anon-ID
      const createdById = currentUser.id.startsWith('anon-') ? uuidv4() : currentUser.id;
      
      // Create race in database
      const { data: race, error } = await supabase
        .from('races')
        .insert([{
          id: newRaceId,
          created_by: createdById,
          mode: mode,
          status: 'waiting',
          char_sequence: text.split(''),
          text: text,
          level_id: state.selectedLevelId
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      // For the user_id in race_participants, also use UUID for anonymous users
      const participantUserId = currentUser.id.startsWith('anon-') ? createdById : currentUser.id;
      
      // Add creator as first participant
      await supabase
        .from('race_participants')
        .insert([{
          race_id: race.id,
          user_id: participantUserId,
          name: getUserDisplayName(currentUser),
          progress: 0,
          finished: false
        }])
        .select();
        
      // Update local state - make sure to use the same ID here
      setRaceId(race.id);
      setRaceText(text);
      setParticipants([{
        id: participantUserId,
        name: getUserDisplayName(currentUser),
        progress: 0,
        finished: false
      }]);
      
      // Move to share stage
      setRaceStage(RaceStage.SHARE);
      
      // Navigate to /race?id=race.id instead of using pushState
      router.push(`/race?id=${race.id}`);
      
    } catch (err) {
      console.error('Error creating race:', err);
      alert('Could not create race. Please try again.');
    }
  }, [getCurrentUser, state.chars, state.selectedLevelId, router]);
  
  // Start the race
  const startRace = useCallback(async () => {
    if (!raceId) return;
    
    try {
      // Update race status to countdown
      await supabase
        .from('races')
        .update({
          status: 'countdown'
        })
        .eq('id', raceId);
        
      setRaceStage(RaceStage.COUNTDOWN);
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
      
      // Update race status to racing with start time
      await supabase
        .from('races')
        .update({
          status: 'racing',
          start_time: startTime
        })
        .eq('id', raceId);
        
      setRaceStage(RaceStage.RACING);
      setStartTime(startTime);
      setUserInput('');
      
      // Start playing just the first character
      setCurrentCharIndex(0);
      if (raceText && raceText.length > 0) {
        playMorseChar(raceText[0]);
      }
      
    } catch (err) {
      console.error('Error starting race:', err);
    }
  }, [raceId, raceText, playMorseChar]);
  
  // Finish the race for a user
  const finishRace = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !raceId || !startTime) return;
    
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
      
      // For race completion, we want an immediate database update - this is important state
      await supabase
        .from('race_participants')
        .update({
          finished: true,
          finish_time: endTime,
          progress: raceText.length,
          error_count: errorCount,
          race_time: raceDuration
        })
        .eq('race_id', raceId)
        .eq('user_id', dbUserId);
      
      console.log('Race finish state persisted to database');
      
      // Check if all participants are finished - we can rely on the database for this
      // Once finished state is detected by each client via postgres_changes, they'll update UI accordingly
    } catch (err) {
      console.error('Error finishing race:', err);
    }
  }, [raceId, startTime, getCurrentUser, raceText.length, errorCount]);
  
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
        setCodeBuffer('');
        
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
      setCodeBuffer('');
      
      if (audioContext) {
        audioContext.playErrorSound().catch(err => {
          console.error("Error playing error sound:", err);
        });
      }
    }
  }, [raceStage, getCurrentUser, decodeMorseCode, raceText, currentCharIndex, userInput, raceId, 
      channelRef, anonUserIdMapRef, updateProgressInDatabase, finishRace, stopAudio, audioContext]);

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
          setCodeBuffer('');
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
          setCodeBuffer('');
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
          setCodeBuffer(prev => prev + symbol);
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
        setKeyState(prev => ({ ...prev, ArrowLeft: true }));
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
        setKeyState(prev => ({ ...prev, ArrowRight: true }));
        return;
      }
      
      // Process other keys in send mode
      if (e.key === 'Escape') {
        // Cancel race
        e.preventDefault();
        // Clear send queue and state
        sendQueueRef.current = [];
        keyStateRef.current = { ArrowLeft: false, ArrowRight: false };
        setKeyState({ ArrowLeft: false, ArrowRight: false });
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
      playMorseChar, audioContext, userInput, updateProgressInDatabase, raceMode, replayCurrent]);
  
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
      setKeyState(prev => ({ ...prev, [e.key]: false }));
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
      
      // Make sure our progress is set to 0 in the database when race starts
      // This is one of the few times we directly update the database
      if (currentUser && raceId) {
        console.log('Race starting: Initializing progress in database');
        supabase
          .from('race_participants')
          .update({ 
            progress: 0,
            finished: false,
            finish_time: null
          })
          .eq('race_id', raceId)
          .eq('user_id', currentUser.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error initializing progress in database:', error);
            } else {
              console.log('Initial state set in database - progress reset to 0');
            }
          });
      }
      
      // Only play the sound in copy mode, not in send mode
      if (raceMode === 'copy') {
        // Slight delay to make sure UI is ready
        setTimeout(() => {
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
          
          // For best-effort final save, use sendBeacon
          if (navigator.sendBeacon) {
            const formData = new FormData();
            formData.append('progress', latestProgressRef.current.toString());
            navigator.sendBeacon(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/race_participants?race_id=eq.${raceId}&user_id=eq.${dbUserId}`,
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
    
    // Set up an interval to check for pending updates
    const intervalId = setInterval(() => {
      if (pendingUpdateRef.current) {
        // Use the mapped ID for anonymous users
        let userId = currentUser.id;
        if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
          userId = anonUserIdMapRef.current[currentUser.id];
        }
        
        updateProgressInDatabase(latestProgressRef.current, userId);
      }
    }, 500);
    
    return () => {
      clearInterval(intervalId);
      
      // Do a final update when unmounting if we have pending changes
      if (pendingUpdateRef.current) {
        // Use the mapped ID for anonymous users
        let userId = currentUser.id;
        if (currentUser.id.startsWith('anon-') && anonUserIdMapRef.current[currentUser.id]) {
          userId = anonUserIdMapRef.current[currentUser.id];
        }
        
        updateProgressInDatabase(latestProgressRef.current, userId);
      }
    };
  }, [raceStage, updateProgressInDatabase, getCurrentUser]);
  
  // Helper function to get the user ID to display (either mapped UUID or regular ID)
  const getUserIdForDisplay = useCallback((userId: string) => {
    if (userId.startsWith('anon-') && anonUserIdMapRef.current[userId]) {
      return anonUserIdMapRef.current[userId];
    }
    return userId;
  }, []);
  
  // Helper function to get display name for a user
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const getUserDisplayName = useCallback((user: any) => {
    if (!user) return 'Anonymous';
    return user.user_metadata?.username || user.user_metadata?.full_name || 'Anonymous';
  }, []);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  
  // Render appropriate stage of race
  return (
    <div className={styles.container}>
      {raceStage === RaceStage.INFO && (
        <>
          <RaceModeSelector 
            onSelectMode={(mode) => setRaceMode(mode)} 
            selectedMode={raceMode} 
          />
          <RaceInfo 
            onCreateRace={() => createRace({ mode: raceMode })} 
            raceMode={raceMode}
          />
        </>
      )}
      
      {raceStage === RaceStage.SHARE && (
        <>
          <RaceShareUI
            raceId={raceId || ''}
            onStartRace={startRace}
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
              onClick={() => {
                setRaceStage(RaceStage.INFO);
                stopAudio();
                // Remove race ID from URL
                const newUrl = window.location.pathname;
                window.history.pushState({ path: newUrl }, '', newUrl);
              }}
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