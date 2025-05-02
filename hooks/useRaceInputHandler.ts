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
  keyStateRef: React.MutableRefObject<{ ArrowLeft: boolean; ArrowRight: boolean }>;
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
  
  // References for send mode
  const keyStateRef = useRef({ ArrowLeft: false, ArrowRight: false });
  const sendQueueRef = useRef<string[]>([]);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingMorseRef = useRef(false);

  // Get the expected Morse code pattern for the current character
  const getExpectedMorse = useCallback(() => {
    if (currentCharIndex >= raceText.length) return '';
    const currentChar = raceText[currentCharIndex]?.toLowerCase();
    return morseMap[currentChar] || '';
  }, [raceText, currentCharIndex]);

  // Evaluate the sent Morse code
  const evaluateMorse = useCallback((sentMorse: string) => {
    if (processingMorseRef.current) return;
    
    // Don't evaluate empty input
    if (!sentMorse || sentMorse.length === 0) return;
    
    // If we've already evaluated this exact input, don't evaluate it again
    if (sentMorse === lastEvaluatedInputRef.current) return;
    
    // Remember this input to prevent duplicate evaluations
    lastEvaluatedInputRef.current = sentMorse;
    
    processingMorseRef.current = true;
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      processingMorseRef.current = false;
      return;
    }
    
    const expectedMorse = getExpectedMorse();
    console.log('Evaluating morse:', { sent: sentMorse, expected: expectedMorse });
    
    if (sentMorse === expectedMorse) {
      // Correct morse code
      setShowCorrectIndicator(true);
      
      // Clear the queue and reset keyerOutput
      sendQueueRef.current = [];
      
      // Slight pause before continuing
      setTimeout(() => {
        setShowCorrectIndicator(false);
        setKeyerOutput('');
        codeBufferRef.current = ''; // Reset the buffer
        
        // Get proper user ID with mapping
        const userId = getMappedUserId(currentUser.id, raceId || undefined);
        
        // Increment progress using the hook function
        incrementProgress(currentCharIndex, userId);
        
        // Check if user has completed the race
        if (currentCharIndex + 1 >= raceText.length) {
          finishRace();
          stopAudio();
        }
        
        processingMorseRef.current = false;
      }, 400); // 400ms pause
    } else if (sentMorse.length >= expectedMorse.length || sentMorse.length >= 7) {
      // Incorrect or too long - consider it a mistake
      incrementErrorCount();
      
      // Clear the queue and reset keyerOutput and buffer after a delay
      setTimeout(() => {
        sendQueueRef.current = [];
        setKeyerOutput('');
        codeBufferRef.current = ''; // Reset the buffer
        processingMorseRef.current = false;
      }, 600);
      
      // Play error sound if available
      if (audioContext) {
        audioContext.playErrorSound().catch((err: Error) => {
          console.error("Error playing error sound:", err);
        });
      }
    } else {
      // Still building the pattern
      processingMorseRef.current = false;
    }
  }, [
    getCurrentUser, 
    getExpectedMorse, 
    incrementProgress, 
    incrementErrorCount, 
    currentCharIndex, 
    finishRace, 
    stopAudio, 
    raceText.length, 
    audioContext,
    getMappedUserId,
    raceId
  ]);

  // References for tracking the morse code buffer and preventing duplicate evaluations
  const codeBufferRef = useRef('');
  const lastEvaluatedInputRef = useRef('');
  
  // Process the send queue at regular intervals - using similar timing logic as SendingMode
  useEffect(() => {
    if (raceStage !== RaceStage.RACING || raceMode !== 'send') {
      // Clean up interval if not in send mode racing
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
      return;
    }
    
    let lastTime = Date.now();
    
    // Set up interval to check character breaks and handle timing
    sendIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const gap = now - lastTime;
      const sendUnit = 1200 / (sendWpm || 20); // Use sendWpm prop or default to 20
      
      // Process queue items first
      if (sendQueueRef.current.length > 0) {
        // Add the new symbols to keyer output
        const newSymbols = sendQueueRef.current.join('');
        setKeyerOutput(prev => {
          const updatedOutput = prev + newSymbols;
          codeBufferRef.current = updatedOutput;
          return updatedOutput;
        });
        sendQueueRef.current = []; // Clear the queue after processing
        lastTime = now;
        return;
      }
      
      // Character gap detection (>=3 units) - similar to SendingMode
      if (gap >= sendUnit * 3 && codeBufferRef.current && !processingMorseRef.current) {
        // Only evaluate if there's something to evaluate and we're not already processing
        const bufferToEvaluate = codeBufferRef.current;
        
        // Clear the buffer immediately to prevent double evaluation
        codeBufferRef.current = '';
        
        // Evaluate the morse after sufficient gap time
        evaluateMorse(bufferToEvaluate);
        
        // Reset the timing
        lastTime = now;
      }
      
      // Word gap detection (>=7 units) - similar to SendingMode
      // Only evaluate if we haven't already processed this input and if there's input to evaluate
      if (gap >= sendUnit * 7 && keyerOutput && !processingMorseRef.current && keyerOutput !== lastEvaluatedInputRef.current) {
        // If we have output but user has stopped keying for word gap duration
        // and we haven't evaluated it yet, force evaluation once
        const outputToEvaluate = keyerOutput;
        
        // Evaluate the code
        evaluateMorse(outputToEvaluate);
        
        // Reset the timing
        lastTime = now;
      }
    }, 50); // Check more frequently (50ms) to be more responsive
    
    return () => {
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
    };
  }, [raceStage, raceMode, keyerOutput, evaluateMorse]);

  // Replay current character function
  const replayCurrent = useCallback(() => {
    if (raceStage !== RaceStage.RACING || currentCharIndex >= raceText.length) return;
    
    // Play the current character again
    playMorseChar(raceText[currentCharIndex]);
  }, [raceStage, raceText, currentCharIndex, playMorseChar]);

  // Handle keydown events
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
          
          // Play dot sound (short tone)
          if (audioContext) {
            audioContext.playTone(600, 60, 1.0).catch((err: Error) => {
              console.error("Error playing dot sound:", err);
            });
          }
        }
        
        // Update ref state immediately
        keyStateRef.current.ArrowLeft = true;
        
        return;
      } 
      else if (e.key === 'ArrowRight') {
        e.preventDefault();
        console.log(`ArrowRight DOWN (ref state: ${JSON.stringify(keyStateRef.current)})`);
        
        // Only queue a dash if key wasn't already pressed
        if (!keyStateRef.current.ArrowRight) {
          console.log('Queueing a DASH');
          sendQueueRef.current.push('-');
          
          // Play dash sound (longer tone)
          if (audioContext) {
            audioContext.playTone(600, 180, 1.0).catch((err: Error) => {
              console.error("Error playing dash sound:", err);
            });
          }
        }
        
        // Update ref state immediately
        keyStateRef.current.ArrowRight = true;
        
        return;
      }
      
      // Process other keys in send mode
      if (e.key === 'Escape') {
        // Cancel race
        e.preventDefault();
        // Clear send queue and state
        sendQueueRef.current = [];
        keyStateRef.current = { ArrowLeft: false, ArrowRight: false };
        setKeyerOutput('');
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
        
        // Get proper user ID with mapping
        const userId = getMappedUserId(currentUser.id, raceId || undefined);
        
        // Increment progress using the hook function
        incrementProgress(currentCharIndex, userId);
        
        // Check if user has completed the race
        if (currentCharIndex + 1 >= raceText.length) {
          finishRace();
          stopAudio();
        } else if (raceMode === 'copy') {
          // Only play the next character in copy mode
          playMorseChar(raceText[currentCharIndex + 1]);
        }
      }, 400); // 400ms pause
    } else {
      // Incorrect input - play error sound
      incrementErrorCount();
      
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
        }).catch((err: Error) => {
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
  }, [
    raceStage, 
    raceText, 
    getCurrentUser, 
    finishRace, 
    stopAudio, 
    currentCharIndex, 
    playMorseChar, 
    audioContext, 
    userInput, 
    raceMode, 
    replayCurrent, 
    getMappedUserId,
    incrementProgress,
    incrementErrorCount,
    raceId
  ]);
  
  // Handle keyup event for send mode
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (raceStage !== RaceStage.RACING || raceMode !== 'send') return;
    
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      console.log(`${e.key} UP (ref state: ${JSON.stringify(keyStateRef.current)})`);
      
      // Update ref state immediately
      keyStateRef.current[e.key as 'ArrowLeft' | 'ArrowRight'] = false;
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

  return {
    userInput,
    keyerOutput,
    showCorrectIndicator,
    replayCurrent,
    keyStateRef,
    sendQueueRef
  };
} 