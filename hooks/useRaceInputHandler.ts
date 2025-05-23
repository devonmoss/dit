import { useState, useCallback, useRef, useEffect } from 'react';
import { RaceMode, RaceStage } from '../types/raceTypes';
import { morseMap, invMorseMap } from '../utils/morse';

interface UseRaceInputHandlerProps {
  raceStage: RaceStage;
  raceMode: RaceMode;
  raceText: string;
  currentCharIndex: number;
  incrementProgress: (charIndex: number, userId: string) => void;
  incrementErrorCount: () => void;
  finishRace: () => Promise<void>;
  stopAudio: () => void;
  playMorseChar: (char: string) => Promise<void>;
  audioContext: any | null;
  getCurrentUser: () => any;
  getMappedUserId: (userId: string, raceId?: string) => string;
  raceId: string | null;
  sendWpm?: number; // Optional WPM for send mode
}

interface UseRaceInputHandlerResult {
  userInput: string;
  keyerOutput: string;
  showCorrectIndicator: boolean;
  replayCurrent: () => void;
  keyStateRef: React.MutableRefObject<{ ArrowLeft: boolean; ArrowRight: boolean; ControlLeft: boolean; ControlRight: boolean }>;
  sendQueueRef: React.MutableRefObject<string[]>;
}

export function useRaceInputHandler({
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
  raceId,
  sendWpm = 20 // Default to 20 WPM if not provided
}: UseRaceInputHandlerProps): UseRaceInputHandlerResult {
  // State for input handling
  const [userInput, setUserInput] = useState('');
  const [showCorrectIndicator, setShowCorrectIndicator] = useState(false);
  const [keyerOutput, setKeyerOutput] = useState('');
  const [codeBuffer, setCodeBuffer] = useState('');
  const [wordBuffer, setWordBuffer] = useState('');
  
  // References for input handling
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendQueueRef = useRef<string[]>([]);
  const keyStateRef = useRef({ 
    ArrowLeft: false, 
    ArrowRight: false,
    ControlLeft: false, 
    ControlRight: false 
  });
  
  // Get the expected Morse code pattern for the current character
  const getExpectedMorse = useCallback(() => {
    if (currentCharIndex >= raceText.length) return '';
    const currentChar = raceText[currentCharIndex]?.toLowerCase();
    return morseMap[currentChar] || '';
  }, [raceText, currentCharIndex]);

  // Function to play a sound for a symbol (dot/dash)
  const playSendSymbol = useCallback(async (symbol: string) => {
    if (!audioContext) return;
    const sendUnit = 1200 / (sendWpm || 20);
    const duration = symbol === '.' ? sendUnit : sendUnit * 3;
    
    // Use the audio context to play the tone
    if (audioContext) {
      try {
        await audioContext.playTone(600, duration, 1.0);
      } catch (err) {
        console.error(`Error playing ${symbol} sound:`, err);
      }
    }
  }, [audioContext, sendWpm]);

  // Handle when a word/character is completed
  const handleWordComplete = useCallback((word: string) => {
    if (raceStage !== RaceStage.RACING || raceMode !== 'send') return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const expectedChar = raceText[currentCharIndex]?.toLowerCase();
    if (!expectedChar) {
      return;
    }
    
    // Check if the sent word matches the current character
    if (word.toLowerCase() === expectedChar.toLowerCase()) {
      // Correct match
      setShowCorrectIndicator(true);
      
      // Slight pause before continuing
      setTimeout(() => {
        setShowCorrectIndicator(false);
        setKeyerOutput('');
        setCodeBuffer('');
        setWordBuffer('');
        
        // Get proper user ID with mapping
        const userId = getMappedUserId(currentUser.id, raceId || undefined);
        
        // Increment progress
        incrementProgress(currentCharIndex, userId);
        
        // Check if user has completed the race
        if (currentCharIndex + 1 >= raceText.length) {
          finishRace();
          stopAudio();
        }
      }, 400); // 400ms pause
    } else {
      // Incorrect
      incrementErrorCount();
      
      // Reset keyer state
      setTimeout(() => {
        setKeyerOutput('');
        setCodeBuffer('');
        setWordBuffer('');
      }, 600);
      
      // Play error sound if available
      if (audioContext) {
        audioContext.playErrorSound().catch((err: Error) => {
          console.error("Error playing error sound:", err);
        });
      }
    }
  }, [
    raceStage,
    raceMode,
    getCurrentUser,
    raceText,
    currentCharIndex, 
    getMappedUserId,
    raceId,
    incrementProgress,
    finishRace,
    stopAudio,
    incrementErrorCount,
    audioContext
  ]);

  // Main sending loop - copied directly from SendingMode
  useEffect(() => {
    if (raceStage !== RaceStage.RACING || raceMode !== 'send') return;
    
    let lastSymbol: string | null = null;
    let lastTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;
    let active = true;
    
    // Local buffers to avoid state update issues
    let localCodeBuffer = '';
    let localWordBuffer = '';
    
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
        const sendUnit = 1200 / (sendWpm || 20);
        
        // Word gap detection: >=7 units
        if (gap >= sendUnit * 7 && (localCodeBuffer || localWordBuffer)) {
          // decode pending letter
          if (localCodeBuffer) {
            const letter = invMorseMap[localCodeBuffer] || "?";
            setWordBuffer(prev => prev + letter);
            localWordBuffer += letter;
            localCodeBuffer = '';
            setCodeBuffer('');
          }
          
          // Word complete: evaluate
          if (localWordBuffer) {
            handleWordComplete(localWordBuffer);
          } 
          
          // Clear displays
          setKeyerOutput('');
          setWordBuffer('');
          localWordBuffer = '';
          
          lastTime = now;
          await wait(10);
          continue;
        }
        
        // Letter gap detection: >=3 units
        if (gap >= sendUnit * 3 && localCodeBuffer) {
          const letter = invMorseMap[localCodeBuffer] || "?";
          setWordBuffer(prev => prev + letter);
          localWordBuffer += letter;
          localCodeBuffer = '';
          setCodeBuffer('');
          lastTime = now;
        }
        
        // determine next symbol: queued taps first
        let symbol: string | undefined;
        
        if (sendQueueRef.current.length > 0) {
          symbol = sendQueueRef.current.shift();
        } else {
          // Key state for iambic keying
          const leftArrow = keyStateRef.current.ArrowLeft;
          const rightArrow = keyStateRef.current.ArrowRight;
          const leftCtrl = keyStateRef.current.ControlLeft;
          const rightCtrl = keyStateRef.current.ControlRight;
          
          // Either arrow key or control key can be used
          const left = leftArrow || leftCtrl;
          const right = rightArrow || rightCtrl;
          
          if (!left && !right) {
            await wait(10);
            continue;
          } else if (left && right) {
            // Iambic squeezing - alternate between dot and dash
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
  }, [raceStage, raceMode, sendWpm, handleWordComplete, playSendSymbol]);

  // Replay current character
  const replayCurrent = useCallback(() => {
    if (raceStage === RaceStage.RACING && raceMode === 'copy' && currentCharIndex < raceText.length) {
      const currentChar = raceText[currentCharIndex];

      
      if (currentChar && audioContext) {
        playMorseChar(currentChar).catch(err => {
          console.error('AUDIO DEBUG: Error playing morse char:', err);
        });
      }
    }
  }, [raceStage, raceMode, raceText, currentCharIndex, playMorseChar, audioContext]);

  // Auto-play first character when race starts
  useEffect(() => {
    if (raceStage === RaceStage.RACING && raceMode === 'copy' && currentCharIndex === 0 && raceText.length > 0) {
      setTimeout(() => {
      });
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        if (raceText[0] && audioContext) {
          playMorseChar(raceText[0]).catch(err => {
            console.error('AUDIO DEBUG: Error auto-playing first character:', err);
          });
        }
      }, 100);
    }
  }, [raceStage, raceMode, raceText, currentCharIndex, playMorseChar, audioContext]);

  // Handle keydown events - copied directly from SendingMode's approach
  useEffect(() => {
    if (raceStage !== RaceStage.RACING) return;
    
    const keyDownHandler = (e: KeyboardEvent) => {
      // Only handle events during active racing in send mode
      if (raceStage !== RaceStage.RACING) return;
      
      // Tab key for replaying current character (in copy mode only)
      if (e.key === 'Tab' && raceMode === 'copy') {
        e.preventDefault();
        replayCurrent();
        return;
      }
      
      // Special handling for send mode with arrow keys
      if (raceMode === 'send') {
        // Handle paddle key presses for send mode
        if (e.key === 'ArrowLeft' || e.code === 'ControlLeft') {
          e.preventDefault();
          
          // Only queue a dot if key wasn't already pressed
          const keyRef = e.key === 'ArrowLeft' ? 'ArrowLeft' : 'ControlLeft';
          if (!keyStateRef.current[keyRef]) {
            sendQueueRef.current.push('.');
          }
          
          // Update ref state immediately
          keyStateRef.current[keyRef] = true;
          return;
        } 
        else if (e.key === 'ArrowRight' || e.code === 'ControlRight') {
          e.preventDefault();
          
          // Only queue a dash if key wasn't already pressed
          const keyRef = e.key === 'ArrowRight' ? 'ArrowRight' : 'ControlRight';
          if (!keyStateRef.current[keyRef]) {
            sendQueueRef.current.push('-');
          }
          
          // Update ref state immediately
          keyStateRef.current[keyRef] = true;
          return;
        }
        
        // Escape to cancel race
        if (e.key === 'Escape') {
          // Cancel race
          e.preventDefault();
          // Clear send queue and state
          sendQueueRef.current = [];
          keyStateRef.current = { 
            ArrowLeft: false, 
            ArrowRight: false,
            ControlLeft: false, 
            ControlRight: false 
          };
          setKeyerOutput('');
          setCodeBuffer('');
          setWordBuffer('');
          return;
        }
        
        return; // Don't process other keys in send mode
      }
      
      // Below is the copy mode logic for regular typing
      if (raceMode === 'copy') {
        // Only process alphanumeric keys and basic punctuation
        if (!/^[a-zA-Z0-9\s.,?!]$/.test(e.key)) return;
        
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        const input = e.key.toLowerCase();
        const expectedChar = raceText[currentCharIndex]?.toLowerCase();
        
        if (!expectedChar) return;
        
        // Process the character input
        if (input === expectedChar) {
          // Show correct indicator
          setShowCorrectIndicator(true);
          
          // Slight pause before continuing
          setTimeout(() => {
            setShowCorrectIndicator(false);
            
            // Correct input
            const newInput = userInput + input;
            setUserInput(newInput);
            
            // Get proper user ID with mapping
            const userId = getMappedUserId(currentUser.id, raceId || undefined);
            
            // Increment progress
            incrementProgress(currentCharIndex, userId);
            
            // Check if user has completed the race
            if (currentCharIndex + 1 >= raceText.length) {
              finishRace();
              stopAudio();
            } else {
              // Only play the next character in copy mode
              playMorseChar(raceText[currentCharIndex + 1]);
            }
          }, 400); // 400ms pause
        } else {
          // Incorrect input - play error sound
          incrementErrorCount();
          
          if (audioContext) {
            audioContext.playErrorSound().catch(() => {/* ignore errors */});
            
            // Replay the current character after a delay
            setTimeout(() => {
              if (currentCharIndex < raceText.length) {
                playMorseChar(raceText[currentCharIndex]);
              }
            }, 750);
          }
        }
      }
    };
    
    const keyUpHandler = (e: KeyboardEvent) => {
      // Only handle events during active racing in send mode
      if (raceStage !== RaceStage.RACING || raceMode !== 'send') return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
          e.code === 'ControlLeft' || e.code === 'ControlRight') {
        e.preventDefault();
        
        // Update ref state immediately
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          keyStateRef.current[e.key] = false;
        } else {
          keyStateRef.current[e.code as 'ControlLeft' | 'ControlRight'] = false;
        }
      }
    };
    
    // Add event listeners
    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);
    
    return () => {
      document.removeEventListener('keydown', keyDownHandler);
      document.removeEventListener('keyup', keyUpHandler);
    };
  }, [
    raceStage,
    raceMode,
    replayCurrent,
    raceText,
    currentCharIndex,
    getCurrentUser,
    getMappedUserId,
    raceId,
    incrementProgress,
    incrementErrorCount,
    finishRace,
    stopAudio,
    playMorseChar,
    audioContext,
    userInput
  ]);

  return {
    userInput,
    keyerOutput,
    showCorrectIndicator,
    replayCurrent,
    keyStateRef,
    sendQueueRef
  };
}