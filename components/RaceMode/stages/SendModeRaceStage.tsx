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
  
  // Reference to track if we're still mounted
  const isMountedRef = useRef(true);
  
  // Function to play sound when a dot or dash is keyed
  const playElementSound = useCallback((sym: '.' | '-') => {
    if (!audioContext) return;
    
    const unitDuration = 1200 / sendWpm;
    const duration = sym === '.' ? unitDuration : unitDuration * 3;
    
    console.log(`[SEND MODE] Playing ${sym} with duration ${duration}ms`);
    
    audioContext.playTone(600, duration, 1.0).catch((err: Error) => {
      console.error(`Error playing ${sym} sound:`, err);
    });
  }, [audioContext, sendWpm]);
  
  // Handle when a character is recognized in send mode
  const handleCharacterDetected = useCallback((char: string) => {
    console.log(`[SEND MODE] Character detected: '${char}'`);
    
    if (isDevelopment) {
      setDebugInfo(prev => `${prev}\nDetected: '${char}'`);
    }
    
    if (!isMountedRef.current) return;
    
    const expectedChar = raceText[currentCharIndex]?.toLowerCase();
    if (!expectedChar) {
      console.log("[SEND MODE] No expected character found!");
      return;
    }
    
    console.log(`[SEND MODE] Expected: '${expectedChar}', Got: '${char}'`);
    
    // Check if the character matches
    if (char.toLowerCase() === expectedChar.toLowerCase()) {
      console.log("[SEND MODE] CORRECT CHARACTER!");
      
      // Show correct indicator
      setShowCorrectIndicator(true);
      
      // Slight pause before continuing
      setTimeout(() => {
        if (!isMountedRef.current) return;
        
        setShowCorrectIndicator(false);
        setKeyerOutput('');
        
        // Increment progress
        onCharacterCorrect(currentCharIndex);
        
        // Check if race is complete
        if (currentCharIndex + 1 >= raceText.length) {
          onComplete();
        }
      }, 400);
    } else {
      console.log("[SEND MODE] INCORRECT CHARACTER!");
      onError();
      
      // Clear keyer output after a short delay
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setKeyerOutput('');
      }, 600);
      
      // Play error sound if available
      if (audioContext) {
        audioContext.playErrorSound().catch((err: Error) => {
          console.error("Error playing error sound:", err);
        });
      }
    }
  }, [raceText, currentCharIndex, onCharacterCorrect, onError, onComplete, audioContext]);
  
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
      if (!isMountedRef.current) return;
      setKeyerOutput('');
    }, 600);
  }, [onError, audioContext]);
  
  // Initialize the iambic keyer
  const keyer = useIambicKeyer({
    wpm: sendWpm,
    minWpm: 5,
    maxWpm: 50,
    onElement: (sym) => {
      // Update the keyer output display
      setKeyerOutput(prev => prev + sym);
      
      if (isDevelopment) {
        setDebugInfo(prev => `${prev}${sym}`);
      }
    },
    playElement: playElementSound,
    onCharacter: handleCharacterDetected,
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
      // Note: We could have a callback to update global WPM state if needed
    }
  });
  
  // Install/uninstall the keyer
  useEffect(() => {
    console.log("[SEND MODE] Installing iambic keyer");
    keyer.install();
    
    return () => {
      console.log("[SEND MODE] Uninstalling iambic keyer");
      keyer.uninstall();
      isMountedRef.current = false;
    };
  }, [keyer]);
  
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
Expected Morse: ${currentChar ? getMorseForChar(currentChar) : 'none'}`);
  };
  
  // Helper to get Morse code for a character
  const getMorseForChar = (char: string) => {
    const morseMap: Record<string, string> = {
      'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 
      'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
      'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---',
      'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
      'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--',
      'Z': '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
      '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
      '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..'
    };
    return morseMap[char.toUpperCase()] || 'unknown';
  };
  
  // Function to clear debug output
  const clearDebugInfo = () => {
    setDebugInfo('');
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