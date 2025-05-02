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
import { trainingLevels } from '../../utils/levels';
import { v4 as uuidv4 } from 'uuid';
import { calculateRaceXp, XpSource } from '../../utils/xpSystem';
import * as raceService from '../../services/raceService';
import * as xpService from '../../services/xpService';
import { calculateRaceStats } from '../../utils/raceUtils';
import RaceInviteModal from './RaceInviteModal';
import RaceModeSelector from './RaceModeSelector';
import InfoStage from './stages/InfoStage';
import ShareStage from './stages/ShareStage';
import CountdownStage from './stages/CountdownStage';
import ResultsStage from './stages/ResultsStage';
import RacingStage from './stages/RacingStage';
import { 
  AnyRecord,
  RaceParticipant,
  RaceStage, 
  AnonymousUser,
  User,
  RaceMode,
  InvitationDetails,
  XpEarned,
  RaceStats
} from '../../types/raceTypes';
import { useAnonymousUser } from '../../hooks/useAnonymousUser';
import { useRaceChannel } from '../../hooks/useRaceChannel';
import { useRaceProgress } from '../../hooks/useRaceProgress';
import { useRaceCreation } from '../../hooks/useRaceCreation';
import { useRaceInputHandler } from '../../hooks/useRaceInputHandler';
import { 
  useRaceInfoStage,
  useRaceShareStage,
  useRaceCountdownStage,
  useRacePlayStage,
  useRaceResultsStage
} from '../../hooks/raceStages';

const EnhancedRaceMode: React.FC = () => {
  const router = useRouter();
  const { id: queryId } = router.query;
  const { state, selectLevel } = useAppState();
  const { user, refreshXpInfo } = useAuth();
  const { playMorseCode, playMorseChar, stopAudio } = useMorseAudio();
  
  // Use the anonymous user hook
  const { 
    getCurrentUser, 
    getUserDisplayName, 
    getMappedUserId,
    anonUserIdMap 
  } = useAnonymousUser(user);
  
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
  const [raceMode, setRaceMode] = useState<RaceMode>(state.mode === 'copy' || state.mode === 'send' ? state.mode : 'copy');
  const [raceStatus, setRaceStatus] = useState<string>('created');
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  // Presence state for connected participants
  const [onlineUsers, setOnlineUsers] = useState<AnyRecord[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [finishTime, setFinishTime] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [xpEarned, setXpEarned] = useState<XpEarned | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [leveledUp, setLeveledUp] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // References for send mode - will be synced with the hook
  const keyStateRef = useRef({ ArrowLeft: false, ArrowRight: false });
  const sendQueueRef = useRef<string[]>([]);
  const [keyerOutput, setKeyerOutput] = useState('');
  
  // Add a reference to track the updateProgress function
  const updateProgressRef = useRef<((progress: number) => void) | null>(null);
  
  // Add a state to track race creator
  const [raceCreator, setRaceCreator] = useState<string | null>(null);
  
  // Get current user info for the race channel
  const currentUser = getCurrentUser();
  const currentUserId = currentUser ? getMappedUserId(currentUser.id) : null;
  const currentUserName = currentUser ? getUserDisplayName(currentUser) : 'Anonymous';
  
  // Use the race channel hook
  const { 
    isChannelReady,
    onlineUsers: raceOnlineUsers,
    participants: raceParticipants,
    invitationDetails,
    broadcastProgress,
    broadcastRedirect, 
    setInitialParticipants,
    clearInvitation
  } = useRaceChannel(raceId, currentUserId, currentUserName);
  
  // Use the race progress hook
  const {
    userProgress,
    errorCount,
    currentCharIndex,
    latestProgressRef,
    pendingUpdateRef,
    lastActivityTimeRef,
    updateProgress: updateProgressInDatabase,
    incrementProgress,
    incrementErrorCount,
    resetProgress,
    checkInactivity
  } = useRaceProgress({
    raceId,
    raceText,
    raceStatus,
    broadcastProgress,
    onComplete: () => {
      if (raceId && currentUser) {
        finishRace();
      }
    },
    getMappedUserId,
    getCurrentUser
  });
  
  // Use the race creation hook
  const {
    isCreatingRace,
    createRace,
    handleRaceAgain
  } = useRaceCreation({
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
  });

  // Keep participants in sync with race channel
  useEffect(() => {
    // Update local participants when race channel participants change
    if (raceParticipants && raceParticipants.length > 0) {
      setParticipants(raceParticipants);
      
      // If we're in racing state, reset inactivity timer when participants are updated
      if (raceStatus === 'racing') {
        lastActivityTimeRef.current = Date.now();
        console.log('Received participant updates - resetting inactivity timer');
      }
    }
  }, [raceParticipants, raceStatus]);
  
  // Keep the onlineUsers state in sync with the race channel
  useEffect(() => {
    if (raceOnlineUsers.length > 0) {
      setOnlineUsers(raceOnlineUsers);
    }
  }, [raceOnlineUsers]);
  
  // Set up event listener for race status changes
  useEffect(() => {
    const handleRaceStatusChange = (event: any) => {
      const { status, startTime } = event.detail;
      console.log('Race status changed:', status);
      
      // Update UI based on race status
      if (status === 'countdown') {
        setRaceStage(RaceStage.COUNTDOWN);
        setRaceStatus('countdown');
      } else if (status === 'racing') {
        setRaceStage(RaceStage.RACING);
        setRaceStatus('racing');
        setStartTime(startTime);
        
        // Reset last activity time when race starts
        lastActivityTimeRef.current = Date.now();
      } else if (status === 'finished') {
        setRaceStage(RaceStage.RESULTS);
        setRaceStatus('finished');
        stopAudio();
      }
    };
    
    window.addEventListener('race-status-changed', handleRaceStatusChange);
    
    return () => {
      window.removeEventListener('race-status-changed', handleRaceStatusChange);
    };
  }, [stopAudio]);
  
  // Modify the joinRace function to use the race channel instead of directly setting up the channel
  const joinRace = useCallback(async (raceId: string) => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
      console.log('Joining race:', raceId, 'as user:', currentUser.id);
      
      // Reset progress for a new race
      resetProgress();
      
      // Get proper user ID with mapping for anonymous users
      const participantUserId = getMappedUserId(currentUser.id, raceId);
      
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
      
      // Store the level ID if it exists in the race data
      if (race.level_id) {
        console.log('Setting race level ID:', race.level_id);
        selectLevel(race.level_id);
      }
      
      // Set race status - ENSURE we set to 'created' if the race hasn't actually started
      if (race.status === 'countdown' || race.status === 'racing' || race.status === 'finished') {
        setRaceStatus(race.status);
      } else {
        // Default to 'created' for any other status or if status is not set
        setRaceStatus('created');
      }
      
      // Join the race through API - the server handles participant deduplication
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
            updateProgressInDatabase(race.text?.length || 0, participantUserId);
            setFinishTime(userParticipant.finish_time);
            setStartTime(race.start_time);
          } else if (userParticipant.progress > 0) {
            console.log('User has existing progress:', userParticipant.progress);
            // Restore user progress
            updateProgressInDatabase(userParticipant.progress, participantUserId);
            // Set character index to their progress
          }
        }
        
        // Set participants via the race channel hook
        const mappedParticipants = joinResult.participants.map((p: { 
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
        }));
        
        setInitialParticipants(mappedParticipants);
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
      
      // Set race ID (this will initialize the race channel)
      setRaceId(raceId);
      
    } catch (err) {
      console.error('Error joining race:', err);
      alert('Could not join race. Please try again.');
    }
  }, [getCurrentUser, getUserDisplayName, stopAudio, selectLevel, getMappedUserId, setInitialParticipants, resetProgress, updateProgressInDatabase]);
  
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
      
      // Reset the activity timer when race starts
      lastActivityTimeRef.current = Date.now();
      console.log('Race started - initializing activity timer');
      
    } catch (err) {
      console.error('Error starting race:', err);
    }
  }, [raceId]);
  
  // Finish the race for a user
  const finishRace = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !raceId || !startTime) return;
    
    const endTime = Date.now();
    setFinishTime(endTime);
    
    // Calculate race duration in seconds
    const raceDuration = (endTime - startTime) / 1000;
    
    // Get the properly mapped user ID for database operations
    const dbUserId = getMappedUserId(currentUser.id, raceId || undefined);
    
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
  }, [raceId, startTime, getCurrentUser, raceText.length, errorCount, user, raceMode, refreshXpInfo, getMappedUserId]);
  
  // Use the race input handler hook - now moved after finishRace is defined
  const {
    userInput,
    keyerOutput: inputKeyerOutput,
    showCorrectIndicator,
    replayCurrent,
    keyStateRef: inputKeyStateRef,
    sendQueueRef: inputSendQueueRef
  } = useRaceInputHandler({
    raceStage,
    raceMode,
    raceText,
    currentCharIndex,
    incrementProgress,
    incrementErrorCount,
    finishRace,
    stopAudio,
    playMorseChar,
    audioContext,
    getCurrentUser,
    getMappedUserId,
    raceId
  });

  // Update local refs from the hook's refs
  useEffect(() => {
    keyStateRef.current = inputKeyStateRef.current;
    sendQueueRef.current = inputSendQueueRef.current;
    setKeyerOutput(inputKeyerOutput);
  }, [inputKeyStateRef, inputSendQueueRef, inputKeyerOutput]);
  
  // Calculate race statistics for results view - use calculation function
  const stats = React.useMemo((): RaceStats | null => {
    return calculateRaceStats(startTime, finishTime, raceText.length, errorCount);
  }, [startTime, finishTime, raceText.length, errorCount]);
  
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
          if (currentUser.id.startsWith('anon-') && anonUserIdMap[currentUser.id]) {
            dbUserId = anonUserIdMap[currentUser.id];
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
          if (currentUser.id.startsWith('anon-') && anonUserIdMap[currentUser.id]) {
            dbUserId = anonUserIdMap[currentUser.id];
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
  
  // Helper function to get the user ID to display (either mapped UUID or regular ID)
  const getUserIdForDisplay = useCallback((userId: string) => {
    return getMappedUserId(userId);
  }, [getMappedUserId]);
  
  // Function to end an inactive race
  const endInactiveRace = useCallback(() => {
    if (!raceId || raceStatus !== 'racing') return;
    
    // Use the checkInactivity function from the hook
    if (checkInactivity()) {
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
  }, [raceId, raceStatus, stopAudio, checkInactivity]);
  
  // Add reference for inactivity check interval
  const inactivityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add reference for race finished state
  const raceFinishedRef = useRef<boolean>(false);

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
    
    // Get the mapped user ID for comparison
    const mappedUserId = getMappedUserId(currentUser.id);
    const isCreator = mappedUserId === raceCreator;
    
    console.log('Host check:', { 
      currentUserId: currentUser.id, 
      mappedUserId, 
      raceCreator, 
      isCreator 
    });
    
    return isCreator;
  }, [getCurrentUser, raceCreator, getMappedUserId]);
  
  // Helper to get creator display name - fix to ensure it returns the host name
  const getCreatorDisplayName = useCallback(() => {
    // Find the creator in the participants list
    const creator = participants.find(p => p.id === raceCreator);
    
    if (creator && creator.name) {
      return creator.name;
    }
    
    // Fallback: Check if current user is creator
    if (currentUser && getMappedUserId(currentUser.id) === raceCreator) {
      return getUserDisplayName(currentUser);
    }
    
    return 'the host';
  }, [participants, raceCreator, currentUser, getMappedUserId, getUserDisplayName]);
  
  /* eslint-enable @typescript-eslint/no-explicit-any */
  
  // Fix the Create New Race button to properly reset state
  const handleCreateNewRace = useCallback(() => {
    setRaceStage(RaceStage.INFO);
    setRaceStatus('created'); // Reset race status
    setRaceId(null); // Reset race ID
    stopAudio();
    // Reset progress state
    resetProgress();
    setStartTime(null);
    setFinishTime(null);
    
    // Navigate to home page without using history.pushState
    router.push('/');
  }, [stopAudio, router, resetProgress]);
  
  // Debugging to ensure host detection is working
  useEffect(() => {
    if (raceStage === RaceStage.SHARE) {
      console.log('Race Share Stage: Host check', {
        isHost: isRaceCreator(),
        raceCreator,
        currentUser: getCurrentUser()?.id,
        mappedId: getCurrentUser()?.id.startsWith('anon-') ? anonUserIdMap[getCurrentUser()?.id] : null
      });
    }
  }, [raceStage, isRaceCreator, raceCreator, getCurrentUser]);
  
  // Navigate to home page
  const handleNavigateHome = useCallback(() => {
    router.push('/');
  }, [router]);
  
  // Restore the updateProgress reference for compatibility
  useEffect(() => {
    updateProgressRef.current = (progress: number) => {
      if (currentUser) {
        const userId = getMappedUserId(currentUser.id, raceId || undefined);
        broadcastProgress(progress, errorCount);
      }
    };
  }, [broadcastProgress, getMappedUserId, currentUser, errorCount]);
  
  // Keep the race channel active even after race completion for invitation flow
  useEffect(() => {
    // This effect is focused on keeping the channel alive
    // The channel is established by the useRaceChannel hook
    
    if (raceId && raceStatus === 'finished') {
      // When race is finished, add a listener to keep the connection alive
      console.log('Race finished but keeping channel alive for potential invitations');
      
      // Return cleanup function that will only run when component unmounts or raceId changes
      return () => {
        console.log('Cleaning up race channel on unmount/race change');
      };
    }
  }, [raceId, raceStatus]);
  
  // Use race stage hooks
  const infoStage = useRaceInfoStage({
    raceMode,
    setRaceMode,
    createRace,
  });
  
  const shareStage = useRaceShareStage({
    raceId,
    raceText,
    raceMode,
    raceStatus,
    selectedLevelId: state.selectedLevelId,
    currentUser: getCurrentUser(),
    participants,
    onlineUsers,
    startRace,
    isRaceCreator,
    getCreatorDisplayName,
    getUserIdForDisplay,
  });
  
  const countdownStage = useRaceCountdownStage({
    countdownSeconds,
    raceText,
    participants,
    onlineUsers,
    currentUser: getCurrentUser(),
    getUserIdForDisplay,
    startRacing,
  });
  
  const playStage = useRacePlayStage({
    raceMode,
    raceText,
    userProgress,
    currentCharIndex,
    participants,
    onlineUsers,
    currentUser: getCurrentUser(),
    getUserIdForDisplay,
    keyerOutput,
    showCorrectIndicator,
    replayCurrent,
  });
  
  const resultsStage = useRaceResultsStage({
    stats,
    errorCount,
    raceText,
    participants,
    onlineUsers,
    currentUser: getCurrentUser(),
    getUserIdForDisplay,
    isCreatingRace,
    navigateHome: handleNavigateHome,
    handleRaceAgain,
  });
  
  // Render appropriate stage of race
  return (
    <div className={styles.container}>
      {raceStage === RaceStage.INFO && (
        <InfoStage
          raceMode={raceMode}
          onModeChange={infoStage.handleModeChange}
          onCreateRace={infoStage.handleCreateRace}
        />
      )}
      
      {raceStage === RaceStage.SHARE && (
        <ShareStage
          raceId={raceId || ''}
          raceMode={raceMode}
          raceStatus={raceStatus}
          raceLength={shareStage.raceLength}
          chars={shareStage.chars}
          levelId={state.selectedLevelId}
          isHost={shareStage.isHost}
          hostName={shareStage.hostName}
          participants={participants}
          currentUserId={shareStage.currentUserId}
          onlineUserIds={shareStage.onlineUserIds}
          onStartRace={shareStage.handleStartRace}
        />
      )}
      
      {raceStage === RaceStage.COUNTDOWN && (
        <CountdownStage
          seconds={countdownStage.seconds}
          participants={participants}
          currentUserId={countdownStage.currentUserId}
          raceLength={countdownStage.raceLength}
          onlineUserIds={countdownStage.onlineUserIds}
          onComplete={countdownStage.handleCountdownComplete}
        />
      )}
      
      {raceStage === RaceStage.RESULTS && (
        <ResultsStage
          stats={stats}
          errorCount={errorCount}
          participants={participants}
          currentUserId={resultsStage.currentUserId}
          raceLength={resultsStage.raceLength}
          onlineUserIds={resultsStage.onlineUserIds}
          isCreatingRace={isCreatingRace}
          onNavigateHome={resultsStage.handleNavigateHome}
          onRaceAgain={resultsStage.handleRaceAgain}
        />
      )}
      
      {raceStage === RaceStage.RACING && (
        <RacingStage
          raceMode={raceMode}
          raceText={raceText}
          userProgress={userProgress}
          currentCharIndex={currentCharIndex}
          participants={participants}
          currentUserId={playStage.currentUserId}
          raceLength={playStage.raceLength}
          onlineUserIds={playStage.onlineUserIds}
          keyerOutput={keyerOutput}
          showCorrectIndicator={showCorrectIndicator}
          onReplayCurrent={replayCurrent}
        />
      )}
      
      {/* Race invitation modal */}
      {invitationDetails && (
        <RaceInviteModal
          isOpen={!!invitationDetails}
          inviterName={invitationDetails.initiator_name || 'Someone'}
          onAccept={() => {
            console.log('User accepted redirect to race:', invitationDetails.new_race_id);
            if (invitationDetails.new_race_id) {
              window.location.href = `/race?id=${invitationDetails.new_race_id}`;
            }
            clearInvitation();
          }}
          onDecline={() => {
            clearInvitation();
            console.log('User declined redirect');
          }}
        />
      )}
    </div>
  );
};

export default EnhancedRaceMode;