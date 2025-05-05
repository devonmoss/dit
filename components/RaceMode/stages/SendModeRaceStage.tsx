import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RaceParticipant } from '../../../types/raceTypes';
import RaceParticipants from '../../RaceParticipants/RaceParticipants';
import { useIambicKeyer } from '../../../hooks/useIambicKeyer';
import styles from '../RaceMode.module.css';

// Add development mode check
const isDevelopment = process.env.NODE_ENV === 'development';

interface SendModeRaceStageProps {
  raceText: string;
  userProgress: number;
  currentCharIndex: number;
  participants: RaceParticipant[];
  currentUserId: string;
  raceLength: number;
  onlineUserIds: string[];
  onCharacterCorrect: (index: number) => void;
  onError: () => void;
  onComplete: () => void;
  audioContext: any | null;
  sendWpm: number;
}

/**
 * Send Mode Race Stage Component - A dedicated component for Morse code sending races
 */
const SendModeRaceStage: React.FC<SendModeRaceStageProps> = ({
  raceText,
  userProgress,
  currentCharIndex,
  participants,
  currentUserId,
  raceLength,
  onlineUserIds,
  onCharacterCorrect,
  onError,
  onComplete,
  audioContext,
  sendWpm
}) => {
  // State for UI feedback
  const [keyerOutput, setKeyerOutput] = useState('');
  const [showCorrectIndicator, setShowCorrectIndicator] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [keyState, setKeyState] = useState({ left: false, right: false });
  
  // Reference to track if we're still mounted - ENSURE it starts as true
  const isMountedRef = useRef(true);
  
  // Reference to track if keyer is installed
  const isInstalledRef = useRef(false);
  
  // Reference to track the last character we processed
  const lastProcessedCharRef = useRef<string | null>(null);
  
  // Use an effect to force the mounted state to true
  useEffect(() => {
    console.log('[SEND MODE] 🔒 Setting isMountedRef to TRUE');
    isMountedRef.current = true;
    return () => {
      console.log('[SEND MODE] 🔓 Setting isMountedRef to FALSE (unmounting)');
      isMountedRef.current = false;
    };
  }, []);
  
  // Add logs for props on every render
  console.log("[SEND MODE] RENDER with props:", { 
    raceText: raceText.substring(0, 20) + (raceText.length > 20 ? '...' : ''),
    userProgress, 
    currentCharIndex,
    currentCharacter: raceText[currentCharIndex] || 'none',
    participantsCount: participants.length,
    isMounted: isMountedRef.current,
  });
  
  // Function to play sound when a dot or dash is keyed
  const playElementSound = useCallback((sym: '.' | '-') => {
    if (!audioContext) {
      console.log('[SEND MODE] No audio context available');
      return;
    }
    
    const unitDuration = 1200 / sendWpm;
    const duration = sym === '.' ? unitDuration : unitDuration * 3;
    
    console.log(`[SEND MODE] Playing ${sym} with duration ${duration}ms`);
    
    audioContext.playTone(600, duration, 1.0)
      .catch((err: Error) => {
        console.error(`Error playing ${sym} sound:`, err);
      });
  }, [audioContext, sendWpm]);
  
  // Test function to trigger a tone manually - for debugging key repeat issues
  const playTestTone = useCallback(() => {
    if (!audioContext) return;
    console.log('[SEND MODE] Playing test tone');
    audioContext.playTone(600, 100, 1.0).catch((err: Error) => {
      console.error('Error playing test tone:', err);
    });
  }, [audioContext]);
  
  // Handle invalid Morse code
  const handleInvalidCode = useCallback((code: string) => {
    console.log(`[SEND MODE] Invalid Morse code: '${code}'`);
    
    if (isDevelopment) {
      setDebugInfo(prev => `${prev}\nInvalid code: '${code}'`);
    }
    
    onError();
    
    // Play error sound if available
    if (audioContext) {
      audioContext.playErrorSound().catch((err: Error) => {
        console.error("Error playing error sound:", err);
      });
    }
    
    // Clear keyer output after a short delay
    setTimeout(() => {
      setKeyerOutput('');
    }, 600);
  }, [onError, audioContext]);
  
  // Log when onCharacterCorrect is called
  const debugOnCharacterCorrect = useCallback((index: number) => {
    console.log(`[SEND MODE] 🚀 Calling onCharacterCorrect(${index}) - isMounted: ${isMountedRef.current}`);
    onCharacterCorrect(index);
    // Log again after it's called to see if we got any updates 
    setTimeout(() => {
      console.log(`[SEND MODE] ⏩ After onCharacterCorrect: currentCharIndex=${currentCharIndex}`);
    }, 50);
  }, [onCharacterCorrect, currentCharIndex]);
  
  // Function to handle character detection without caring about mount state
  const handleCharacter = useCallback((char: string) => {
    // Make sure we're not processing the same character multiple times
    if (lastProcessedCharRef.current === char) {
      console.log(`[SEND MODE] 🔄 Skipping duplicate character: '${char}'`);
      return;
    }
    
    lastProcessedCharRef.current = char;
    
    console.log(`[SEND MODE] ⭐️ Character detected: '${char}' - isMounted: ${isMountedRef.current}`);
    
    if (isDevelopment) {
      setDebugInfo(prev => `${prev}\nDetected: '${char}'`);
    }
    
    const expectedChar = raceText[currentCharIndex]?.toLowerCase();
    
    console.log(`[SEND MODE] 🎯 Comparing: expected='${expectedChar}', received='${char.toLowerCase()}'`);
    console.log(`[SEND MODE] 📋 Race text: '${raceText.substring(Math.max(0, currentCharIndex-3), currentCharIndex+5)}'`);
    console.log(`[SEND MODE] 📊 Current index: ${currentCharIndex}, Progress: ${userProgress}%`);
    
    if (!expectedChar) {
      console.log("[SEND MODE] ❓ No expected character found!");
      return;
    }
    
    // Check if the character matches
    if (char.toLowerCase() === expectedChar.toLowerCase()) {
      console.log("[SEND MODE] ✅ CORRECT CHARACTER MATCH!");
      
      // Show correct indicator
      setShowCorrectIndicator(true);
      
      // Slight pause before continuing
      setTimeout(() => {
        setShowCorrectIndicator(false);
        setKeyerOutput('');
        lastProcessedCharRef.current = null; // Reset for next character
        
        // Increment progress
        console.log(`[SEND MODE] 📈 Incrementing progress at index ${currentCharIndex}`);
        debugOnCharacterCorrect(currentCharIndex);
        
        // Check if race is complete
        if (currentCharIndex + 1 >= raceText.length) {
          console.log("[SEND MODE] 🏁 RACE COMPLETE!");
          onComplete();
        }
      }, 400);
    } else {
      console.log(`[SEND MODE] ❌ INCORRECT CHARACTER! Expected '${expectedChar}', got '${char.toLowerCase()}'`);
      onError();
      
      // Clear keyer output and last processed character after a short delay
      setTimeout(() => {
        setKeyerOutput('');
        lastProcessedCharRef.current = null; // Reset for next attempt
      }, 600);
      
      // Play error sound if available
      if (audioContext) {
        audioContext.playErrorSound().catch((err: Error) => {
          console.error("Error playing error sound:", err);
        });
      }
    }
  }, [raceText, currentCharIndex, userProgress, onError, audioContext, onComplete, debugOnCharacterCorrect]);
  
  // Function to test a specific character for debugging
  const testCharacter = useCallback((char: string) => {
    console.log(`[SEND MODE] 🧪 TEST: Processing character '${char}' directly`);
    handleCharacter(char);
  }, [handleCharacter]);
  
  // Initialize the iambic keyer at the top level
  const keyer = useIambicKeyer({
    wpm: sendWpm,
    minWpm: 5,
    maxWpm: 50,
    onElement: (sym) => {
      console.log(`[SEND MODE] Received element: ${sym}`);
      
      // Update the keyer output display
      setKeyerOutput(prev => prev + sym);
      
      if (isDevelopment) {
        setDebugInfo(prev => `${prev}${sym}`);
      }
    },
    playElement: playElementSound,
    // Direct character validation in the onCharacter callback
    onCharacter: handleCharacter,
    onWord: () => {
      console.log("[SEND MODE] Word boundary detected");
      setKeyerOutput('');
      
      if (isDevelopment) {
        setDebugInfo(prev => `${prev}\nWord boundary`);
      }
    },
    onInvalidCharacter: handleInvalidCode,
    onWpmChange: (newWpm) => {
      console.log(`[SEND MODE] WPM changed to ${newWpm}`);
    }
  });
  
  // Log each time currentCharIndex changes
  useEffect(() => {
    console.log(`[SEND MODE] 🔄 currentCharIndex changed to ${currentCharIndex}`);
    if (currentCharIndex < raceText.length) {
      const nextChar = raceText[currentCharIndex];
      console.log(`[SEND MODE] 📝 Current character to send: '${nextChar}'`);
    }
    
    // Reset the lastProcessedCharRef when the index changes
    lastProcessedCharRef.current = null;
  }, [currentCharIndex, raceText]);
  
  // Prevent default keyboard behavior to avoid browser interaction
  useEffect(() => {
    // This ensures arrow keys don't scroll the page
    const preventArrowScroll = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
          e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
      
      // Update debug key state
      if (e.key === 'ArrowLeft') {
        setKeyState(prev => ({ ...prev, left: true }));
      } else if (e.key === 'ArrowRight') {
        setKeyState(prev => ({ ...prev, right: true }));
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setKeyState(prev => ({ ...prev, left: false }));
      } else if (e.key === 'ArrowRight') {
        setKeyState(prev => ({ ...prev, right: false }));
      }
    };
    
    // Add this low-level handler that runs before the keyer handler
    window.addEventListener('keydown', preventArrowScroll, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', preventArrowScroll, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, []);
  
  // Make sure all audio is stopped when unmounting
  useEffect(() => {
    // Log audio context state
    if (audioContext) {
      console.log(`[SEND MODE] Audio context state: ${audioContext.getRawContext ? audioContext.getRawContext().state : 'unknown'}`);
      
      // Try to resume the audio context if it's suspended
      if (audioContext.getRawContext && audioContext.getRawContext().state === 'suspended') {
        console.log('[SEND MODE] Attempting to resume audio context');
        audioContext.getRawContext().resume().then(() => {
          console.log('[SEND MODE] Audio context resumed successfully');
        }).catch((err: Error) => {
          console.error('[SEND MODE] Failed to resume audio context:', err);
        });
      }
    } else {
      console.log('[SEND MODE] No audio context available');
    }
  }, [audioContext]);
  
  // Install/uninstall the keyer once on mount/unmount
  useEffect(() => {
    // Only install if not already installed
    if (!isInstalledRef.current) {
      console.log("[SEND MODE] Installing iambic keyer (should happen only once)");
      keyer.install();
      isInstalledRef.current = true;
    }
    
    // Cleanup function - only uninstall on unmount
    return () => {
      console.log("[SEND MODE] Uninstalling iambic keyer (should happen only on unmount)");
      keyer.uninstall();
      isInstalledRef.current = false;
    };
  }, []); // Empty dependency array = only run on mount and unmount
  
  // Get the current character to display
  const currentChar = raceText[currentCharIndex]?.toUpperCase() || '';
  
  // Debug function to show keyer state
  const showKeyerState = () => {
    if (!keyer.debug) return;
    
    setDebugInfo(`Keyer State:
WPM: ${keyer.debug.wpm}
Buffer: ${keyer.debug.buffer}
Dot Held: ${keyer.debug.dotHeld}
Dash Held: ${keyer.debug.dashHeld}
Last Symbol: ${keyer.debug.lastSymbol || 'none'}
Active: ${keyer.debug.isActive}
Current Char: ${currentChar}
Current Index: ${currentCharIndex}
Last Processed: ${lastProcessedCharRef.current || 'none'}
Component Key State: Left=${keyState.left}, Right=${keyState.right}
isMounted: ${isMountedRef.current}`);
  };
  
  // Function to clear debug output
  const clearDebugInfo = () => {
    setDebugInfo('');
  };
  
  // Function to check mount state
  const checkMountState = () => {
    console.log(`[SEND MODE] 🔍 Mount state check: isMountedRef.current = ${isMountedRef.current}`);
    setDebugInfo(prev => `${prev}\nMount check: isMountedRef=${isMountedRef.current}`);
  };
  
  return (
    <div className={styles.raceContainer}>
      <div className={styles.morseText}>
        <div className={styles.textDisplay}>
          <h3>Send the characters you see using Morse code:</h3>
          <div className={styles.textContainer}>
            {/* Display progress bar */}
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
        
        {/* Current character display */}
        <div className={styles.currentCharContainer}>
          <div className={styles.currentCharPrompt}>Current character:</div>
          <div className={styles.currentChar}>
            {!showCorrectIndicator ? currentChar : ''}
          </div>
          <div className={styles.typingInstructions}>
            Use ← key for · (dot) and → key for – (dash) to send the character displayed
          </div>
        </div>
        
        {/* Morse code display */}
        <div className={styles.raceControls}>
          <div className={styles.morseControls}>
            <div className={styles.keyerDisplay}>
              <div className={styles.keyerOutput}>{keyerOutput}</div>
            </div>
            <div className={styles.hint}>
              Left arrow (←) = DOT, Right arrow (→) = DASH
            </div>
            
            {/* Debug controls - only in development */}
            {isDevelopment && (
              <div className={styles.debugControls}>
                <button onClick={showKeyerState}>Debug Keyer</button>
                <button onClick={clearDebugInfo}>Clear Debug</button>
                <button onClick={checkMountState}>Check Mount</button>
                <button 
                  onMouseDown={playTestTone}
                  style={{ backgroundColor: '#669' }}
                >
                  Test Tone (Hold)
                </button>
                <button 
                  onClick={() => debugOnCharacterCorrect(currentCharIndex)}
                  style={{ backgroundColor: '#396' }}
                >
                  Force Progress
                </button>
                <button
                  onClick={() => testCharacter('e')}
                  style={{ backgroundColor: '#f66' }}
                >
                  Force 'E'
                </button>
                <button
                  onClick={() => testCharacter('t')}
                  style={{ backgroundColor: '#f99' }}
                >
                  Force 'T'
                </button>
                <pre className={styles.debugInfo}>{debugInfo}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Participants list */}
      <RaceParticipants
        participants={participants}
        currentUserId={currentUserId}
        raceLength={raceLength}
        onlineUserIds={onlineUserIds}
        showPlacement={true}
      />
      
      {/* Correct indicator */}
      <div className={`${styles.correctIndicator} ${showCorrectIndicator ? styles.visible : ''}`}>✓</div>
    </div>
  );
};

export default SendModeRaceStage; 