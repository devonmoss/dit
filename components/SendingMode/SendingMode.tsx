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

/* eslint-disable @typescript-eslint/no-empty-object-type */
interface SendingModeProps {
  // Empty interface for future props
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

interface CharTiming {
  char: string;
  time: number;
}

const SendingMode: React.FC<SendingModeProps> = () => {
  const { state, startTest, endTest, updateCharPoints, saveResponseTimes, selectLevel, startTestWithLevelId } = useAppState();
  
  // Local UI state - align with TrainingMode approach
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
  
  // Timing state
  const [charStartTime, setCharStartTime] = useState<number | null>(null);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  
  // Audio refs - these need to be refs due to how Web Audio works
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  // Reference to track recently mastered character
  const recentlyMasteredCharRef = useRef<string | null>(null);
  
  // Client/development detection
  const isClientRef = useRef(false);
  const isDevelopmentRef = useRef(false);
  
  // Reference to store the keyer instance
  const keyerRef = useRef<ReturnType<typeof useIambicKeyer> | null>(null);
  
  // Refs to track current state for keyer callbacks
  const currentCharRef = useRef<string>('');
  const testActiveRef = useRef<boolean>(false);
  
  // Get current level info
  const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);
  const isCheckpoint = currentLevel?.type === 'checkpoint';
  const strikeLimit = isCheckpoint ? currentLevel?.strikeLimit : undefined;
  
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
        
        console.log('Audio context initialized successfully');
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
  
  // Ensure level characters are correctly loaded on mount - from TrainingMode
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
        console.log('Characters mismatch detected:');
        console.log('Current level:', state.selectedLevelId);
        console.log('Expected chars:', levelChars);
        console.log('Actual chars:', stateChars);
        
        // Re-select the level to fix characters
        selectLevel(state.selectedLevelId);
      }
    }
  }, [currentLevel, state.chars, state.selectedLevelId, selectLevel]);
  
  // Debug logging - from TrainingMode
  useEffect(() => {
    console.log('---------------------------------------');
    console.log(`[${new Date().toISOString()}] State Update`);
    console.log('Level ID:', state.selectedLevelId);
    console.log('Characters in state:', JSON.stringify(state.chars));
    console.log('testActive:', state.testActive);
    console.log('---------------------------------------');
  }, [state.selectedLevelId, state.chars, state.testActive]);
  
  // Keep refs in sync with state
  useEffect(() => {
    testActiveRef.current = state.testActive;
    console.log(`Syncing testActiveRef to: ${state.testActive}`);
  }, [state.testActive]);
  
  useEffect(() => {
    currentCharRef.current = currentChar;
    console.log(`Syncing currentCharRef to: "${currentChar}"`);
  }, [currentChar]);
  
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
  
  // Pick next character based on mastery weights - using TrainingMode approach
  const pickNextChar = useCallback(() => {
    console.log(`SendingMode: Selecting next character from ${state.chars.length} characters:`, state.chars);
    console.log(`SendingMode: Current points:`, state.charPoints);
    console.log(`SendingMode: Recently mastered char:`, recentlyMasteredCharRef.current);
    
    return selectNextCharacter(
      state.chars,
      state.charPoints,
      TARGET_POINTS,
      recentlyMasteredCharRef.current
    );
  }, [state.chars, state.charPoints]);
  
  // Show next character
  const showNextChar = useCallback(() => {
    if (!state.testActive) {
      console.log('Cannot show next character - test not active');
      return;
    }
    
    const nextChar = pickNextChar();
    console.log(`SendingMode: Showing next character: "${nextChar}"`);
    
    setCurrentChar(nextChar);
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking
    setCharStartTime(Date.now());
  }, [pickNextChar, state.testActive]);
  
  // Handle an element (dot/dash) from the keyer
  const handleElement = useCallback((symbol: '.' | '-') => {
    if (!state.testActive) {
      console.log(`Element ${symbol} detected but test not active - ignoring`);
      return;
    }
    
    setMorseOutput(prev => prev + symbol);
  }, [state.testActive]);
  
  // Finish test - aligned with TrainingMode
  const finishTest = useCallback((completed = true) => {
    // Calculate elapsed time
    const endTime = Date.now();
    const elapsedSec = testStartTime ? (endTime - testStartTime) / 1000 : 0;
    
    // Save response times
    if (responseTimes.length > 0) {
      console.log(`SendingMode: Saving ${responseTimes.length} response times`);
      saveResponseTimes(responseTimes);
    }
    
    // End app test
    endTest(completed);
    
    // Set test results
    console.log(`SendingMode: Test ${completed ? 'completed' : 'ended'}, elapsed time: ${elapsedSec}s`);
    setTestResults({
      completed,
      elapsedTime: elapsedSec
    });
  }, [testStartTime, responseTimes, saveResponseTimes, endTest]);
  
  // Handle a character from the keyer
  const handleCharacter = useCallback((char: string) => {
    // Use refs instead of state to avoid stale closures
    if (!testActiveRef.current || !currentCharRef.current) {
      console.log(`SendingMode: Character detected but test not active or no current character - ignoring`);
      console.log(`  testActiveRef: ${testActiveRef.current}, currentCharRef: "${currentCharRef.current}"`);
      return;
    }
    
    const currentChar = currentCharRef.current;
    
    console.log(`SendingMode: Keyer decoded: "${char}", target: "${currentChar}"`);
    console.log(`SendingMode: Comparing ${char.toLowerCase()} === ${currentChar.toLowerCase()}: ${char.toLowerCase() === currentChar.toLowerCase()}`);
    
    // Calculate response time
    const responseTime = charStartTime ? (Date.now() - charStartTime) : 0;
    
    // Check if character matches
    if (char.toLowerCase() === currentChar.toLowerCase()) {
      console.log(`SendingMode: CORRECT match - "${char}" matches "${currentChar}"`);
      
      // Clear the current character from the display
      const successChar = currentChar;
      setCurrentChar('');
      
      // Correct character!
      setFeedbackState('correct');
      
      // Calculate points based on response time
      const points = calculatePointsForTime(responseTime);
      console.log(`SendingMode: Awarding ${points.toFixed(2)} points for response time: ${responseTime}ms`);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: successChar, time: responseTime / 1000 }]);
      
      // Update character points - consistent with TrainingMode
      const currentPoints = state.charPoints[successChar] || 0;
      const newPoints = currentPoints + points;
      
      // Check if character will reach mastery with this addition
      const willCompleteMastery = newPoints >= TARGET_POINTS && currentPoints < TARGET_POINTS;
      
      // If this character will now be mastered, track it to avoid immediate reselection
      if (willCompleteMastery) {
        recentlyMasteredCharRef.current = successChar;
      }
      
      updateCharPoints(successChar, newPoints);
      
      console.log(`Character ${successChar} updated: ${currentPoints} → ${newPoints} points (${points} added, response time: ${(responseTime / 1000).toFixed(2)}s)`);
      
      // Delay before next question or finishing
      setTimeout(() => {
        // Create a simulated updated charPoints object that includes the most recent update
        const updatedCharPoints = { ...state.charPoints, [successChar]: newPoints };
        
        // Check if all characters are mastered using the updated points
        const allMastered = state.chars.every(c => (updatedCharPoints[c] || 0) >= TARGET_POINTS);
        
        console.log('Completion check:', { 
          updatedCharPoints,
          allMastered
        });
        
        if (allMastered) {
          finishTest(true);
        } else {
          setFeedbackState('none');
          showNextChar();
        }
      }, FEEDBACK_DELAY);
    } else {
      // Incorrect character
      console.log(`SendingMode: INCORRECT match - "${char}" does not match "${currentChar}"`);
      
      // Store the character that was incorrectly entered for display
      setIncorrectChar(char);
      
      // Show the incorrect character feedback
      setFeedbackState('incorrect');
      
      // Update mistakes map
      setMistakesMap(prev => {
        const count = prev[currentChar] || 0;
        console.log(`SendingMode: Increasing mistake count for "${currentChar}" from ${count} to ${count + 1}`);
        return { ...prev, [currentChar]: count + 1 };
      });
      
      // Reduce points with the penalty
      const currentPoints = state.charPoints[currentChar] || 0;
      const newPoints = Math.max(0, currentPoints * INCORRECT_PENALTY);
      updateCharPoints(currentChar, newPoints);
      
      // Properly enforce the checkpoint strike rule
      if (isCheckpoint && strikeLimit) {
        const newStrikeCount = strikeCount + 1;
        console.log(`SendingMode: Increasing strike count to ${newStrikeCount} (limit: ${strikeLimit})`);
        setStrikeCount(newStrikeCount);
        
        if (newStrikeCount >= strikeLimit) {
          console.log(`SendingMode: Strike limit reached (${newStrikeCount}/${strikeLimit}) - ending test`);
          finishTest(false);
          return;
        }
      }
      
      // Play error sound
      playErrorSound();
      
      // Clear feedback after delay but KEEP the same character
      console.log(`SendingMode: Incorrect match - keeping same character, clearing feedback in 2000ms`);
      setTimeout(() => {
        setFeedbackState('none');
        // Reset morse output so they can try again
        setMorseOutput('');
      }, FEEDBACK_DELAY);
    }
    
    // Clear morse output
    setMorseOutput('');
  }, [
    currentChar,
    state.testActive,
    state.charPoints,
    state.chars,
    charStartTime,
    calculatePointsForTime,
    updateCharPoints,
    isCheckpoint,
    strikeLimit,
    strikeCount,
    playErrorSound,
    showNextChar,
    finishTest
  ]);
  
  // Create a stable onWpmChange callback
  const onWpmChange = useCallback((newWpm: number) => {
    console.log('WPM changed to', newWpm);
  }, []);

  // Create the keyer with stabilized callbacks
  const keyer = useIambicKeyer({
    wpm: state.sendWpm,
    minWpm: 5,
    maxWpm: 40,
    onElement: handleElement,
    playElement: playElement,
    onCharacter: handleCharacter,
    onWpmChange
  });
  
  // Store keyer in ref immediately after creation
  useEffect(() => {
    keyerRef.current = keyer;
  }, [keyer]);
  
  // Start test - aligned with TrainingMode's handleStartTest
  const handleStartTest = useCallback(() => {
    console.log('SendingMode: Starting test - initializing state');
    
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
    if (keyerRef.current) {
      keyerRef.current.clear();
    }
    
    // Start the test in the AppState
    startTest();
    
    // Set test start time
    setTestStartTime(Date.now());
    
    // Show first character after a short delay
    setTimeout(() => {
      // Force a character to show even if state.testActive is not yet updated
      const nextChar = pickNextChar();
      console.log(`SendingMode: Forcing first character "${nextChar}" regardless of test state`);
      setCurrentChar(nextChar);
      setMorseOutput('');
      setFeedbackState('none');
      setCharStartTime(Date.now());
    }, 100);
  }, [startTest, pickNextChar]);
  
  // Clean restart with time recording
  const startTestAndRecordTime = useCallback(() => {
    setTestStartTime(Date.now());
    handleStartTest();
  }, [handleStartTest]);
  
  // Handle test starting with level ID
  const startTestWithExplicitLevel = useCallback((levelId: string) => {
    console.log(`SendingMode: Starting test with explicit level ID: ${levelId}`);
    
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
    if (keyerRef.current) {
      keyerRef.current.clear();
    }
    
    // Set test start time
    setTestStartTime(Date.now());
    
    // Start test with the level ID
    startTestWithLevelId(levelId);
    
    // Show first character after a short delay
    setTimeout(() => {
      // Force a character to show even if state.testActive is not yet updated
      const nextChar = pickNextChar();
      console.log(`SendingMode: Forcing first character "${nextChar}" regardless of test state`);
      setCurrentChar(nextChar);
      setMorseOutput('');
      setFeedbackState('none');
      setCharStartTime(Date.now());
    }, 100);
  }, [startTestWithLevelId, pickNextChar]);
  
  // Install keyer once on mount with stable references
  useEffect(() => {
    // Only install/uninstall on mount/unmount
    if (isBrowser) {
      console.log('Installing keyer (on mount only)');
      keyer.install();
    }
    
    return () => {
      console.log('Uninstalling keyer (on unmount only)');
      if (keyerRef.current) {
        keyerRef.current.uninstall();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this only runs on mount/unmount
  
  // Add escape key handler
  useEffect(() => {
    if (!isBrowser || !state.testActive) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
    console.log("🔄 onNext triggered in SendingMode");
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
    console.log('Moving from level index:', currentLevelIndex);
    
    if (currentLevelIndex >= 0 && currentLevelIndex < trainingLevels.length - 1) {
      // Move to next level
      const nextLevel = trainingLevels[currentLevelIndex + 1];
      console.log('Current level chars:', trainingLevels[currentLevelIndex].chars);
      console.log('Next level chars:', nextLevel.chars);
      console.log('New characters:', nextLevel.chars.filter(c => !trainingLevels[currentLevelIndex].chars.includes(c)));
      
      // Use the function that takes the level ID directly
      console.log("🔄 Starting test with explicit level ID:", nextLevel.id);
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
  
  return (
    <div className={styles.sendingTrainer}>
      {/* Debug state information - only visible in development */}
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
          maxWidth: '350px',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          <div>Level ID: {state.selectedLevelId}</div>
          <div>Level Name: {currentLevel?.name || 'Unknown'}</div>
          <div>Characters: {state.chars.join(', ')}</div>
          <div>Test Active: {state.testActive ? 'Yes' : 'No'}</div>
          <div>Current Char: {currentChar || '(none)'}</div>
          <div>
            <div>Mastery:</div>
            <ul style={{margin: '5px 0', paddingLeft: '20px'}}>
              {state.chars.map(c => (
                <li key={c}>
                  {c}: {state.charPoints[c] || 0}/{TARGET_POINTS}
                </li>
              ))}
            </ul>
          </div>
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