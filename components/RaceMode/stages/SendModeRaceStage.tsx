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
  onCharacterCorrect: (currentIndex?: number) => void;
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
  const [lastDetectedChar, setLastDetectedChar] = useState<string | null>(null);
  
  // Reference to track if keyer is installed
  const isInstalledRef = useRef(false);
  
  // Use a ref to track the latest currentCharIndex from props
  const currentCharIndexRef = useRef(currentCharIndex);
  
  // Update the ref whenever the prop changes
  useEffect(() => {
    const oldIndex = currentCharIndexRef.current;
    if (oldIndex !== currentCharIndex) {
      console.log(`SendModeRaceStage: currentCharIndex prop updated from ${oldIndex} to ${currentCharIndex}`);
      currentCharIndexRef.current = currentCharIndex;
    }
  }, [currentCharIndex]);
  
  // Function to play sound when a dot or dash is keyed
  const playElementSound = useCallback((sym: '.' | '-') => {
    if (!audioContext) return;
    
    const unitDuration = 1200 / sendWpm;
    const duration = sym === '.' ? unitDuration : unitDuration * 3;
    
    audioContext.playTone(600, duration, 1.0)
      .catch((err: Error) => {
        console.error(`Error playing ${sym} sound:`, err);
      });
  }, [audioContext, sendWpm]);
  
  // Handle invalid Morse code
  const handleInvalidCode = useCallback((code: string) => {
    console.log(`Invalid Morse code: ${code}`);
    onError();
    
    if (audioContext) {
      audioContext.playErrorSound().catch((err: Error) => {
        console.error("Error playing error sound:", err);
      });
    }
    
    // Clear keyer output
    setKeyerOutput('');
  }, [onError, audioContext]);
  
  // Handle character detection
  const handleCharacter = useCallback((char: string) => {
    console.log(`Character detected: ${char}, currentCharIndex: ${currentCharIndexRef.current}`);
    setLastDetectedChar(char);
    
    // Get the expected character from race text
    const expectedChar = raceText[currentCharIndexRef.current]?.toLowerCase() || '';
    
    // Compare detected and expected characters
    if (char.toLowerCase() === expectedChar.toLowerCase()) {
      console.log(`✓ Correct character: ${char}, expected: ${expectedChar}, at index: ${currentCharIndexRef.current}`);
      console.log(`BEFORE calling onCharacterCorrect - currentCharIndex is: ${currentCharIndexRef.current}`);
      
      // Store the current index for completion check
      const currentIndex = currentCharIndexRef.current;
      
      // Call progress callback with the current index
      onCharacterCorrect(currentIndex);
      
      console.log(`AFTER calling onCharacterCorrect - currentCharIndexRef is: ${currentCharIndexRef.current}`);
      
      // Show correct indicator
      setShowCorrectIndicator(true);
      
      // Check if race is complete - currentIndex + 1 is the next position
      if (currentIndex + 1 >= raceText.length) {
        console.log(`Race complete! Current index ${currentIndex} + 1 >= text length ${raceText.length}`);
        onComplete();
      }
      
      // Reset UI after a short delay
      setTimeout(() => {
        setShowCorrectIndicator(false);
        setKeyerOutput('');
      }, 200);
    } else {
      console.log(`✗ Incorrect character. Expected: ${expectedChar}, received: ${char}`);
      onError();
      
      // Clear keyer output
      setKeyerOutput('');
      
      if (audioContext) {
        audioContext.playErrorSound().catch((err: Error) => {
          console.error("Error playing error sound:", err);
        });
      }
    }
  }, [raceText, onCharacterCorrect, onError, onComplete, audioContext]);
  
  // Initialize the iambic keyer at the top level
  const keyer = useIambicKeyer({
    wpm: sendWpm,
    minWpm: 5,
    maxWpm: 50,
    onElement: (sym) => {
      // Update the keyer output display
      setKeyerOutput(prev => prev + sym);
    },
    playElement: playElementSound,
    onCharacter: handleCharacter,
    onWord: () => {
      setKeyerOutput('');
    },
    onInvalidCharacter: handleInvalidCode,
    onWpmChange: () => {}
  });
  
  // Prevent default keyboard behavior to avoid browser interaction
  useEffect(() => {
    const preventArrowScroll = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
          e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', preventArrowScroll, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', preventArrowScroll, { capture: true });
    };
  }, []);
  
  // Ensure audio context is resumed
  useEffect(() => {
    if (audioContext && audioContext.getRawContext && audioContext.getRawContext().state === 'suspended') {
      audioContext.getRawContext().resume()
        .then(() => console.log('Audio context resumed'))
        .catch((err: Error) => console.error('Failed to resume audio context:', err));
    }
  }, [audioContext]);
  
  // Install/uninstall the keyer once on mount/unmount
  useEffect(() => {
    // Only install if not already installed
    if (!isInstalledRef.current) {
      keyer.install();
      isInstalledRef.current = true;
    }
    
    // Cleanup function - only uninstall on unmount
    return () => {
      keyer.uninstall();
      isInstalledRef.current = false;
    };
  }, []); // Empty dependency array = only run on mount and unmount
  
  // Get the current character to display
  const currentChar = raceText[currentCharIndexRef.current]?.toUpperCase() || '';
  
  // Generate the sequence display with highlighting
  const generateSequenceDisplay = () => {
    // Show previous 2, current, and next 10 characters
    const start = Math.max(0, currentCharIndexRef.current - 2);
    const end = Math.min(raceText.length, currentCharIndexRef.current + 10);
    const sequence = raceText.substring(start, end).split('');
    
    return (
      <div className={styles.sequenceDisplay}>
        {sequence.map((char, index) => {
          const actualIndex = start + index;
          const isCurrent = actualIndex === currentCharIndexRef.current;
          return (
            <span 
              key={index} 
              className={`${isCurrent ? styles.currentSequenceChar : ''}`}
              style={{ 
                fontWeight: isCurrent ? 'bold' : 'normal',
                color: isCurrent ? 'green' : (actualIndex < currentCharIndexRef.current ? '#888' : '#000'),
                backgroundColor: isCurrent ? '#efffef' : 'transparent',
                padding: '0 2px',
                border: isCurrent ? '1px solid green' : 'none',
                marginRight: '2px'
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
    );
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
            Use ← key for · (dit) and → key for – (dah) to send the character displayed
          </div>
        </div>
        
        {/* Morse code display */}
        <div className={styles.raceControls}>
          <div className={styles.morseControls}>
            <div className={styles.keyerDisplay}>
              <div className={styles.keyerOutput}>{keyerOutput}</div>
            </div>
            <div className={styles.hint}>
              Left arrow (←) = dit, Right arrow (→) = dah
            </div>
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