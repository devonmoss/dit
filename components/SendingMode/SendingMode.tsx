import React, { useState, useEffect, useCallback, useRef, useMemo, ErrorBoundary } from 'react';
import styles from './SendingMode.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { isBrowser } from '../../utils/morse';
import MasteryDisplay from '../MasteryDisplay/MasteryDisplay';
import TestResultsSummary from '../TestResultsSummary/TestResultsSummary';
import { trainingLevels } from '../../utils/levels';
import { useIambicKeyer } from '../../hooks/useIambicKeyer';
import { selectNextCharacter } from '../../utils/characterSelection';
import { CharPointsProvider, useCharPoints } from '../../contexts/CharPointsContext';
import { createLogger } from '../../utils/logger';
import { getLevelChars, validateLevelCharacters, areAllCharsMastered } from '../../utils/levelUtils';
import SendingModeDebugPanel from './SendingModeDebugPanel';
import FeedbackDisplay from './FeedbackDisplay';
import KeyerDisplay from './KeyerDisplay';
import CharacterDisplay from './CharacterDisplay';

// Create logger instance for this component
const logger = createLogger('SendingMode');

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

/**
 * SendingMode component wrapper that provides CharPointsContext
 */
const SendingModeWithContext: React.FC<SendingModeProps> = (props) => {
  return (
    <CharPointsProvider>
      <SendingMode {...props} />
    </CharPointsProvider>
  );
};

/**
 * Error boundary component for SendingMode
 */
class SendingModeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('SendingMode error boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <h3>Something went wrong with the Sending Mode component</h3>
          <p>Please try refreshing the page or selecting a different level.</p>
          <details>
            <summary>Technical details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * SendingMode component responsible for iambic keyer practice
 */
const SendingMode: React.FC<SendingModeProps> = () => {
  const { state, startTest, endTest, updateCharPoints, saveResponseTimes, selectLevel, startTestWithLevelId } = useAppState();
  const charPoints = useCharPoints();
  
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
  
  // Question timing state (analogous to TrainingMode's questionStartTime)
  const [charStartTime, setCharStartTime] = useState<number | null>(null);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  // Reference to track current character for callbacks
  const currentCharRef = useRef<string>('');
  
  // Reference to track character start time
  const charStartTimeRef = useRef<number>(0);
  
  // Environment detection
  const isClientRef = useRef(false);
  const isDevelopmentRef = useRef(false);
  
  // New state for character selection debugging
  const [lastPickerInputs, setLastPickerInputs] = useState<{
    levelId: string;
    levelName: string;
    levelChars: string[];
    stateChars: string[];
    pointsSnapshot: Record<string, number>;
    recentlyMasteredChar: string | null;
  } | null>(null);

  // Get current level info - memoized to prevent recalculation
  const currentLevel = useMemo(() => {
    return trainingLevels.find(level => level.id === state.selectedLevelId);
  }, [state.selectedLevelId]);
  
  const isCheckpoint = currentLevel?.type === 'checkpoint';
  const strikeLimit = isCheckpoint ? currentLevel?.strikeLimit : undefined;
  
  // Pre-declare handleLevelSelection
  const handleLevelSelection = useCallback((levelId: string) => {
    logger.info(`Explicitly selecting level ${levelId}`);
    
    // Reset local character points tracking
    charPoints.resetLocalCharPoints();
    charPoints.setRecentlyMasteredChar(null);
    
    // Then select the level
    selectLevel(levelId);
  }, [selectLevel, charPoints]);
  
  // Utility function to verify and fix character sets
  const verifyAndFixCharacterSet = useCallback(() => {
    // Use character utility to validate character set
    const { valid, missing, extra } = validateLevelCharacters(
      state.selectedLevelId, 
      state.chars
    );
    
    if (valid) {
      logger.debug('Character sets match, no fix needed');
      return true;
    }
    
    // Log the mismatch
    logger.warn('Character set mismatch detected:');
    logger.warn(`- Level: ${state.selectedLevelId}`);
    logger.warn(`- Missing chars: ${missing.join(', ')}`);
    logger.warn(`- Extra chars: ${extra.join(', ')}`);
    
    // Attempt to fix by re-selecting the level
    logger.info(`Fixing by re-selecting level: ${state.selectedLevelId}`);
    
    // Reset local character points
    charPoints.resetLocalCharPoints();
    
    // Use our custom handler for proper reset
    handleLevelSelection(state.selectedLevelId);
    return false;
  }, [state.selectedLevelId, state.chars, handleLevelSelection, charPoints]);
  
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
        
        logger.debug('Audio context initialized successfully');
      } catch (e) {
        logger.error('Failed to initialize audio context:', e);
      }
    }
    
    return () => {
      stopSound();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => logger.error('Error closing audio context:', e));
      }
    };
  }, []);
  
  // Ensure level characters are correctly loaded on mount
  useEffect(() => {
    if (currentLevel && state.chars.length > 0) {
      // Check if current state.chars matches the expected level's chars
      const { valid, missing, extra } = validateLevelCharacters(
        state.selectedLevelId, 
        state.chars
      );
      
      logger.debug(`Level chars check: Level ID: ${state.selectedLevelId}`);
      
      if (!valid) {
        logger.warn('Characters mismatch detected - reselecting level');
        
        if (missing.length > 0) {
          logger.error(`Missing characters: ${missing.join(', ')}`);
        }
        
        if (extra.length > 0) {
          logger.warn(`Extra characters present: ${extra.join(', ')}`);
        }
        
        // Re-select the level to fix characters
        logger.info(`Calling selectLevel with ID: ${state.selectedLevelId}`);
        selectLevel(state.selectedLevelId);
      } else {
        logger.debug('Characters match correctly');
      }
    }
  }, [currentLevel, state.chars, state.selectedLevelId, selectLevel]);
  
  // Debug logging for state changes
  useEffect(() => {
    logger.debug(
      `State Update - Level: ${state.selectedLevelId}, ` +
      `Chars: [${state.chars.join(',')}], ` +
      `TestActive: ${state.testActive}`
    );
  }, [state.selectedLevelId, state.chars, state.testActive]);
  
  // Monitor level changes
  useEffect(() => {
    // This effect runs whenever the level ID changes
    logger.info(`Level changed to: ${state.selectedLevelId}`);
    
    // Find the level object
    const level = trainingLevels.find(l => l.id === state.selectedLevelId);
    if (!level) {
      logger.error(`Could not find level with ID: ${state.selectedLevelId}`);
      return;
    }
    
    logger.debug(`Level change: ${level.name} (${level.id})`);
    
    // Check if we need to force a level selection
    const { valid } = validateLevelCharacters(state.selectedLevelId, state.chars);
    
    if (!valid) {
      logger.warn(`Level change detected but characters don't match - may need forced reselection`);
    }
    
    // Always reset localCharPoints when level changes to prevent state carryover
    charPoints.resetLocalCharPoints();
    logger.debug('Reset localCharPoints due to level change');
  }, [state.selectedLevelId, state.chars, charPoints]);
    
  // Synchronization effect to force consistent level ID on mount
  useEffect(() => {
    // This is a critical synchronization check that runs on mount
    if (!state.selectedLevelId) return;
    
    logger.info(`Critical level sync check on mount: ${state.selectedLevelId}`);
    
    // This ensures the level is properly registered with the app state
    // and all internal state is consistent
    selectLevel(state.selectedLevelId);
    
    // Reset any local state that could cause problems
    charPoints.resetLocalCharPoints();
    charPoints.setRecentlyMasteredChar(null);
    
    logger.debug('Performed critical level sync to ensure consistency');
  }, [selectLevel, charPoints, state.selectedLevelId]); 
  
  // Keep currentCharRef in sync with currentChar state
  useEffect(() => {
    currentCharRef.current = currentChar;
    logger.debug(`Updated currentCharRef to: "${currentChar}"`);
  }, [currentChar]);
  
  // Keep charStartTimeRef in sync with charStartTime state
  useEffect(() => {
    if (charStartTime) {
      charStartTimeRef.current = charStartTime;
      logger.debug(`Synced charStartTimeRef: ${charStartTime}`);
    }
  }, [charStartTime]);
  
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
      logger.error('Error playing error sound:', e);
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
      logger.error('Error playing element:', e);
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
  
  // Pick next character based on mastery weights
  const pickNextChar = useCallback(() => {
    // Get level characters using utility function
    const levelChars = getLevelChars(state.selectedLevelId);
    logger.debug(`Using ${levelChars.length} characters for level ${state.selectedLevelId}`);
    
    // Store the inputs for debugging
    setLastPickerInputs({
      levelId: state.selectedLevelId,
      levelName: currentLevel?.name || "Direct Lookup",
      levelChars: [...levelChars],
      stateChars: [...state.chars],
      pointsSnapshot: {...state.charPoints},
      recentlyMasteredChar: charPoints.recentlyMasteredChar
    });
    
    // Use the level character list
    return selectNextCharacter(
      levelChars,
      state.charPoints,
      TARGET_POINTS,
      charPoints.recentlyMasteredChar
    );
  }, [state.selectedLevelId, state.chars, state.charPoints, charPoints.recentlyMasteredChar, currentLevel]);
  
  // Finish the test - similar to TrainingMode's finishTest
  const finishTest = useCallback((completed = true) => {
    // Calculate elapsed time
    const endTime = Date.now();
    const elapsedSec = testStartTime ? (endTime - testStartTime) / 1000 : 0;
    
    // Save response times
    if (responseTimes.length > 0) {
      logger.debug(`Saving ${responseTimes.length} response times`);
      saveResponseTimes(responseTimes);
    }
    
    // End app test
    endTest(completed);
    
    // Set test results
    logger.info(`Test ${completed ? 'completed' : 'ended'}, elapsed time: ${elapsedSec.toFixed(1)}s`);
    setTestResults({
      completed,
      elapsedTime: elapsedSec
    });
  }, [testStartTime, responseTimes, saveResponseTimes, endTest]);
  
  // Present next question - similar to TrainingMode's nextQuestion
  const nextQuestion = useCallback(() => {
    // First verify character set is correct
    if (!verifyAndFixCharacterSet()) {
      logger.warn('Character set mismatch detected - fixing before proceeding');
      // Wait a moment for the fix to apply, then try again
      setTimeout(() => {
        nextQuestion();
      }, 100);
      return Promise.resolve();
    }
    
    const nextChar = pickNextChar();
    logger.debug(`Next question with character: "${nextChar}"`);
    
    // SAFETY CHECK: Validate the nextChar is actually in the current level's character set
    const currentLevelChars = getLevelChars(state.selectedLevelId);
    
    // Check if the selected character is valid for this level
    if (!currentLevelChars.includes(nextChar)) {
      logger.error(`Character "${nextChar}" not in current level (${state.selectedLevelId}) character set`);
      
      // Force select a valid character from the current level
      const validChar = currentLevelChars[0]; // fallback to first char
      logger.warn(`Replacing invalid character "${nextChar}" with valid character "${validChar}"`);
      
      // Set the corrected character
      setCurrentChar(validChar);
      currentCharRef.current = validChar;
      logger.debug(`Set currentCharRef to corrected character: "${validChar}"`);
    } else {
      // Normal flow for valid character
      setCurrentChar(nextChar);
      currentCharRef.current = nextChar;
      logger.debug(`Set currentCharRef to: "${nextChar}"`);
    }
    
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking
    const now = Date.now();
    setCharStartTime(now);
    charStartTimeRef.current = now; // Set the ref value too
    logger.debug(`Setting character start time: ${now}`);
    
    // Log point information for this character for debugging
    const currentStatePoints = state.charPoints[currentChar] || 0;
    const currentLocalPoints = charPoints.localCharPoints[currentChar] || 0;
    logger.debug(`Character "${currentChar}" points - state: ${currentStatePoints}, local: ${currentLocalPoints}`);
    
    // Return a promise that resolves immediately to match TrainingMode's flow
    return Promise.resolve();
  }, [
    pickNextChar, 
    verifyAndFixCharacterSet, 
    state.charPoints, 
    state.selectedLevelId, 
    currentChar, 
    charPoints.localCharPoints
  ]);
  
  // Handle character input from the keyer
  const handleCharacter = useCallback((char: string) => {
    // Skip if no current char to match against
    if (!currentCharRef.current) {
      logger.debug(`Character "${char}" detected but currentCharRef is empty - ignoring`);
      return;
    }
    
    const currentChar = currentCharRef.current;
    logger.debug(`Keyer decoded: "${char}", target: "${currentChar}"`);
    
    // Calculate response time - use the ref value for reliability
    const responseTime = charStartTimeRef.current ? (Date.now() - charStartTimeRef.current) : 0;
    logger.debug(`Response time: ${responseTime}ms`);
    
    // Check if character matches
    if (char.toLowerCase() === currentChar.toLowerCase()) {
      logger.debug(`CORRECT match - "${char}" matches "${currentChar}"`);
      
      // Store the successful character
      const successChar = currentChar;
      
      // Clear the current character and set feedback
      setCurrentChar('');
      currentCharRef.current = '';
      setFeedbackState('correct');
      
      // Calculate points based on response time
      const points = calculatePointsForTime(responseTime);
      logger.debug(`Awarding ${points.toFixed(2)} points for response time: ${responseTime}ms`);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: successChar, time: responseTime / 1000 }]);
      
      // Get current points from app state
      const currentPoints = state.charPoints[successChar] || 0;
      
      // Get current points from our local tracker
      const localPoints = charPoints.localCharPoints[successChar] || 0;
      const effectiveCurrentPoints = Math.max(currentPoints, localPoints);
      
      // If there's a mismatch, log a warning
      if (currentPoints !== localPoints) {
        logger.warn(`Point mismatch for "${successChar}": state=${currentPoints}, local=${localPoints}. Using ${effectiveCurrentPoints}.`);
      }
      
      const newPoints = effectiveCurrentPoints + points;
      
      logger.debug(`Updating points for ${successChar}: ${effectiveCurrentPoints} → ${newPoints}`);
      
      // Check if character will reach mastery with this addition
      const willCompleteMastery = newPoints >= TARGET_POINTS && effectiveCurrentPoints < TARGET_POINTS;
      
      // If this character will now be mastered, track it to avoid immediate reselection
      if (willCompleteMastery) {
        charPoints.setRecentlyMasteredChar(successChar);
        logger.info(`Character "${successChar}" mastered!`);
      }
      
      // Update our local context state
      charPoints.updateLocalCharPoints(successChar, newPoints);
      
      // Call the context function
      updateCharPoints(successChar, newPoints);
      
      // Delay before next question or finishing - like TrainingMode
      setTimeout(() => {
        // Check if all characters are mastered using the levelUtils helper
        const allMastered = areAllCharsMastered(
          state.selectedLevelId,
          charPoints.localCharPoints,
          TARGET_POINTS
        );
        
        // Get new characters to make sure we have some to try
        const levelChars = getLevelChars(state.selectedLevelId);
        const oldChars = ['e', 't']; // Level 1 characters
        const newChars = levelChars.filter(c => !oldChars.includes(c));
        
        // Create a merged points object that takes the maximum of state and local values
        const mergedPoints: Record<string, number> = { ...state.charPoints };
        Object.entries(charPoints.localCharPoints).forEach(([char, points]) => {
          mergedPoints[char] = Math.max(mergedPoints[char] || 0, points);
        });
        
        // Check specific character sets
        const oldCharsMastered = oldChars.every(c => {
          if (!levelChars.includes(c)) return true; // Skip if not in this level
          const points = mergedPoints[c] || 0;
          return points >= TARGET_POINTS;
        });
        
        const newCharsAttempted = newChars.some(c => {
          return (mergedPoints[c] || 0) > 0;
        });
        
        logger.debug(`Completion status: allMastered=${allMastered}, oldCharsMastered=${oldCharsMastered}, newCharsAttempted=${newCharsAttempted}`);
        
        // NEVER end the test unless all characters have been mastered
        // Also ensure at least one new character has been attempted before finishing
        if (allMastered) {
          logger.info(`Level complete - all ${levelChars.length} characters are mastered`);
          finishTest(true);
        } else if (oldCharsMastered && !newCharsAttempted) {
          logger.info(`Only old characters mastered but new characters not attempted - forcing new character selection`);
          
          // Force selection of a new character from the level
          const forceChar = newChars[0];
          logger.debug(`Forcing selection of new character: "${forceChar}" for next question`);
          
          // Set current character directly
          setCurrentChar(forceChar);
          currentCharRef.current = forceChar;
          
          // Reset the morse output and feedback state
          setMorseOutput('');
          setFeedbackState('none');
          
          // Set the start time for response time tracking
          const now = Date.now();
          setCharStartTime(now);
          charStartTimeRef.current = now;
        } else {
          logger.debug(`Continuing test - not all characters mastered yet`);
          nextQuestion();
        }
      }, FEEDBACK_DELAY);
    } else {
      // Incorrect character
      logger.debug(`INCORRECT match - "${char}" does not match "${currentChar}"`);
      
      // Store the character that was incorrectly entered for display
      setIncorrectChar(char);
      
      // Show the incorrect character feedback
      setFeedbackState('incorrect');
      
      // Update mistakes map
      setMistakesMap(prev => {
        const count = prev[currentChar] || 0;
        logger.debug(`Increasing mistake count for "${currentChar}" from ${count} to ${count + 1}`);
        return { ...prev, [currentChar]: count + 1 };
      });
      
      // Reduce points with the penalty
      const currentPoints = state.charPoints[currentChar] || 0;
      const localPoints = charPoints.localCharPoints[currentChar] || 0;
      const effectiveCurrentPoints = Math.max(currentPoints, localPoints);
      
      // Calculate the new, reduced point value
      const newPoints = Math.max(0, effectiveCurrentPoints * INCORRECT_PENALTY);
      
      logger.debug(`Reducing points for "${currentChar}": ${effectiveCurrentPoints} → ${newPoints}`);
      
      // Update our local tracking
      charPoints.updateLocalCharPoints(currentChar, newPoints);
      
      // Update the app state
      updateCharPoints(currentChar, newPoints);
      
      // Properly enforce the checkpoint strike rule
      if (isCheckpoint && strikeLimit) {
        const newStrikeCount = strikeCount + 1;
        logger.debug(`Increasing strike count to ${newStrikeCount} (limit: ${strikeLimit})`);
        setStrikeCount(newStrikeCount);
        
        if (newStrikeCount >= strikeLimit) {
          logger.info(`Strike limit reached (${newStrikeCount}/${strikeLimit}) - ending test`);
          finishTest(false);
          return;
        }
      }
      
      // Play error sound
      playErrorSound();
      
      // Clear feedback after delay but KEEP the same character
      logger.debug(`Incorrect match - keeping same character, clearing feedback after delay`);
      setTimeout(() => {
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
    isCheckpoint,
    strikeLimit,
    strikeCount,
    playErrorSound,
    nextQuestion,
    finishTest,
    charPoints
  ]);
  
  // Handle an element (dot/dash) from the keyer
  const handleElement = useCallback((symbol: '.' | '-') => {
    // Always append to morse output regardless of state
    // This ensures dots/dashes are displayed even if there's UI latency
    setMorseOutput(prev => prev + symbol);
  }, []);
  
  // Create the keyer with stabilized callbacks
  const onWpmChange = useCallback((newWpm: number) => {
    logger.debug(`WPM changed to ${newWpm}`);
  }, []);
  
  // Create the keyer
  const keyer = useIambicKeyer({
    wpm: state.sendWpm,
    minWpm: 5,
    maxWpm: 40,
    onElement: handleElement,
    playElement: playElement,
    onCharacter: handleCharacter,
    onWpmChange
  });
  
  // Store keyer in ref for stable access
  const keyerRef = useRef(keyer);
  useEffect(() => {
    keyerRef.current = keyer;
  }, [keyer]);
  
  // Start test - similar to TrainingMode's handleStartTest
  const handleStartTest = useCallback(() => {
    logger.info('Starting test - initializing state');
    
    // Force level consistency before starting
    const currentLevelId = state.selectedLevelId;
    logger.debug(`Forcing level sync before test start: ${currentLevelId}`);
    selectLevel(currentLevelId);
    
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
    charPoints.setRecentlyMasteredChar(null);
    
    // Reset local character points to prevent carryover between tests
    charPoints.resetLocalCharPoints();
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // Start the test in the AppState
    startTest();
    
    // Set test start time
    const now = Date.now();
    setTestStartTime(now);
    logger.debug(`Setting test start time: ${now}`);
    
    // Start the first question after a short delay to ensure state is updated
    setTimeout(() => {
      nextQuestion();
    }, 100);
  }, [startTest, nextQuestion, state.selectedLevelId, selectLevel, charPoints]);
  
  // Clean restart with time recording
  const startTestAndRecordTime = useCallback(() => {
    handleStartTest();
  }, [handleStartTest]);
  
  // Handle test starting with level ID
  const startTestWithExplicitLevel = useCallback((levelId: string) => {
    logger.info(`Starting test with explicit level ID: ${levelId}`);
    
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
    charPoints.setRecentlyMasteredChar(null);
    
    // Reset local character points to prevent carryover between levels
    charPoints.resetLocalCharPoints();
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // First explicitly select the level to ensure characters are loaded correctly
    logger.debug(`Explicitly selecting level ${levelId} before starting test`);
    handleLevelSelection(levelId);
    
    // Set test start time
    const now = Date.now();
    setTestStartTime(now);
    logger.debug(`Setting test start time: ${now}`);
    
    // Then start the test with the level ID
    setTimeout(() => {
      logger.debug(`Starting test with level ID: ${levelId}`);
      startTestWithLevelId(levelId);
      
      // Start the first question after a short delay to ensure state is updated
      setTimeout(() => {
        nextQuestion();
      }, 50);
    }, 50); // Small delay to ensure level selection completes
  }, [
    selectLevel, 
    startTestWithLevelId, 
    nextQuestion, 
    handleLevelSelection, 
    charPoints
  ]);
  
  // Install keyer once on mount
  useEffect(() => {
    if (isBrowser) {
      logger.debug('Installing keyer (on mount only)');
      keyer.install();
    }
    
    return () => {
      logger.debug('Uninstalling keyer (on unmount only)');
      keyerRef.current.uninstall();
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
    logger.info("Moving to next level");
    setTestResults(null);
    
    // Reset state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    setResponseTimes([]);
    setMistakesMap({});
    
    // Reset local character points to prevent carryover between levels
    charPoints.resetLocalCharPoints();
    
    // Get current level index
    const currentLevelIndex = trainingLevels.findIndex(l => l.id === state.selectedLevelId);
    logger.debug(`Moving from level index: ${currentLevelIndex}`);
    
    if (currentLevelIndex >= 0 && currentLevelIndex < trainingLevels.length - 1) {
      // Move to next level
      const nextLevel = trainingLevels[currentLevelIndex + 1];
      logger.debug(`Moving to level: ${nextLevel.id} (${nextLevel.name})`);
      
      // Set the test start time
      const now = Date.now();
      setTestStartTime(now);
      
      // Following TrainingMode's approach: First select the level, then start test
      logger.debug(`Selecting level: ${nextLevel.id}`);
      handleLevelSelection(nextLevel.id);
      
      // Then start the test with a delay
      setTimeout(() => {
        logger.debug(`Starting test with level: ${nextLevel.id}`);
        startTestWithLevelId(nextLevel.id);
        
        // Then set up the first question
        setTimeout(() => {
          nextQuestion();
        }, 200);
      }, 100);
    } else {
      // Restart current level if at end
      logger.debug("Restarting current level (at end of levels)");
      startTestAndRecordTime();
    }
  }, [
    state.selectedLevelId, 
    handleLevelSelection, 
    startTestWithLevelId, 
    nextQuestion, 
    startTestAndRecordTime,
    charPoints
  ]);
  
  // Calculate progress - mastered characters
  const masteredCount = useMemo(() => {
    return state.chars.filter(c => {
      // Use effective points (max of local and app state)
      const statePoints = state.charPoints[c] || 0;
      const localPoints = charPoints.localCharPoints[c] || 0;
      return Math.max(statePoints, localPoints) >= TARGET_POINTS;
    }).length;
  }, [state.chars, state.charPoints, charPoints.localCharPoints]);
  
  const progress = useMemo(() => {
    return state.chars.length > 0 ? `Mastered: ${masteredCount}/${state.chars.length}` : '';
  }, [masteredCount, state.chars.length]);
  
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
      {/* Debug panel - only visible in development */}
      {isClientRef.current && isDevelopmentRef.current && (
        <SendingModeDebugPanel
          state={state}
          currentLevel={currentLevel}
          testStartTime={testStartTime}
          currentChar={currentChar}
          currentCharRef={currentCharRef}
          recentlyMasteredCharRef={{ current: charPoints.recentlyMasteredChar }}
          responseTimes={responseTimes}
          mistakesMap={mistakesMap}
          localCharPointsRef={{ current: charPoints.localCharPoints }}
          lastPickerInputs={lastPickerInputs}
          TARGET_POINTS={TARGET_POINTS}
          feedbackState={feedbackState}
          charStartTime={charStartTime}
          charStartTimeRef={charStartTimeRef}
        />
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
          
          <CharacterDisplay currentChar={currentChar} />
          <FeedbackDisplay feedbackState={feedbackState} incorrectChar={incorrectChar} />
          
          <div className={styles.sendingInstructions}>
            Use ← key for <span className={styles.dot}>·</span> and → key for <span className={styles.dash}>–</span>
          </div>
          
          <KeyerDisplay morseOutput={morseOutput} />
          
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

/**
 * Export the component wrapped in error boundary and context provider
 */
export default function SendingModeWithErrorBoundary() {
  return (
    <SendingModeErrorBoundary>
      <SendingModeWithContext />
    </SendingModeErrorBoundary>
  );
}