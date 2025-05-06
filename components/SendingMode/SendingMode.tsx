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
  
  // Reference to track recently mastered character
  const recentlyMasteredCharRef = useRef<string | null>(null);
  
  // Reference to track current character for callbacks
  const currentCharRef = useRef<string>('');
  
  // Environment detection
  const isClientRef = useRef(false);
  const isDevelopmentRef = useRef(false);
  
  // Utility function to verify and fix character sets
  const verifyAndFixCharacterSet = useCallback(() => {
    const level = trainingLevels.find(l => l.id === state.selectedLevelId);
    if (!level) {
      console.error(`🛑 Could not find level with ID: ${state.selectedLevelId}`);
      return false;
    }
    
    const levelChars = level.chars;
    const stateChars = state.chars;
    
    // Check for match
    const sameLength = levelChars.length === stateChars.length;
    const allPresent = levelChars.every(c => stateChars.includes(c));
    const noExtras = stateChars.every(c => levelChars.includes(c));
    
    if (sameLength && allPresent && noExtras) {
      console.log('✅ Character sets match, no fix needed');
      return true;
    }
    
    // Log the mismatch
    console.warn('⚠️ Character set mismatch detected:');
    console.warn(`- Level: ${level.name} (${level.id})`);
    console.warn(`- Level chars (${levelChars.length}): ${levelChars.join(', ')}`);
    console.warn(`- State chars (${stateChars.length}): ${stateChars.join(', ')}`);
    
    // Attempt to fix by re-selecting the level
    console.log('🔧 Fixing by re-selecting level:', level.id);
    selectLevel(level.id);
    return false;
  }, [state.selectedLevelId, state.chars, selectLevel]);
  
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
  
  // Ensure level characters are correctly loaded on mount
  useEffect(() => {
    if (currentLevel && state.chars.length > 0) {
      // Check if current state.chars matches the expected level's chars
      const levelChars = currentLevel.chars;
      const stateChars = state.chars;
      
      // Compare arrays to see if they have the same characters
      const sameLength = levelChars.length === stateChars.length;
      const allCharsPresent = levelChars.every(c => stateChars.includes(c));
      const noExtraChars = stateChars.every(c => levelChars.includes(c));
      
      console.log('🔍 LEVEL CHARS CHECK:');
      console.log('- Level ID:', state.selectedLevelId);
      console.log('- Level name:', currentLevel.name);
      console.log('- Expected chars:', levelChars);
      console.log('- Actual chars:', stateChars);
      console.log('- Same length?', sameLength);
      console.log('- All present?', allCharsPresent);
      console.log('- No extras?', noExtraChars);
      
      if (!(sameLength && allCharsPresent && noExtraChars)) {
        console.warn('⚠️ Characters mismatch detected - reselecting level');
        
        // Find missing characters
        const missing = levelChars.filter(c => !stateChars.includes(c));
        if (missing.length > 0) {
          console.error("❌ Missing characters:", missing);
        }
        
        // Find extra characters
        const extra = stateChars.filter(c => !levelChars.includes(c));
        if (extra.length > 0) {
          console.warn("⚠️ Extra characters present:", extra);
        }
        
        // Re-select the level to fix characters
        console.log('📢 Calling selectLevel with ID:', state.selectedLevelId);
        selectLevel(state.selectedLevelId);
      } else {
        console.log('✅ Characters match correctly');
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
  
  // Monitor level changes
  useEffect(() => {
    // This effect runs whenever the level ID changes
    console.log(`🔄 LEVEL CHANGED to: ${state.selectedLevelId}`);
    
    // Find the level object
    const level = trainingLevels.find(l => l.id === state.selectedLevelId);
    if (!level) {
      console.error(`❌ Could not find level with ID: ${state.selectedLevelId}`);
      return;
    }
    
    console.log(`📊 Level change diagnostics:`);
    console.log(`- New level: ${level.name} (${level.id})`);
    console.log(`- Level characters: ${level.chars.join(', ')}`);
    console.log(`- Current state.chars: ${state.chars.join(', ')}`);
    
    // Check if we need to force a level selection
    const needsReselection = 
      !state.chars.length || 
      !level.chars.every(c => state.chars.includes(c)) ||
      !state.chars.every(c => level.chars.includes(c));
    
    if (needsReselection) {
      console.warn(`⚠️ Level change detected but characters don't match - may need forced reselection`);
    }
  }, [state.selectedLevelId, state.chars]);
  
  // Keep currentCharRef in sync with currentChar state
  useEffect(() => {
    currentCharRef.current = currentChar;
    console.log(`Updated currentCharRef to: "${currentChar}"`);
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
  
  // Pick next character based on mastery weights
  const pickNextChar = useCallback(() => {
    // Get the current level definition directly to ensure we have the correct characters
    const levelDefinition = trainingLevels.find(level => level.id === state.selectedLevelId);
    if (!levelDefinition) {
      console.error(`SendingMode: Couldn't find level with ID: ${state.selectedLevelId}`);
      return state.chars[0] || '';
    }
    
    // Use the level's character list directly rather than relying on state.chars
    const levelChars = levelDefinition.chars;
    
    console.log(`SendingMode: Selecting next character from ${levelChars.length} characters (level ${levelDefinition.id}):`, levelChars);
    console.log(`SendingMode: State.chars has ${state.chars.length} characters:`, state.chars);
    console.log(`SendingMode: Current points:`, state.charPoints);
    console.log(`SendingMode: Recently mastered char:`, recentlyMasteredCharRef.current);
    
    // IMPORTANT: Use the level's character list directly instead of state.chars
    return selectNextCharacter(
      levelChars,
      state.charPoints,
      TARGET_POINTS,
      recentlyMasteredCharRef.current
    );
  }, [state.selectedLevelId, state.chars, state.charPoints]);
  
  // Finish the test - similar to TrainingMode's finishTest
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
  
  // Present next question - similar to TrainingMode's nextQuestion
  const nextQuestion = useCallback(() => {
    // First verify character set is correct
    if (!verifyAndFixCharacterSet()) {
      console.log('⚠️ Character set mismatch detected - fixing before proceeding');
      // Wait a moment for the fix to apply, then try again
      setTimeout(() => {
        nextQuestion();
      }, 100);
      return Promise.resolve();
    }
    
    const nextChar = pickNextChar();
    console.log(`SendingMode: Next question with character: "${nextChar}"`);
    
    // Set the current character
    setCurrentChar(nextChar);
    currentCharRef.current = nextChar;
    console.log(`Directly set currentCharRef to: "${nextChar}"`);
    
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking
    const now = Date.now();
    setCharStartTime(now);
    console.log(`Setting character start time: ${now}`);
    
    // Return a promise that resolves immediately to match TrainingMode's flow
    return Promise.resolve();
  }, [pickNextChar, verifyAndFixCharacterSet]);
  
  // Handle character input from the keyer
  const handleCharacter = useCallback((char: string) => {
    // Skip if no current char to match against
    if (!currentCharRef.current) {
      console.log(`SendingMode: Character "${char}" detected but currentCharRef is empty - ignoring`);
      return;
    }
    
    const currentChar = currentCharRef.current;
    console.log(`SendingMode: Keyer decoded: "${char}", target: "${currentChar}"`);
    console.log(`SendingMode: Comparing ${char.toLowerCase()} === ${currentChar.toLowerCase()}: ${char.toLowerCase() === currentChar.toLowerCase()}`);
    
    // Calculate response time
    const responseTime = charStartTime ? (Date.now() - charStartTime) : 0;
    console.log(`Response time calculation: ${Date.now()} - ${charStartTime} = ${responseTime}ms`);
    
    // Check if character matches
    if (char.toLowerCase() === currentChar.toLowerCase()) {
      console.log(`SendingMode: CORRECT match - "${char}" matches "${currentChar}"`);
      
      // Store the successful character
      const successChar = currentChar;
      
      // Clear the current character and set feedback
      setCurrentChar('');
      currentCharRef.current = '';
      setFeedbackState('correct');
      
      // Calculate points based on response time
      const points = calculatePointsForTime(responseTime);
      console.log(`SendingMode: Awarding ${points.toFixed(2)} points for response time: ${responseTime}ms`);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: successChar, time: responseTime / 1000 }]);
      
      // Update character points
      const currentPoints = state.charPoints[successChar] || 0;
      const newPoints = currentPoints + points;
      
      console.log(`[POINTS DEBUG] Updating points for ${successChar}:`);
      console.log(`  - Current points from state: ${state.charPoints[successChar] || 0}`);
      console.log(`  - Points being added: ${points}`);
      console.log(`  - New total points: ${newPoints}`);
      
      // Check if character will reach mastery with this addition
      const willCompleteMastery = newPoints >= TARGET_POINTS && currentPoints < TARGET_POINTS;
      
      // If this character will now be mastered, track it to avoid immediate reselection
      if (willCompleteMastery) {
        recentlyMasteredCharRef.current = successChar;
      }
      
      updateCharPoints(successChar, newPoints);
      
      console.log(`Character ${successChar} updated: ${currentPoints} → ${newPoints} points (${points} added, response time: ${(responseTime / 1000).toFixed(2)}s)`);
      
      // Delay before next question or finishing - like TrainingMode
      setTimeout(() => {
        // Create a simulated updated charPoints object that includes the most recent update
        const updatedCharPoints = { ...state.charPoints, [successChar]: newPoints };
        
        // Get the current level definition for accurate character list
        const currentLevelDef = trainingLevels.find(level => level.id === state.selectedLevelId);
        if (!currentLevelDef) {
          console.error(`SendingMode: Couldn't find level with ID: ${state.selectedLevelId} for completion check`);
          nextQuestion();
          return;
        }
        
        // Use the level definition's character list directly
        const levelChars = currentLevelDef.chars;
        
        // Check if all characters are mastered using the updated points
        const allMastered = levelChars.every(c => (updatedCharPoints[c] || 0) >= TARGET_POINTS);
        
        console.log('Completion check:', { 
          levelId: state.selectedLevelId,
          levelChars,
          updatedCharPoints,
          allMastered
        });
        
        if (allMastered) {
          finishTest(true);
        } else {
          nextQuestion();
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
      console.log(`SendingMode: Incorrect match - keeping same character, clearing feedback in ${FEEDBACK_DELAY}ms`);
      setTimeout(() => {
        setFeedbackState('none');
        // Reset morse output so they can try again
        setMorseOutput('');
      }, FEEDBACK_DELAY);
    }
    
    // Clear morse output after processing input
    setMorseOutput('');
  }, [
    currentCharRef,
    charStartTime,
    calculatePointsForTime,
    updateCharPoints,
    state.charPoints, 
    state.chars,
    isCheckpoint,
    strikeLimit,
    strikeCount,
    playErrorSound,
    nextQuestion,
    finishTest
  ]);
  
  // Handle an element (dot/dash) from the keyer
  const handleElement = useCallback((symbol: '.' | '-') => {
    // Always append to morse output regardless of state
    // This ensures dots/dashes are displayed even if there's UI latency
    setMorseOutput(prev => prev + symbol);
  }, []);
  
  // Create the keyer with stabilized callbacks
  const onWpmChange = useCallback((newWpm: number) => {
    console.log('WPM changed to', newWpm);
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
    keyerRef.current.clear();
    
    // Start the test in the AppState
    startTest();
    
    // Set test start time
    const now = Date.now();
    setTestStartTime(now);
    console.log(`Setting test start time: ${now}`);
    
    // Start the first question after a short delay to ensure state is updated
    setTimeout(() => {
      nextQuestion();
    }, 100);
  }, [startTest, nextQuestion]);
  
  // Clean restart with time recording
  const startTestAndRecordTime = useCallback(() => {
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
    keyerRef.current.clear();
    
    // IMPORTANT: First explicitly select the level to ensure characters are loaded correctly
    console.log(`🔑 Explicitly selecting level ${levelId} before starting test`);
    selectLevel(levelId);
    
    // Set test start time
    const now = Date.now();
    setTestStartTime(now);
    console.log(`Setting test start time: ${now}`);
    
    // THEN start the test with the level ID
    setTimeout(() => {
      console.log(`🚀 Now starting test with level ID: ${levelId}`);
      startTestWithLevelId(levelId);
      
      // Start the first question after a short delay to ensure state is updated
      setTimeout(() => {
        nextQuestion();
      }, 100);
    }, 50); // Small delay to ensure level selection completes
  }, [selectLevel, startTestWithLevelId, nextQuestion]);
  
  // Install keyer once on mount
  useEffect(() => {
    if (isBrowser) {
      console.log('Installing keyer (on mount only)');
      keyer.install();
    }
    
    return () => {
      console.log('Uninstalling keyer (on unmount only)');
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
      console.log("�� Starting test with explicit level ID:", nextLevel.id);
      
      // Set the test start time
      const now = Date.now();
      setTestStartTime(now);
      console.log(`Setting test start time for next level: ${now}`);
      
      // Following TrainingMode's approach: First select the level, then start test
      console.log("🔑 First selecting level:", nextLevel.id);
      selectLevel(nextLevel.id);
      
      // Then start the test with a delay
      setTimeout(() => {
        console.log("🚀 Now starting test with level:", nextLevel.id);
        startTestWithLevelId(nextLevel.id);
        
        // Then set up the first question
        setTimeout(() => {
          nextQuestion();
        }, 200);
      }, 100);
    } else {
      // Restart current level if at end
      console.log("🔁 Restarting current level (at end of levels)");
      startTestAndRecordTime();
    }
  }, [state.selectedLevelId, selectLevel, startTestWithLevelId, nextQuestion, startTestAndRecordTime]);
  
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