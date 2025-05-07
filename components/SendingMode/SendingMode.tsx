import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  
  // Use both state and ref for strike count to ensure consistency
  const [strikeCount, setStrikeCount] = useState(0);
  const strikeCountRef = useRef(0);
  const [responseTimes, setResponseTimes] = useState<CharTiming[]>([]);
  const [mistakesMap, setMistakesMap] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<{
    completed: boolean;
    elapsedTime: number;
  } | null>(null);
  
  // Local character points state - directly tied to the current level's characters
  const [localCharPoints, setLocalCharPoints] = useState<Record<string, number>>({});
  
  // Reference to current level's characters for consistent access
  const levelCharsRef = useRef<string[]>([]);
  
  // Reference to track character points that's immediately available to callbacks
  const charPointsRef = useRef<Record<string, number>>({});
  
  // Test timing state - use both ref and state
  const testStartTimeRef = useRef<number | null>(null);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  
  // Question timing state - use both ref and state
  const charStartTimeRef = useRef<number | null>(null);
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
  
  // Use refs for checkpoint info to ensure consistency
  const isCheckpointRef = useRef<boolean>(false);
  const strikeLimitRef = useRef<number | undefined>(undefined);
  
  // Set isCheckpointRef and strikeLimitRef when level changes
  useEffect(() => {
    if (currentLevel) {
      isCheckpointRef.current = currentLevel.type === 'checkpoint';
      strikeLimitRef.current = isCheckpointRef.current ? currentLevel.strikeLimit : undefined;
    }
  }, [currentLevel]);
  
  // Also keep the non-ref versions for React rendering
  const isCheckpoint = currentLevel?.type === 'checkpoint';
  const strikeLimit = isCheckpoint ? currentLevel?.strikeLimit : undefined;
  
  // Log information about the current level for debugging
  // useEffect(() => {
  //   if (currentLevel) {
  //     console.log('[DEBUG] Current level loaded:', currentLevel.id);
  //     console.log('[DEBUG] Level type:', currentLevel.type);
  //     console.log('[DEBUG] Is checkpoint:', isCheckpoint);
  //     console.log('[DEBUG] Strike limit:', strikeLimit);
  //   }
  // }, [currentLevel, isCheckpoint, strikeLimit]);
  
  // Debug logging to monitor character points in refs and state
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development') {
  //     console.log('[DEBUG] Character Points Changed:');
  //     console.log('[DEBUG] - In State:', localCharPoints);
  //     console.log('[DEBUG] - In Ref:', charPointsRef.current);
  //   }
  // }, [localCharPoints]);
  
  // Debug logging for troubleshooting
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development') {
  //     console.log('---------------------------------------');
  //     console.log(`[${new Date().toISOString()}] State Update`);
  //     console.log('Level ID:', state.selectedLevelId);
  //     console.log('Current Level:', currentLevel);
  //     console.log('Level Characters:', currentLevel?.chars);
  //     console.log('Local Character Points:', localCharPoints);
  //     console.log('testActive:', state.testActive);
  //     console.log('---------------------------------------');
  //   }
  // }, [state.selectedLevelId, currentLevel, localCharPoints, state.testActive]);
  
  // Initialize local character points from app state when level changes
  useEffect(() => {
    if (currentLevel) {
      // Store the current level's chars in a ref for immediate access across render cycles
      levelCharsRef.current = [...currentLevel.chars];
      
      // Create a new object with ONLY the character points for the current level
      const levelCharPoints: Record<string, number> = {};
      currentLevel.chars.forEach(char => {
        // Initialize with app state values or 0
        levelCharPoints[char] = state.charPoints[char] || 0;
      });
      
      // Update both the state and ref
      setLocalCharPoints(levelCharPoints);
      charPointsRef.current = { ...levelCharPoints };
    }
  }, [currentLevel, state.charPoints, state.selectedLevelId]);
  
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
  
  // Pick next character based on mastery weights - using consistent values
  const pickNextChar = useCallback(() => {
    if (levelCharsRef.current.length === 0) {
      console.error('[SendingMode] No characters in level chars ref');
      return '';
    }
    
    // For character selection, use a merged version with the highest values from both sources
    const mergedPoints: Record<string, number> = {};
    levelCharsRef.current.forEach(char => {
      const stateValue = localCharPoints[char] || 0;
      const refValue = charPointsRef.current[char] || 0;
      mergedPoints[char] = Math.max(stateValue, refValue);
    });
    
    // Use the merged points for character selection
    return selectNextCharacter(
      levelCharsRef.current,
      mergedPoints,
      TARGET_POINTS,
      recentlyMasteredCharRef.current
    );
  }, [localCharPoints]);
  
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
    if (symbol !== '.' && symbol !== '-') return;
    
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
    
    if (seconds <= MIN_RESPONSE_TIME) {
      return 1;
    }
    if (seconds >= MAX_RESPONSE_TIME) {
      return 0;
    }
    
    // Linear scale between min and max response times
    const points = 1 - ((seconds - MIN_RESPONSE_TIME) / (MAX_RESPONSE_TIME - MIN_RESPONSE_TIME));
    return points;
  }, []);
  
  // Function to update local character points with debug logging
  const updateLocalPoints = useCallback((char: string, points: number) => {
    
    // Create a copy of current points to prevent mutation issues
    const updatedCharPoints = { ...charPointsRef.current };
    updatedCharPoints[char] = points;
    
    // First update the ref immediately for consistent access in callbacks
    charPointsRef.current = updatedCharPoints;
    
    // Update state too (which will trigger a render)
    setLocalCharPoints(prev => {
      // Important: make a new object to ensure React detects the change
      const newPoints = { ...prev };
      newPoints[char] = points;
      return newPoints;
    });
    
    // Also update the app state to keep them in sync
    updateCharPoints(char, points);
    
    // If we just reached mastery, update the recently mastered ref
    const wasJustMastered = points >= TARGET_POINTS && 
      (charPointsRef.current[char] || 0) < TARGET_POINTS;
    
    if (wasJustMastered) {
      recentlyMasteredCharRef.current = char;
    }
  }, [updateCharPoints]);
  
  // Finish the test
  const finishTest = useCallback((completed = true) => {
    // Calculate elapsed time
    const endTime = Date.now();
    
    // Prefer the ref for timing as it's more reliable, with various fallbacks
    let elapsedSec = 0;
    if (testStartTimeRef.current) {
      // Primary source: Use ref (most reliable)
      elapsedSec = (endTime - testStartTimeRef.current) / 1000;
    } else if (testStartTime) {
      // Secondary source: Use state
      elapsedSec = (endTime - testStartTime) / 1000;
    } else {
      // Fallback: use the average time spent on all characters as estimate
      if (responseTimes.length > 0) {
        const totalResponseTime = responseTimes.reduce((sum, item) => sum + item.time, 0);
        elapsedSec = totalResponseTime;
      } else {
        // Absolute minimum fallback - shouldn't happen with our fixes
        elapsedSec = 60; // Default to 1 minute if we have nothing else
        console.error(`[SendingMode] No timing data available. Using default: ${elapsedSec}s`);
      }
    }
    
    // Save response times
    if (responseTimes.length > 0) {
      saveResponseTimes(responseTimes);
    }
    
    // Uninstall keyer to disable key listening
    keyerRef.current.uninstall();
    
    // End test
    endTest(completed);
    
    // Set test results
    setTestResults({
      completed,
      elapsedTime: elapsedSec
    });
  }, [testStartTime, responseTimes, saveResponseTimes, endTest]);
  
  // Present next question - now using direct level chars
  const nextQuestion = useCallback(() => {
    const nextChar = pickNextChar();
    
    if (!nextChar) {
      console.error('[SendingMode] No character selected - this is a critical error');
      // Try to recover by forcing a character from the level
      if (currentLevel && currentLevel.chars.length > 0) {
        const fallbackChar = currentLevel.chars[0];
        console.warn(`[SendingMode] Using fallback character: ${fallbackChar}`);
        setCurrentChar(fallbackChar);
      } else {
        console.error('[SendingMode] Cannot recover - no characters available');
      }
    } else {
      setCurrentChar(nextChar);
    }
    
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking - both ref and state
    const now = Date.now();
    charStartTimeRef.current = now; // Set ref for immediate access in callbacks
    setCharStartTime(now); // Set state for rendering
    
    // Return a promise that resolves immediately
    return Promise.resolve();
  }, [pickNextChar, currentLevel]);
  
  // Store current character in a ref for stable access
  const currentCharRef = useRef<string>(currentChar);
  
  // Update ref when currentChar changes
  useEffect(() => {
    currentCharRef.current = currentChar;
  }, [currentChar]);
  
  // Handle character input from the keyer
  const handleCharacter = useCallback((char: string) => {
    if (!char) {
      console.log('[SendingMode] Received empty character, ignoring');
      return;
    }
    
    // Use the ref value instead of state to avoid stale closure issues
    const targetChar = currentCharRef.current;
    
    // Skip if no current char to match against
    if (!targetChar) {
      console.log('[SendingMode] No character to match against');
      return;
    } 
    // console.log('[SendingMode] Character to match against:', targetChar);

    // Calculate response time using the ref for consistency
    const now = Date.now();
    // Default to current time if no start time is recorded
    const startTime = charStartTimeRef.current ? charStartTimeRef.current : now;
    const responseTime = now - startTime;
    
    // Check if character matches
    if (char.toLowerCase() === targetChar.toLowerCase()) {
      
      const successChar = targetChar;
      
      // Clear the current character and set feedback
      setCurrentChar('');
      setFeedbackState('correct');
      
      const points = calculatePointsForTime(responseTime);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: successChar, time: responseTime / 1000 }]);
      
      // Get current points from ref for immediate access
      const currentPoints = charPointsRef.current[successChar] || 0;
      const newPoints = currentPoints + points;
      
      updateLocalPoints(successChar, newPoints);
      
      // Clear any existing feedback timer
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
      
      // Delay before next question or finishing
      feedbackTimerRef.current = window.setTimeout(() => {
        // Use merged points from both sources for most accuracy
        const mergedPoints: Record<string, number> = {};
        levelCharsRef.current.forEach(char => {
          const stateValue = localCharPoints[char] || 0;
          const refValue = charPointsRef.current[char] || 0;
          mergedPoints[char] = Math.max(stateValue, refValue);
        });
        
        // Check level completion using the merged points
        const allMastered = levelCharsRef.current.length > 0 && 
          levelCharsRef.current.every(c => {
            const pointsForChar = mergedPoints[c] || 0;
            const isMastered = pointsForChar >= TARGET_POINTS;
            return isMastered;
          });
        
        if (allMastered) {
          finishTest(true);
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
      
      // Reduce points with the penalty - using ref for immediate access
      const currentPoints = charPointsRef.current[targetChar] || 0;
      const newPoints = Math.max(0, currentPoints * INCORRECT_PENALTY);
      
      // Update the local points
      updateLocalPoints(targetChar, newPoints);
      
      // Use ref values for more reliable checking
      if (isCheckpointRef.current && strikeLimitRef.current) {
        
        // Use ref for immediate access and increment both ref and state
        const newStrikeCount = strikeCountRef.current + 1;
        strikeCountRef.current = newStrikeCount;
        
        setStrikeCount(newStrikeCount);
        
        // fail the checkpoint level
        if (newStrikeCount >= strikeLimitRef.current) {
          
          // Clear any existing feedback timer before finishing
          if (feedbackTimerRef.current !== null) {
            clearTimeout(feedbackTimerRef.current);
          }
          
          // Show the incorrect feedback for a moment before finishing
          feedbackTimerRef.current = window.setTimeout(() => {
            finishTest(false);
          }, 1000);
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
    updateLocalPoints,
    localCharPoints, 
    isCheckpoint,
    strikeLimit,
    strikeCount,
    playErrorSound,
    nextQuestion,
    finishTest
    // Removed currentLevel and charStartTime since we use refs now
  ]);
  
  // Handle an element (dot/dash) from the keyer
  const handleElement = useCallback((symbol: '.' | '-') => {
    // Always append to morse output regardless of state
    if (symbol === '.' || symbol === '-') {
      setMorseOutput(prev => prev + symbol);
    }
  }, []);
  
  // Create the keyer with stabilized callbacks
  const onWpmChange = useCallback((newWpm: number) => {
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
      console.debug(`unknown morse code detected: ${code}`);
    }
  });
  
  // Store keyer in ref for stable access
  const keyerRef = useRef(keyer);
  
  // Update refs when dependencies change
  useEffect(() => {
    keyerRef.current = keyer;
  }, [keyer]);
  
  // Start test
  const handleStartTest = useCallback(() => {
    
    // Reset all state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    strikeCountRef.current = 0; // Reset strike count ref
    setResponseTimes([]);
    setMistakesMap({});
    setTestResults(null);
    
    // Reset recently mastered character
    recentlyMasteredCharRef.current = null;
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // Make sure the keyer is installed and listening for key events
    keyerRef.current.install();
    
    // Always set the test start time when starting a test - both ref and state
    const now = Date.now();
    testStartTimeRef.current = now;
    setTestStartTime(now);
    
    // Start the test in the AppState
    startTest();
    
    // Need a slight delay to ensure state is updated
    setTimeout(() => {
      nextQuestion();
    }, 100);
  }, [startTest, nextQuestion, isCheckpoint, strikeLimit]);
  
  // Clean restart with time recording (now handleStartTest already sets the time)
  // TODO: Remove this? I think it is redundant
  const startTestAndRecordTime = useCallback(() => {
    console.log('[SendingMode] If you see this you need to cleanup. Starting test with time recording');
    handleStartTest();
  }, [handleStartTest]);
  
  // Handle moving to specific level
  // TODO: combine the various ways to start a test
  const startTestWithExplicitLevel = useCallback((levelId: string) => {
    // console.log(`[SendingMode] Starting test with explicit level: ${levelId}`);
    
    // Reset all state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    strikeCountRef.current = 0; // Reset strike count ref
    setResponseTimes([]);
    setMistakesMap({});
    setTestResults(null);
    
    // Reset recently mastered character
    recentlyMasteredCharRef.current = null;
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // Make sure the keyer is installed and listening for key events
    keyerRef.current.install();
    
    // Set test start time - both ref and state
    const now = Date.now();
    testStartTimeRef.current = now;
    setTestStartTime(now);
    
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
  
  // Add debugging hook
  useEffect(() => {
    if (isBrowser) {
      try {
        // Expose key state for debugging
        if (window) {
          (window as any).__sendingModeDebug = {
            currentChar,
            morseOutput,
            charPoints: localCharPoints,
            keyer,
            state,
            feedbackState,
            charStartTime
          };
        }
      } catch (e) {
        console.error('[DEBUG] Error setting up debug hooks:', e);
      }
    }
  }, [currentChar, morseOutput, localCharPoints, keyer, state, feedbackState, charStartTime]);
  
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
    strikeCountRef.current = 0; // Reset strike count ref
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
  
  // Calculate progress - mastered characters using local points
  // Use levelCharsRef for consistent mastery calculations
  // Calculate mastered count safely
  const masteredCount = useMemo(() => {
    // Guard against empty arrays
    if (!levelCharsRef.current || levelCharsRef.current.length === 0) {
      return 0;
    }
    
    // Create merged points using both state and ref 
    const merged: Record<string, number> = {};
    
    // Safely iterate through characters
    levelCharsRef.current.forEach(c => {
      if (c) { // Make sure character is defined
        const stateValue = (localCharPoints && c in localCharPoints) ? localCharPoints[c] : 0;
        const refValue = (charPointsRef.current && c in charPointsRef.current) ? charPointsRef.current[c] : 0;
        merged[c] = Math.max(stateValue, refValue);
      }
    });
    
    // Count mastered characters
    return levelCharsRef.current.filter(c => 
      c && merged[c] >= TARGET_POINTS
    ).length;
  }, [localCharPoints]);
  
  // Safely calculate total chars
  const totalChars = levelCharsRef.current ? levelCharsRef.current.length : 0;
  const progress = `Mastered: ${masteredCount}/${totalChars}`;
  
  // Calculate merged character points for display
  const mergedCharPoints = useMemo(() => {
    // Safely merge state and ref values
    const merged: Record<string, number> = {};
    
    if (levelCharsRef.current && levelCharsRef.current.length > 0) {
      levelCharsRef.current.forEach(c => {
        if (c) {
          const stateValue = (localCharPoints && c in localCharPoints) ? localCharPoints[c] : 0;
          const refValue = (charPointsRef.current && c in charPointsRef.current) ? charPointsRef.current[c] : 0;
          merged[c] = Math.max(stateValue, refValue);
        }
      });
    }
    
    return merged;
  }, [localCharPoints]);
  
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
          
          <MasteryDisplay 
            // Use merged points for most accurate display
            targetPoints={TARGET_POINTS}
            charPoints={mergedCharPoints}
            chars={levelCharsRef.current || []}
          />
          
          {isCheckpoint && strikeLimit && (
            <div className={styles.strikes}>
              {Array.from({ length: strikeLimit }).map((_, i) => (
                <span 
                  key={i} 
                  className={`${styles.strike} ${i < strikeCountRef.current ? styles.used : ''}`}
                >
                  ✕
                </span>
              ))}
            </div>
          )}
          
          {/* Debug indicator for checkpoint status */}
          {isDevelopmentRef.current && (
            <div style={{ position: 'absolute', top: 0, right: 0, background: 'black', color: 'white', padding: '3px', fontSize: '10px' }}>
              Checkpoint: {isCheckpointRef.current ? 'YES' : 'no'}<br />
              Strike Limit: {strikeLimitRef.current || 'none'}<br />
              Current Strikes: {strikeCountRef.current}
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