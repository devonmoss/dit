import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SendingMode.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { isBrowser } from '../../utils/morse';
import MasteryDisplay from '../MasteryDisplay/MasteryDisplay';
import TestResultsSummary from '../TestResultsSummary/TestResultsSummary';
import { trainingLevels } from '../../utils/levels';
import { useIambicKeyer } from '../../hooks/useIambicKeyer';
import { selectNextCharacter } from '../../utils/characterSelection';

// Constants
const TARGET_POINTS = 3;
const FEEDBACK_DELAY = 750; // ms
const COMPLETED_WEIGHT = 0.2; // Weight for already mastered characters
const MIN_RESPONSE_TIME = 0.8; // seconds
const MAX_RESPONSE_TIME = 7; // seconds
const INCORRECT_PENALTY = 0.7; // 30% reduction

interface CharTiming {
  char: string;
  time: number;
}

const SendingMode: React.FC = () => {
  const { state, startTest, endTest, updateCharPoints, saveResponseTimes, selectLevel, startTestWithLevelId } = useAppState();
  
  // Local UI state
  const [currentChar, setCurrentChar] = useState('');
  const [morseOutput, setMorseOutput] = useState('');
  const [feedbackState, setFeedbackState] = useState<'none' | 'correct' | 'incorrect'>('none');
  const [incorrectChar, setIncorrectChar] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);
  const [responseTimes, setResponseTimes] = useState<CharTiming[]>([]);
  const [mistakesMap, setMistakesMap] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<{
    completed: boolean;
    elapsedTime: number;
  } | null>(null);
  
  // Test timing state
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  
  // Question timing state
  const [charStartTime, setCharStartTime] = useState<number | null>(null);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  // Feedback timer ref to prevent multiple feedback states from occurring
  const feedbackTimerRef = useRef<number | null>(null);
  
  // Reference to track recently mastered character (same approach as TrainingMode)
  const recentlyMasteredCharRef = useRef<string | null>(null);
  
  // Environment detection for debug panel
  const isClientRef = useRef(false);
  const isDevelopmentRef = useRef(false);
  
  // Get current level (directly using the find result, like TrainingMode)
  const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);
  const isCheckpoint = currentLevel?.type === 'checkpoint';
  const strikeLimit = isCheckpoint ? currentLevel?.strikeLimit : undefined;
  
  // Ensure level characters are correctly loaded on mount (following TrainingMode approach)
  useEffect(() => {
    if (currentLevel && state.chars.length > 0) {
      // Check if current state.chars matches the expected level's chars
      const levelChars = currentLevel.chars;
      const stateChars = state.chars;
      
      // Compare arrays to see if they have the same characters
      const sameLength = levelChars.length === stateChars.length;
      const allCharsPresent = levelChars.every(c => stateChars.includes(c));
      const noExtraChars = stateChars.every(c => levelChars.includes(c));
      
      if (!(sameLength && allCharsPresent && noExtraChars)) {
        console.log('Characters mismatch detected on mount:');
        console.log('Current level:', state.selectedLevelId);
        console.log('Expected chars:', levelChars);
        console.log('Actual chars:', stateChars);
        
        // Re-select the level to fix characters
        selectLevel(state.selectedLevelId);
      }
    }
  }, [currentLevel, state.chars, state.selectedLevelId, selectLevel]);
  
  // Debug logging
  useEffect(() => {
    console.log('---------------------------------------');
    console.log(`[${new Date().toISOString()}] State Update`);
    console.log('Level ID:', state.selectedLevelId);
    console.log('Characters in state:', JSON.stringify(state.chars));
    console.log('testActive:', state.testActive);
    console.log('---------------------------------------');
  }, [state.selectedLevelId, state.chars, state.testActive]);
  
  // Initialize audio on first render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        
        const gain = ctx.createGain();
        gain.gain.value = 0.5;
        gain.connect(ctx.destination);
        gainNodeRef.current = gain;
      } catch (e) {
        console.error('Failed to initialize audio context:', e);
      }
    }
    
    return () => {
      stopSound();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error('Error closing audio context:', e));
      }
    };
  }, []);
  
  // Pick next character based on mastery weights - same as TrainingMode
  const pickNextChar = useCallback(() => {
    // Use the shared utility function from TrainingMode
    return selectNextCharacter(
      state.chars,
      state.charPoints,
      TARGET_POINTS,
      recentlyMasteredCharRef.current
    );
  }, [state.chars, state.charPoints]);
  
  // Stop any current sound
  const stopSound = useCallback(() => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      } catch (e) {
        // Ignore errors on stop
      }
    }
  }, []);
  
  // Play error sound
  const playErrorSound = useCallback(() => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    stopSound();
    
    try {
      const osc = audioContextRef.current.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 300;
      
      // Reduce volume for error sound
      gainNodeRef.current.gain.value = 0.3;
      
      osc.connect(gainNodeRef.current);
      osc.start();
      oscillatorRef.current = osc;
      
      // Ensure the error sound stops after a short time
      setTimeout(() => {
        stopSound();
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = 0.5; // Reset gain to normal
        }
      }, 150);
    } catch (e) {
      console.error('Error playing error sound:', e);
    }
  }, [stopSound]);
  
  // Play element (dot/dash)
  const playElement = useCallback((symbol: '.' | '-') => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    stopSound();
    
    try {
      // Calculate timing based on current WPM
      const unitMs = 1200 / state.sendWpm;
      const duration = symbol === '.' ? unitMs : unitMs * 3;
      
      const osc = audioContextRef.current.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 600;
      osc.connect(gainNodeRef.current);
      
      oscillatorRef.current = osc;
      osc.start();
      
      setTimeout(() => {
        if (oscillatorRef.current === osc) {
          stopSound();
        }
      }, duration);
    } catch (e) {
      console.error('Error playing element:', e);
    }
  }, [state.sendWpm, stopSound]);
  
  // Calculate response time points
  const calculatePointsForTime = useCallback((responseTime: number) => {
    const seconds = responseTime / 1000;
    if (seconds <= MIN_RESPONSE_TIME) return 1;
    if (seconds >= MAX_RESPONSE_TIME) return 0;
    
    // Linear scale between min and max response times
    return 1 - ((seconds - MIN_RESPONSE_TIME) / (MAX_RESPONSE_TIME - MIN_RESPONSE_TIME));
  }, []);
  
  // Finish the test
  const finishTest = useCallback((completed = true) => {
    // Calculate elapsed time
    const endTime = Date.now();
    const elapsedSec = testStartTime ? (endTime - testStartTime) / 1000 : 0;
    
    // Save response times
    if (responseTimes.length > 0) {
      saveResponseTimes(responseTimes);
    }
    
    // End test
    endTest(completed);
    
    // Set test results
    setTestResults({
      completed,
      elapsedTime: elapsedSec
    });
  }, [testStartTime, responseTimes, saveResponseTimes, endTest]);
  
  // Present next question
  const nextQuestion = useCallback(() => {
    const nextChar = pickNextChar();
    console.log(`[SendingMode] Next character selected: '${nextChar}'`);
    
    if (!nextChar) {
      console.error('[SendingMode] No character selected - this is a critical error');
      // Try to recover by forcing a character from the level
      if (currentLevel && currentLevel.chars.length > 0) {
        const fallbackChar = currentLevel.chars[0];
        console.log(`[SendingMode] Using fallback character: ${fallbackChar}`);
        setCurrentChar(fallbackChar);
      } else {
        console.error('[SendingMode] Cannot recover - no characters available');
      }
    } else {
      setCurrentChar(nextChar);
    }
    
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking
    const now = Date.now();
    setCharStartTime(now);
    
    // Return a promise that resolves immediately
    return Promise.resolve();
  }, [pickNextChar, currentLevel]);
  
  // Handle character input from the keyer
  const handleCharacter = useCallback((char: string) => {
    // Use the ref value instead of state to avoid stale closure issues
    const targetChar = currentCharRef.current;
    
    // Skip if no current char to match against
    if (!targetChar) {
      console.log('[SendingMode] No character to match against');
      return;
    }
    
    // Calculate response time
    const responseTime = charStartTime ? (Date.now() - charStartTime) : 0;
    
    // Check if character matches
    if (char.toLowerCase() === targetChar.toLowerCase()) {
      // Correct character entered
      // Store the successful character
      const successChar = targetChar;
      
      // Clear the current character and set feedback
      setCurrentChar('');
      setFeedbackState('correct');
      
      // Calculate points based on response time
      const points = calculatePointsForTime(responseTime);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: successChar, time: responseTime / 1000 }]);
      
      // Get current points
      const currentPoints = state.charPoints[successChar] || 0;
      const newPoints = currentPoints + points;
      
      // Check if character will reach mastery with this addition
      const willCompleteMastery = newPoints >= TARGET_POINTS && currentPoints < TARGET_POINTS;
      
      // If this character will now be mastered, track it to avoid immediate reselection
      if (willCompleteMastery) {
        recentlyMasteredCharRef.current = successChar;
      }
      
      // Update character points
      updateCharPoints(successChar, newPoints);
      
      // Clear any existing feedback timer
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
      
      // Delay before next question or finishing
      feedbackTimerRef.current = window.setTimeout(() => {
        // Create a simulated updated charPoints object that includes the most recent update
        const updatedCharPoints = { ...state.charPoints, [successChar]: newPoints };
        
        // Check if all characters are mastered using the updated points
        const allMastered = state.chars.every(c => (updatedCharPoints[c] || 0) >= TARGET_POINTS);
        
        // Check for old characters mastered
        const oldChars = ['e', 't']; // Level 1 characters
        const newChars = state.chars.filter(c => !oldChars.includes(c));
        
        const oldCharsMastered = oldChars.every(c => {
          if (!state.chars.includes(c)) return true; // Skip if not in this level
          const points = updatedCharPoints[c] || 0;
          return points >= TARGET_POINTS;
        });
        
        const newCharsAttempted = newChars.some(c => {
          return (updatedCharPoints[c] || 0) > 0;
        });
        
        if (allMastered) {
          finishTest(true);
        } else if (oldCharsMastered && !newCharsAttempted && newChars.length > 0) {
          // Force selection of a new character
          const forceChar = newChars[0];
          
          // Set current character directly
          setCurrentChar(forceChar);
          setMorseOutput('');
          setFeedbackState('none');
          
          // Set the start time for response time tracking
          const now = Date.now();
          setCharStartTime(now);
        } else {
          nextQuestion();
        }
      }, FEEDBACK_DELAY);
    } else {
      // Incorrect character
      // Store the character that was incorrectly entered for display
      setIncorrectChar(char);
      
      // Show the incorrect character feedback
      setFeedbackState('incorrect');
      
      // Update mistakes map
      setMistakesMap(prev => {
        const count = prev[targetChar] || 0;
        return { ...prev, [targetChar]: count + 1 };
      });
      
      // Reduce points with the penalty
      const currentPoints = state.charPoints[targetChar] || 0;
      const newPoints = Math.max(0, currentPoints * INCORRECT_PENALTY);
      
      // Update the app state
      updateCharPoints(targetChar, newPoints);
      
      // Properly enforce the checkpoint strike rule
      if (isCheckpoint && strikeLimit) {
        const newStrikeCount = strikeCount + 1;
        setStrikeCount(newStrikeCount);
        
        if (newStrikeCount >= strikeLimit) {
          finishTest(false);
          return;
        }
      }
      
      // Play error sound
      playErrorSound();
      
      // Clear any existing feedback timer
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
      
      // Clear feedback after delay but KEEP the same character
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedbackState('none');
        // Reset morse output so they can try again
        setMorseOutput('');
      }, FEEDBACK_DELAY);
    }
    
    // Clear morse output after processing input
    setMorseOutput('');
  }, [
    calculatePointsForTime,
    updateCharPoints,
    state.charPoints, 
    state.chars,
    isCheckpoint,
    strikeLimit,
    strikeCount,
    playErrorSound,
    nextQuestion,
    finishTest,
    charStartTime
  ]);
  
  // Handle an element (dot/dash) from the keyer
  const handleElement = useCallback((symbol: '.' | '-') => {
    // Always append to morse output regardless of state
    setMorseOutput(prev => prev + symbol);
  }, []);
  
  // Create the keyer with stabilized callbacks
  const onWpmChange = useCallback((newWpm: number) => {
    console.log(`WPM changed to ${newWpm}`);
  }, []);
  
  // Create the keyer
  const keyer = useIambicKeyer({
    wpm: state.sendWpm,
    minWpm: 5,
    maxWpm: 40,
    onElement: handleElement,
    playElement: playElement,
    onCharacter: handleCharacter,
    onWpmChange,
    onInvalidCharacter: (code) => {
      console.log(`Invalid morse code detected: ${code}`);
    }
  });
  
  // Store keyer in ref for stable access
  const keyerRef = useRef(keyer);
  
  // Store current character in a ref to avoid stale closures
  const currentCharRef = useRef<string>(currentChar);
  
  // Update refs when dependencies change
  useEffect(() => {
    keyerRef.current = keyer;
    currentCharRef.current = currentChar;
  }, [keyer, currentChar]);
  
  // Start test
  const handleStartTest = useCallback(() => {
    // Reset all state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    setResponseTimes([]);
    setMistakesMap({});
    setTestResults(null);
    
    // Reset recently mastered character
    recentlyMasteredCharRef.current = null;
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // Start the test in the AppState
    startTest();
    
    // Need a slight delay to ensure state is updated
    setTimeout(() => {
      nextQuestion();
    }, 100);
  }, [startTest, nextQuestion]);
  
  // Clean restart with time recording
  const startTestAndRecordTime = useCallback(() => {
    setTestStartTime(Date.now());
    handleStartTest();
  }, [handleStartTest]);
  
  // Handle moving to specific level
  const startTestWithExplicitLevel = useCallback((levelId: string) => {
    // Reset all state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    setResponseTimes([]);
    setMistakesMap({});
    setTestResults(null);
    
    // Reset recently mastered character
    recentlyMasteredCharRef.current = null;
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // Set test start time
    setTestStartTime(Date.now());
    
    // Start test with level ID
    startTestWithLevelId(levelId);
    
    // Start the first question after a short delay
    setTimeout(() => {
      nextQuestion();
    }, 150);
  }, [startTestWithLevelId, nextQuestion]);
  
  // Install keyer once on mount
  useEffect(() => {
    if (isBrowser) {
      keyer.install();
    }
    
    return () => {
      // Clean up keyer
      keyerRef.current.uninstall();
      
      // Clean up any pending feedback timers
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this only runs on mount/unmount
  
  // Add escape key handler
  useEffect(() => {
    if (!isBrowser) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.testActive) {
        e.preventDefault();
        finishTest(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.testActive, finishTest]);
  
  // Handle repeat level
  const handleRepeatLevel = useCallback(() => {
    setTestResults(null);
    startTestAndRecordTime();
  }, [startTestAndRecordTime]);
  
  // Handle next level - aligned with TrainingMode
  const handleNextLevel = useCallback(() => {
    setTestResults(null);
    
    // Reset state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    setResponseTimes([]);
    setMistakesMap({});
    
    // Get current level index
    const currentLevelIndex = trainingLevels.findIndex(l => l.id === state.selectedLevelId);
    
    if (currentLevelIndex >= 0 && currentLevelIndex < trainingLevels.length - 1) {
      // Move to next level
      const nextLevel = trainingLevels[currentLevelIndex + 1];
      
      // Set the test start time
      setTestStartTime(Date.now());
      
      // Start test with the next level ID
      startTestWithExplicitLevel(nextLevel.id);
    } else {
      // Restart current level if at end
      startTestAndRecordTime();
    }
  }, [state.selectedLevelId, startTestWithExplicitLevel, startTestAndRecordTime]);
  
  // Calculate progress - mastered characters
  const masteredCount = state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length;
  const progress = state.chars.length > 0 ? `Mastered: ${masteredCount}/${state.chars.length}` : '';
  
  // Using useRef for client detection to avoid hydration mismatches
  useEffect(() => {
    isClientRef.current = true;
    
    // Check if we're in a development environment
    if (isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      isDevelopmentRef.current = true;
    }
  }, []);
  
  // Debug info for development only
  const debugInfo = {
    level: state.selectedLevelId,
    currentChar,
    currentCharRef: currentCharRef.current,
    morseOutput
  };
  
  return (
    <div className={styles.sendingTrainer}>
      {/* Debug panel - only visible in development */}
      {isClientRef.current && isDevelopmentRef.current && (
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.8)', 
          color: 'white',
          padding: '10px',
          fontSize: '12px',
          zIndex: 9999,
          maxWidth: '300px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <div>Level: {debugInfo.level}</div>
          <div>Current char (state): <strong>{debugInfo.currentChar || 'none'}</strong></div>
          <div>Current char (ref): <strong>{debugInfo.currentCharRef || 'none'}</strong></div>
          <div>Morse output: <strong>{debugInfo.morseOutput}</strong></div>
        </div>
      )}
      
      {testResults ? (
        <TestResultsSummary
          completed={testResults.completed}
          elapsedTime={testResults.elapsedTime}
          replayCount={0} // Not applicable for sending mode
          mistakesMap={mistakesMap}
          responseTimes={responseTimes}
          levelId={state.selectedLevelId}
          onRepeat={handleRepeatLevel}
          onNext={handleNextLevel}
        />
      ) : state.testActive ? (
        <>
          <div className={styles.sendCurrentMeta}>
            <div className={styles.sendCurrentLevel}>{progress}</div>
          </div>
          
          <MasteryDisplay targetPoints={TARGET_POINTS} />
          
          {isCheckpoint && strikeLimit && (
            <div className={styles.strikes}>
              {Array.from({ length: strikeLimit }).map((_, i) => (
                <span 
                  key={i} 
                  className={`${styles.strike} ${i < strikeCount ? styles.used : ''}`}
                >
                  ✕
                </span>
              ))}
            </div>
          )}
          
          <div className={styles.currentCharDisplay}>
            {currentChar && (
              <div className={styles.bigCharacter}>{currentChar.toUpperCase()}</div>
            )}
          </div>
          
          <div className={styles.feedbackContainer}>
            {feedbackState === 'correct' && (
              <div className={styles.correctFeedback}>Correct!</div>
            )}
            {feedbackState === 'incorrect' && (
              <div className={styles.incorrectFeedback}>{incorrectChar}</div>
            )}
          </div>
          
          <div className={styles.sendingInstructions}>
            Use ← key for <span className={styles.dot}>·</span> and → key for <span className={styles.dash}>–</span>
          </div>
          
          <div className={styles.keyerDisplay}>
            <div className={styles.keyerOutput}>{morseOutput}</div>
          </div>
          
          <div className={styles.actionHints}>
            Esc: End Test
          </div>
        </>
      ) : (
        <div className={styles.startContainer}>
          <div className={styles.modeDescription}>
            Use left and right arrow keys to mimic an iambic paddle and send morse code characters.
          </div>
          <button 
            className="shared-start-button"
            onClick={startTestAndRecordTime}
          >
            Start {currentLevel ? currentLevel.name.split(':')[0] : 'Test'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SendingMode;