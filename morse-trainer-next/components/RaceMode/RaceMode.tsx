import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from './RaceMode.module.css';
import { createAudioContext, morseMap, isBrowser } from '../../utils/morse';
import supabase from '../../utils/supabase';
import { useMorseAudio } from '../../hooks/useMorseAudio';
import { useAppState } from '../../contexts/AppStateContext';
import useAuth from '../../hooks/useAuth';
import { trainingLevels, TrainingLevel } from '../../utils/levels';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RaceParticipant {
  id: string;
  name: string;
  progress: number;
  finished: boolean;
  finishTime?: number;
}

interface RaceState {
  id: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  text: string;
  participants: RaceParticipant[];
  createdBy: string;
  countdownTime?: number;
  startTime?: number;
}

type RaceStatus = 'waiting' | 'countdown' | 'racing' | 'finished';

interface Player {
  id: string;
  name: string;
  progress: number;
}

interface Payload {
  text?: string;
  user_id?: string;
  progress?: number;
  winner?: string;
}

interface PresenceState {
  [key: string]: { 
    user_id: string;
    user_name: string;
    progress: number;
  }[];
}

const RaceMode: React.FC = () => {
  const router = useRouter();
  const { state } = useAppState();
  const { user } = useAuth();
  const [audioContextInstance, setAudioContextInstance] = useState<ReturnType<typeof createAudioContext> | null>(null);
  const { playMorseCode, stopAudio } = useMorseAudio();
  
  // Initialize audio context on client-side only
  useEffect(() => {
    if (isBrowser) {
      setAudioContextInstance(createAudioContext());
    }
  }, []);
  
  // Race state
  const [isHost, setIsHost] = useState(false);
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [raceText, setRaceText] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [currentChar, setCurrentChar] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [finishTime, setFinishTime] = useState<number | null>(null);
  const [raceStatus, setRaceStatus] = useState<RaceStatus>('waiting');
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [countDown, setCountDown] = useState(3);
  const [myProgress, setMyProgress] = useState(0);
  const [showSharingLink, setShowSharingLink] = useState(false);
  const [shareURL, setShareURL] = useState("");
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const textRef = useRef('');
  
  // Create a new race
  const createRace = useCallback(async () => {
    if (!user) return;
    
    // Generate random race text based on current level
    const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);
    const levelChars = currentLevel?.chars || state.chars;
    const raceLength = 20; // Fixed length for simplicity
    let text = '';
    
    for (let i = 0; i < raceLength; i++) {
      const randomIndex = Math.floor(Math.random() * levelChars.length);
      text += levelChars[randomIndex];
    }
    
    // Create a race record in Supabase
    const { data: race, error } = await supabase
      .from('races')
      .insert([{
        created_by: user.id,
        status: 'waiting',
        mode: 'copy',
        char_sequence: text,
        text: text,
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating race:', error);
      return;
    }
    
    // Create participant record for host
    const { error: participantError } = await supabase
      .from('race_participants')
      .insert([{
        race_id: race.id,
        user_id: user.id,
        name: user.email || 'Anonymous',
        progress: 0,
        finished: false,
      }]);
    
    if (participantError) {
      console.error('Error adding host as participant:', participantError);
    }
    
    // Set race state
    setRaceState({
      id: race.id,
      status: 'waiting',
      text: text,
      participants: [{
        id: user.id,
        name: user.email || 'Anonymous',
        progress: 0,
        finished: false
      }],
      createdBy: user.id,
    });
    
    setRaceText(text);
    setIsHost(true);
    
    // Generate share URL
    const shareUrl = `${window.location.origin}?race=${race.id}`;
    setShareUrl(shareUrl);
    
  }, [user, state.selectedLevelId, state.chars]);
  
  // Join an existing race
  const joinRace = useCallback(async (lobby: string) => {
    if (!user) return;
    
    // Subscribe to the race channel
    const channel = supabase.channel(`race:${lobby}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const participants = Object.values(presenceState).flatMap(
          (presence: any) => presence.map((p: { user_id: string; user_name: string; progress: number }) => ({
            id: p.user_id,
            name: p.user_name,
            progress: p.progress || 0
          }))
        );
        setPlayers(participants as Player[]);
      })
      .on('broadcast', { event: 'race_start' }, (payload: { payload: Payload }) => {
        if (payload.payload.text) {
          textRef.current = payload.payload.text;
          setCurrentText(payload.payload.text);
        }
        setRaceStatus('countdown');
        
        let count = 3;
        const intervalId = setInterval(() => {
          count -= 1;
          setCountDown(count);
          
          if (count === 0) {
            clearInterval(intervalId);
            setRaceStatus('racing');
            playMorseCode(textRef.current);
          }
        }, 1000);
      })
      .on('broadcast', { event: 'player_progress' }, (payload: { payload: Payload }) => {
        if (payload.payload.user_id && payload.payload.progress !== undefined) {
          setPlayers(prev => 
            prev.map(player => 
              player.id === payload.payload.user_id 
                ? { ...player, progress: payload.payload.progress || 0 } 
                : player
            )
          );
        }
      })
      .on('broadcast', { event: 'race_end' }, () => {
        setRaceStatus('finished');
        stopAudio();
      });
    
    await channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED' && user) {
        await channel.track({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
          progress: 0,
        });
      }
    });
    
    channelRef.current = channel;
  }, [user, playMorseCode, stopAudio]);
  
  // Start the race (host only)
  const startRace = useCallback(async () => {
    if (!isHost || !raceState) return;
    
    // Update race status to countdown
    await supabase
      .from('races')
      .update({ status: 'countdown' })
      .eq('id', raceState.id);
    
    // Set local state to countdown
    setRaceState(prev => prev ? { ...prev, status: 'countdown' } : null);
    setCountdown(5); // 5 second countdown
    
    // Start countdown
    let count = 5;
    const countdownInterval = setInterval(async () => {
      count -= 1;
      setCountdown(count);
      
      if (count <= 0) {
        clearInterval(countdownInterval);
        
        // Update race status to racing and set start time
        const startTime = Date.now();
        await supabase
          .from('races')
          .update({ 
            status: 'racing',
            start_time: startTime
          })
          .eq('id', raceState.id);
        
        // Set local state to racing
        setRaceState(prev => prev ? { 
          ...prev, 
          status: 'racing',
          startTime
        } : null);
        
        setStartTime(startTime);
        
        // Start playing first character
        if (raceText.length > 0) {
          setCurrentChar(raceText[0]);
          audioContextInstance?.playMorse(raceText[0]).then(() => {
            setWaitingForInput(true);
          });
        }
      }
    }, 1000);
    
  }, [isHost, raceState, raceText, audioContextInstance]);
  
  // Handle keyboard input during race
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!raceState || raceState.status !== 'racing' || !waitingForInput || !user) return;
    
    const input = e.key.toLowerCase();
    const target = currentChar.toLowerCase();
    
    if (input === target) {
      // Correct input
      setWaitingForInput(false);
      
      // Update progress
      const newProgress = progress + 1;
      setProgress(newProgress);
      setMyProgress(Math.floor((newProgress / raceText.length) * 100));
      
      // Update progress in Supabase
      const userId = user.id;
      supabase
        .from('race_participants')
        .update({ progress: newProgress })
        .eq('race_id', raceState.id)
        .eq('user_id', userId);
      
      // Broadcast progress to other participants
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_progress',
          payload: { user_id: userId, progress: Math.floor((newProgress / raceText.length) * 100) }
        });
      }
      
      // Check if race is complete
      if (newProgress >= raceText.length) {
        const endTime = Date.now();
        setFinishTime(endTime);
        
        // Update participant as finished
        supabase
          .from('race_participants')
          .update({ 
            finished: true,
            finish_time: endTime,
            progress: raceText.length
          })
          .eq('race_id', raceState.id)
          .eq('user_id', userId);
          
        // Broadcast race end
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'race_end',
            payload: { winner: userId }
          });
        }
        
        setRaceStatus('finished');
        stopAudio();
      } else {
        // Play next character
        const nextChar = raceText[newProgress];
        setCurrentChar(nextChar);
        
        audioContextInstance?.playMorse(nextChar).then(() => {
          setWaitingForInput(true);
        });
      }
    } else {
      // Incorrect input - play error sound and increment error count
      audioContextInstance?.playErrorSound().then(() => {
        setErrorCount(prev => prev + 1);
        
        // Replay the current character after a short delay
        setTimeout(() => {
          audioContextInstance?.playMorse(currentChar).then(() => {
            setWaitingForInput(true);
          });
        }, 750); // Match training mode delay
      });
    }
  }, [raceState, waitingForInput, currentChar, progress, raceText, user, audioContextInstance, channelRef, setMyProgress, setRaceStatus, setFinishTime, setErrorCount, stopAudio, supabase]);
  
  // Copy share URL to clipboard
  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);
  
  // Set up keyboard listener for race
  useEffect(() => {
    if (raceState?.status === 'racing' && isBrowser) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      if (isBrowser) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [raceState?.status, handleKeyDown]);
  
  // Set up realtime subscription to race updates
  useEffect(() => {
    if (!raceState) return;
    
    const raceSubscription = supabase
      .channel(`race_${raceState.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'races',
        filter: `id=eq.${raceState.id}`
      }, (payload) => {
        const updatedRace = payload.new;
        
        // Update local race state
        setRaceState(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            status: updatedRace.status,
            startTime: updatedRace.start_time
          };
        });
        
        // Handle race starting
        if (updatedRace.status === 'racing' && raceState.status !== 'racing') {
          setStartTime(updatedRace.start_time);
          
          // Start playing first character
          if (raceText.length > 0) {
            setCurrentChar(raceText[0]);
            audioContextInstance?.playMorse(raceText[0]).then(() => {
              setWaitingForInput(true);
            });
          }
        }
      })
      .subscribe();
      
    const participantsSubscription = supabase
      .channel(`participants_${raceState.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'race_participants',
        filter: `race_id=eq.${raceState.id}`
      }, async () => {
        // Fetch updated participants
        const { data: participants } = await supabase
          .from('race_participants')
          .select('*')
          .eq('race_id', raceState.id);
          
        // Update local race state
        setRaceState(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            participants: participants?.map(p => ({
              id: p.user_id,
              name: p.name,
              progress: p.progress,
              finished: p.finished,
              finishTime: p.finish_time
            })) || []
          };
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(raceSubscription);
      supabase.removeChannel(participantsSubscription);
    };
  }, [raceState?.id, raceState?.status, raceText, audioContextInstance]);
  
  // Check for race ID in URL on component mount
  useEffect(() => {
    if (!isBrowser || !user) return;
    
    const url = new URL(window.location.href);
    const raceId = url.searchParams.get('race');
    
    if (raceId) {
      joinRace(raceId);
    }
  }, [user, joinRace]);
  
  useEffect(() => {
    if (!isBrowser) return;
    
    const { lobby } = router.query;
    
    if (typeof lobby === 'string') {
      setLobbyId(lobby);
      joinRace(lobby);
    }
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe().catch((err: Error) => {
          console.error("Error unsubscribing from channel:", err);
        });
      }
      stopAudio();
    };
  }, [router.query, joinRace, stopAudio]);
  
  // Render race progress indicators
  const renderProgress = () => {
    if (!raceState) return null;
    
    return (
      <div className={styles.progressContainer}>
        {raceState.participants.map(participant => {
          const progressPercent = raceText.length > 0 
            ? (participant.progress / raceText.length) * 100 
            : 0;
            
          return (
            <div key={participant.id} className={styles.participantProgress}>
              <div className={styles.participantName}>
                {participant.name} {participant.id === user?.id ? '(You)' : ''}
                {participant.finished ? ' - Finished!' : ''}
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render race results
  const renderResults = () => {
    if (!raceState || raceState.status !== 'finished') return null;
    
    // Sort participants by finish time
    const sortedParticipants = [...raceState.participants]
      .filter(p => p.finished && p.finishTime)
      .sort((a, b) => (a.finishTime || 0) - (b.finishTime || 0));
      
    // Calculate WPM for the user
    const userParticipant = raceState.participants.find(p => p.id === user?.id);
    let userWpm = 0;
    
    if (userParticipant?.finished && userParticipant.finishTime && startTime) {
      const durationMinutes = (userParticipant.finishTime - startTime) / 1000 / 60;
      userWpm = Math.round((raceText.length / 5) / durationMinutes); // Using standard 5 chars per word
    }
    
    return (
      <div className={styles.resultsContainer}>
        <h2>Race Results</h2>
        {userParticipant?.finished && (
          <div className={styles.userStats}>
            <p>Your speed: {userWpm} WPM</p>
            <p>Errors: {errorCount}</p>
          </div>
        )}
        <div className={styles.rankings}>
          <h3>Rankings</h3>
          <ol className={styles.rankingsList}>
            {sortedParticipants.map((p, index) => (
              <li key={p.id} className={p.id === user?.id ? styles.currentUser : ''}>
                {index + 1}. {p.name} {p.id === user?.id ? '(You)' : ''}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  };
  
  const formatLobbyLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/race?lobby=${lobbyId}`;
  };
  
  const copyLobbyLink = () => {
    navigator.clipboard.writeText(formatLobbyLink());
  };
  
  const createNewLobby = async () => {
    const newLobbyId = Math.random().toString(36).substring(2, 8);
    await router.push(`/race?lobby=${newLobbyId}`);
  };
  
  // Add a replay function to replay the current character
  const replayCurrentChar = useCallback(() => {
    if (raceStatus !== 'racing' || !textRef.current || textRef.current.length === 0) return;
    
    // Calculate the current character index based on progress
    const charIndex = Math.min(
      Math.floor((myProgress / 100) * (textRef.current?.length || 0)),
      (textRef.current?.length || 0) - 1
    );
    // Play the current character again if available
    const charToPlay = textRef.current[charIndex];
    if (charToPlay) {
      playMorseCode(charToPlay).catch(err => {
        console.error("Error replaying character:", err);
      });
    }
  }, [raceStatus, myProgress, playMorseCode]);
  
  // Handle Tab key press to replay character
  useEffect(() => {
    if (raceStatus !== 'racing') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent tab from changing focus
        replayCurrentChar();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [raceStatus, replayCurrentChar]);
  
  // Add error handling for audio playback
  const playSoundWithErrorHandling = useCallback((char: string) => {
    return playMorseCode(char).catch(err => {
      console.error("Error playing morse code:", err);
      // Continue with race even if audio fails
    });
  }, [playMorseCode]);
  
  if (!user) {
    return (
      <div className={styles.raceContainer}>
        <div className={styles.loginMessage}>
          <h2>Please log in to participate in races</h2>
          <p>Race mode requires an account to track participants and scores.</p>
          <button 
            className={styles.button}
            onClick={() => router.push('/login')}
          >
            Log in or Create Account
          </button>
        </div>
      </div>
    );
  }
  
  if (!lobbyId) {
    return (
      <div className={styles.raceContainer}>
        <div className={styles.lobby}>
          <h2>Morse Race</h2>
          <p>Challenge others to a morse code typing race!</p>
          <button onClick={createNewLobby} className={styles.button}>
            Create New Lobby
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.raceContainer}>
      <div className={styles.raceInfo}>
        <h2>Morse Race</h2>
        {raceStatus === 'waiting' && (
          <div className={styles.waitingRoom}>
            <p>Waiting for players to join...</p>
            <div className={styles.lobbyLink}>
              <input 
                type="text" 
                value={formatLobbyLink()} 
                readOnly 
                className={styles.linkInput}
              />
              <button onClick={copyLobbyLink} className={styles.copyButton}>
                Copy
              </button>
            </div>
            <button onClick={startRace} className={styles.button}>
              Start Race
            </button>
          </div>
        )}
        
        {raceStatus === 'countdown' && (
          <div className={styles.countdown}>
            <h1>{countDown}</h1>
          </div>
        )}
        
        {(raceStatus === 'racing' || raceStatus === 'finished') && (
          <div className={styles.raceContent}>
            <div className={styles.textDisplay}>
              <h3>Type the characters as you hear them:</h3>
              <div className={styles.progressInfo}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${myProgress}%` }}
                  />
                </div>
                <div className={styles.characterCount}>
                  {Math.floor((myProgress / 100) * (textRef.current ? textRef.current.length : 0))} / 
                  {textRef.current ? textRef.current.length : 0} characters
                </div>
              </div>
              
              {raceStatus === 'racing' && (
                <div className={styles.currentCharContainer}>
                  <div className={styles.currentCharPrompt}>Current character:</div>
                  <div className={styles.currentChar}>{waitingForInput ? currentChar : '...'}</div>
                </div>
              )}
            </div>
            
            <div className={styles.raceControls}>
              <button 
                onClick={replayCurrentChar}
                className={styles.replayButton}
                disabled={raceStatus !== 'racing'}
              >
                Replay Sound
              </button>
              <div className={styles.hint}>
                Press Tab to replay the current character sound
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className={styles.playersList}>
        <h3>Players</h3>
        {players.map((player) => (
          <div key={player.id} className={styles.playerItem}>
            <span>{player.name}</span>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${player.progress}%` }}
              />
            </div>
            <span>{player.progress}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RaceMode; 