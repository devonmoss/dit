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
  
  // Reference to track character start time
  const charStartTimeRef = useRef<number>(0);
  
  // Environment detection
  const isClientRef = useRef(false);
  const isDevelopmentRef = useRef(false);
  
  // Reference to track character points locally
  const localCharPointsRef = useRef<Record<string, number>>({});
  
  // New state for character selection debugging
  const [lastPickerInputs, setLastPickerInputs] = useState<{
    levelId: string;
    levelName: string;
    levelChars: string[];
    stateChars: string[];
    pointsSnapshot: Record<string, number>;
    recentlyMasteredChar: string | null;
  } | null>(null);
  
  // Pre-declare handleLevelSelection
  const handleLevelSelection = useCallback((levelId: string) => {
    console.log(`SendingMode: Explicitly selecting level ${levelId}`);
    
    // Reset local state first
    localCharPointsRef.current = {};
    recentlyMasteredCharRef.current = null;
    
    // Then select the level
    selectLevel(levelId);
  }, [selectLevel]);
  
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
    
    // Reset local character points to ensure clean slate
    localCharPointsRef.current = {};
    
    // Use our custom handler for proper reset
    handleLevelSelection(level.id);
    return false;
  }, [state.selectedLevelId, state.chars, handleLevelSelection]);
  
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
    
    // Always reset localCharPointsRef when level changes to prevent state carryover
    localCharPointsRef.current = {};
    console.log('Reset localCharPointsRef due to level change');
  }, [state.selectedLevelId, state.chars]);
  
  // Keep currentCharRef in sync with currentChar state
  useEffect(() => {
    currentCharRef.current = currentChar;
    console.log(`Updated currentCharRef to: "${currentChar}"`);
  }, [currentChar]);
  
  // Keep charStartTimeRef in sync with charStartTime state
  useEffect(() => {
    if (charStartTime) {
      charStartTimeRef.current = charStartTime;
      console.log(`Synced charStartTimeRef with state: ${charStartTime}`);
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
    
    // Store the inputs for debugging
    setLastPickerInputs({
      levelId: levelDefinition.id,
      levelName: levelDefinition.name,
      levelChars: [...levelChars],
      stateChars: [...state.chars],
      pointsSnapshot: {...state.charPoints},
      recentlyMasteredChar: recentlyMasteredCharRef.current
    });
    
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
  
  // Monitor charPoints updates
  useEffect(() => {
    console.log('💾 Syncing character points with local tracking');
    
    // Get the current level definition
    const currentLevelDef = trainingLevels.find(level => level.id === state.selectedLevelId);
    if (!currentLevelDef) {
      console.error(`Couldn't find level with ID: ${state.selectedLevelId} for points sync`);
      return;
    }
    
    // Only sync points for the current level's characters
    currentLevelDef.chars.forEach(char => {
      const statePoints = state.charPoints[char] || 0;
      const localPoints = localCharPointsRef.current[char] || 0;
      
      // Only update if there's a difference and state has higher points
      if (statePoints > localPoints) {
        console.log(`Syncing points for "${char}": local ${localPoints} → state ${statePoints}`);
        localCharPointsRef.current[char] = statePoints;
      }
    });
  }, [state.charPoints, state.selectedLevelId]);
  
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
    
    // SAFETY CHECK: Validate the nextChar is actually in the current level's character set
    const currentLevelDef = trainingLevels.find(level => level.id === state.selectedLevelId);
    if (!currentLevelDef) {
      console.error(`SendingMode: Couldn't find level with ID: ${state.selectedLevelId} for character validation`);
      return Promise.resolve();
    }
    
    // Check if the selected character is valid for this level
    if (!currentLevelDef.chars.includes(nextChar)) {
      console.error(`🚨 ERROR: Character "${nextChar}" not in current level (${currentLevelDef.id}) character set: ${currentLevelDef.chars.join(', ')}`);
      
      // Force select a valid character from the current level
      const validChar = currentLevelDef.chars[0]; // fallback to first char
      console.log(`🛠️ CORRECTION: Replacing invalid character "${nextChar}" with valid character "${validChar}"`);
      
      // Set the corrected character
      setCurrentChar(validChar);
      currentCharRef.current = validChar;
      console.log(`Directly set currentCharRef to corrected character: "${validChar}"`);
    } else {
      // Normal flow for valid character
      setCurrentChar(nextChar);
      currentCharRef.current = nextChar;
      console.log(`Directly set currentCharRef to: "${nextChar}"`);
    }
    
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking
    const now = Date.now();
    setCharStartTime(now);
    charStartTimeRef.current = now; // Set the ref value too
    console.log(`Setting character start time: ${now} (also set in ref)`);
    
    // Log point information for this character for debugging
    const currentStatePoints = state.charPoints[currentChar] || 0;
    const currentLocalPoints = localCharPointsRef.current[currentChar] || 0;
    console.log(`Current character "${currentChar}" points - state: ${currentStatePoints}, local: ${currentLocalPoints}`);
    
    // Return a promise that resolves immediately to match TrainingMode's flow
    return Promise.resolve();
  }, [pickNextChar, verifyAndFixCharacterSet, state.charPoints, state.selectedLevelId, currentChar]);
  
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
    
    // Calculate response time - use the ref value for reliability
    const responseTime = charStartTimeRef.current ? (Date.now() - charStartTimeRef.current) : 0;
    console.log(`Response time calculation: ${Date.now()} - ${charStartTimeRef.current} = ${responseTime}ms`);
    
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
      
      // Always also check our local points record as a backup
      const localPoints = localCharPointsRef.current[successChar] || 0;
      const effectiveCurrentPoints = Math.max(currentPoints, localPoints);
      
      // If there's a mismatch, log a warning
      if (currentPoints !== localPoints) {
        console.warn(`⚠️ Point mismatch for "${successChar}": state=${currentPoints}, local=${localPoints}. Using ${effectiveCurrentPoints}.`);
      }
      
      const newPoints = effectiveCurrentPoints + points;
      
      console.log(`[POINTS DEBUG] Updating points for ${successChar}:`);
      console.log(`  - Current points from state: ${currentPoints}`);
      console.log(`  - Current points from local: ${localPoints}`);
      console.log(`  - Using effective points: ${effectiveCurrentPoints}`);
      console.log(`  - Points being added: ${points}`);
      console.log(`  - New total points: ${newPoints}`);
      
      // Check if character will reach mastery with this addition
      const willCompleteMastery = newPoints >= TARGET_POINTS && effectiveCurrentPoints < TARGET_POINTS;
      
      // If this character will now be mastered, track it to avoid immediate reselection
      if (willCompleteMastery) {
        recentlyMasteredCharRef.current = successChar;
      }
      
      console.log(`🔢 CALLING updateCharPoints for "${successChar}":`);
      console.log(`  - Before: state.charPoints["${successChar}"] = ${state.charPoints[successChar] || 0}`);
      console.log(`  - Setting to: ${newPoints}`);
      
      // Update our local state
      localCharPointsRef.current[successChar] = newPoints;
      
      // Call the context function
      updateCharPoints(successChar, newPoints);
      
      // Log immediately after (though state won't update immediately)
      console.log(`  - After call: state.charPoints["${successChar}"] = ${state.charPoints[successChar] || 0}`);
      console.log(`  - Local tracking: localCharPointsRef.current["${successChar}"] = ${localCharPointsRef.current[successChar]}`);
      
      console.log(`Character ${successChar} updated: ${effectiveCurrentPoints} → ${newPoints} points (${points} added, response time: ${(responseTime / 1000).toFixed(2)}s)`);
      
      // Delay before next question or finishing - like TrainingMode
      setTimeout(() => {
        // Get the current level definition for accurate character list
        const currentLevelDef = trainingLevels.find(level => level.id === state.selectedLevelId);
        if (!currentLevelDef) {
          console.error(`SendingMode: Couldn't find level with ID: ${state.selectedLevelId} for completion check`);
          nextQuestion();
          return;
        }

        // CRITICAL FIX: Double-check that we're using the correct level
        console.log(`🔍 LEVEL VERIFICATION FOR COMPLETION CHECK:`);
        console.log(`- Selected level ID: ${state.selectedLevelId}`);
        console.log(`- Level found: ${currentLevelDef.id} (${currentLevelDef.name})`);
        
        // Ensure we're using the correct level - use the CURRENT level ID from state
        const verifiedLevelDef = trainingLevels.find(level => level.id === state.selectedLevelId);
        if (!verifiedLevelDef) {
          console.error(`CRITICAL ERROR: Could not find current level with ID ${state.selectedLevelId}`);
          nextQuestion();
          return;
        }
        
        // ALWAYS use the verified level definition from here
        const levelChars = verifiedLevelDef.chars;
        console.log(`- Using verified level chars: ${levelChars.join(', ')}`);

        // Create a simulated updated charPoints object that includes the most recent update
        const updatedCharPoints = { ...state.charPoints, [successChar]: newPoints };
        
        // Also create a merged points object that takes the maximum of state and local values
        const mergedPoints = { ...updatedCharPoints };
        Object.entries(localCharPointsRef.current).forEach(([char, points]) => {
          mergedPoints[char] = Math.max(mergedPoints[char] || 0, points);
        });
        
        // Debug point tracking ONLY for characters in THIS level
        console.log('🧮 Mastery points for completion check:');
        levelChars.forEach(char => {
          const statePoints = updatedCharPoints[char] || 0;
          const localPoints = localCharPointsRef.current[char] || 0;
          const mergedValue = mergedPoints[char] || 0;
          const isMastered = mergedValue >= TARGET_POINTS;
          console.log(`  - ${char}: ${statePoints}/${TARGET_POINTS} (state), ${localPoints}/${TARGET_POINTS} (local), ${mergedValue}/${TARGET_POINTS} (merged) ${isMastered ? '✅' : '❌'}`);
        });
        
        // Check if all characters are mastered using the merged points
        const allMastered = levelChars.every(c => {
          const points = mergedPoints[c] || 0;
          const isMastered = points >= TARGET_POINTS;
          return isMastered;
        });
        
        // Check if only partial mastery (old Level 1 chars are mastered, but new Level 2 chars are not)
        const oldChars = ['e', 't']; // Level 1 characters
        const newChars = levelChars.filter(c => !oldChars.includes(c)); // New characters in this level
        
        const oldCharsMastered = oldChars.every(c => {
          if (!levelChars.includes(c)) return true; // Skip if not in this level
          const points = mergedPoints[c] || 0;
          return points >= TARGET_POINTS;
        });
        
        const newCharsMastered = newChars.every(c => {
          const points = mergedPoints[c] || 0;
          return points >= TARGET_POINTS;
        });
        
        const newCharsAttempted = newChars.some(c => {
          return (mergedPoints[c] || 0) > 0;
        });
        
        console.log('Completion check:', { 
          levelId: state.selectedLevelId,
          levelName: currentLevelDef.name,
          levelChars,
          oldChars,
          newChars,
          oldCharsMastered,
          newCharsMastered,
          newCharsAttempted,
          statePointsSource: 'AppState',
          localPointsSource: 'LocalRef',
          mergedPoints,
          allMastered
        });
        
        // NEVER end the test unless all characters have been mastered
        // Also ensure at least one new character has been attempted before finishing
        if (allMastered) {
          console.log(`✅ Level complete - all ${levelChars.length} characters are mastered`);
          finishTest(true);
        } else if (oldCharsMastered && !newCharsAttempted) {
          console.log(`⚠️ Only old characters mastered but new characters not yet attempted - forcing new character selection`);
          
          // Force selection of a new character by skipping the next question
          // Temporarily set recentlyMasteredCharRef to all old characters to force new char selection
          const oldMastered = oldChars.filter(c => levelChars.includes(c));
          if (oldMastered.length > 0 && newChars.length > 0) {
            // Store the original recently mastered char
            const originalRecentlyMastered = recentlyMasteredCharRef.current;
            
            // Force select a new character from the level
            const forceChar = newChars[0];
            console.log(`🔄 Forcing selection of new character: "${forceChar}" for next question`);
            
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
            
            // Restore the original recently mastered character after forcing selection
            setTimeout(() => {
              recentlyMasteredCharRef.current = originalRecentlyMastered;
            }, 100);
          } else {
            // If we can't force selection, just continue with normal flow
            nextQuestion();
          }
        } else {
          console.log(`⏳ Continuing test - not all characters mastered yet`);
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
      const localPoints = localCharPointsRef.current[currentChar] || 0;
      const effectiveCurrentPoints = Math.max(currentPoints, localPoints);
      
      // Calculate the new, reduced point value
      const newPoints = Math.max(0, effectiveCurrentPoints * INCORRECT_PENALTY);
      
      console.log(`🔻 Reducing points for "${currentChar}":`);
      console.log(`  - Current points from state: ${currentPoints}`);
      console.log(`  - Current points from local: ${localPoints}`);
      console.log(`  - Using effective points: ${effectiveCurrentPoints}`);
      console.log(`  - Multiplier: ${INCORRECT_PENALTY}`);
      console.log(`  - New total points: ${newPoints}`);
      
      // Update our local tracking
      localCharPointsRef.current[currentChar] = newPoints;
      
      // Update the app state
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
    charStartTimeRef,
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
    
    // Reset local character points to prevent carryover between tests
    localCharPointsRef.current = {};
    
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
    
    // Reset local character points to prevent carryover between levels
    localCharPointsRef.current = {};
    
    // Clear any pending keyer state
    keyerRef.current.clear();
    
    // IMPORTANT: First explicitly select the level to ensure characters are loaded correctly
    console.log(`🔑 Explicitly selecting level ${levelId} before starting test`);
    handleLevelSelection(levelId);
    
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
      }, 50);
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
    
    // Log current character points before moving
    console.log("🔢 Current character points before level change:");
    const pointsArray = Object.entries(state.charPoints);
    pointsArray.forEach(([char, points]) => {
      console.log(`  - ${char}: ${points}`);
    });
    
    // Reset state
    setCurrentChar('');
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    setResponseTimes([]);
    setMistakesMap({});
    
    // Reset local character points to prevent carryover between levels
    localCharPointsRef.current = {};
    
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
      console.log(" Starting test with explicit level ID:", nextLevel.id);
      
      // Set the test start time
      const now = Date.now();
      setTestStartTime(now);
      console.log(`Setting test start time for next level: ${now}`);
      
      // Following TrainingMode's approach: First select the level, then start test
      console.log("🔑 First selecting level:", nextLevel.id);
      handleLevelSelection(nextLevel.id);
      
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
  
  // Function to copy debug state to clipboard
  const copyDebugStateToClipboard = useCallback(() => {
    // Gather all the debug information
    const debugInfo = {
      timestamp: new Date().toISOString(),
      currentLevel: {
        id: state.selectedLevelId,
        name: currentLevel?.name || 'Unknown',
        levelChars: currentLevel?.chars || [],
        type: currentLevel?.type || 'unknown'
      },
      testStatus: {
        active: state.testActive,
        testStartTime: testStartTime ? new Date(testStartTime).toISOString() : null,
        currentChar: currentChar,
        currentCharRef: currentCharRef.current,
        recentlyMasteredChar: recentlyMasteredCharRef.current,
        responseTimes: responseTimes,
        mistakesCount: Object.keys(mistakesMap).length
      },
      appState: {
        chars: state.chars,
        charPoints: state.charPoints
      },
      localState: {
        charPoints: localCharPointsRef.current
      },
      masteryStatus: {
        levelChars: currentLevel?.chars || [],
        masteryPoints: currentLevel?.chars.map(c => ({
          char: c,
          statePoints: state.charPoints[c] || 0,
          localPoints: localCharPointsRef.current[c] || 0,
          effectivePoints: Math.max(state.charPoints[c] || 0, localCharPointsRef.current[c] || 0),
          isMastered: Math.max(state.charPoints[c] || 0, localCharPointsRef.current[c] || 0) >= TARGET_POINTS
        })) || [],
        allMastered: currentLevel?.chars.every(c => 
          Math.max(state.charPoints[c] || 0, localCharPointsRef.current[c] || 0) >= TARGET_POINTS
        ) || false
      }
    };
    
    // Format as JSON with pretty printing
    const debugText = JSON.stringify(debugInfo, null, 2);
    
    // Create a text block with markdown formatting
    const clipboardText = `\`\`\`json\n${debugText}\n\`\`\``;
    
    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(clipboardText)
        .then(() => {
          // Show visual confirmation
          setCopyStatus('copied');
          // Reset after a delay
          setTimeout(() => setCopyStatus('idle'), 2000);
        })
        .catch(err => {
          console.error('Failed to copy debug state:', err);
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
        });
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = clipboardText;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopyStatus('copied');
          setTimeout(() => setCopyStatus('idle'), 2000);
        } else {
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
        }
      } catch (err: unknown) {
        console.error('Failed to copy debug state:', err);
        setCopyStatus('error');
        setTimeout(() => setCopyStatus('idle'), 2000);
      }
      
      document.body.removeChild(textArea);
    }
  }, [
    state.selectedLevelId,
    state.testActive,
    state.chars,
    state.charPoints,
    currentLevel,
    testStartTime,
    currentChar,
    currentCharRef,
    recentlyMasteredCharRef,
    responseTimes,
    mistakesMap,
    localCharPointsRef
  ]);
  
  // State for copy button status
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  
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
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid #666'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '5px', 
            borderBottom: '1px solid #555', 
            paddingBottom: '5px'
          }}>
            <div style={{fontWeight: 'bold', fontSize: '14px'}}>
              COMPLETE STATE DIAGNOSTICS
            </div>
            <div 
              onClick={copyDebugStateToClipboard}
              style={{
                fontSize: '16px',
                cursor: 'pointer',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                background: copyStatus === 'idle' ? 'transparent' : 
                           copyStatus === 'copied' ? 'rgba(0,80,0,0.5)' : 
                           'rgba(80,0,0,0.5)',
                transition: 'background-color 0.2s'
              }}
              title="Copy debug data to clipboard"
            >
              {copyStatus === 'idle' && (
                <span style={{opacity: 0.8}}>📋</span>
              )}
              {copyStatus === 'copied' && (
                <span style={{color: '#5f5', fontWeight: 'bold'}}>✓</span>
              )}
              {copyStatus === 'error' && (
                <span style={{color: '#f55'}}>✗</span>
              )}
            </div>
          </div>
          
          {/* Current Level Information - Highlighted at top */}
          <div style={{
            marginBottom: '10px',
            padding: '5px',
            backgroundColor: 'rgba(100,100,0,0.3)',
            border: '1px solid #aa8',
            borderRadius: '4px'
          }}>
            <div style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '4px'}}>
              CURRENT LEVEL STATUS
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <div>
                <span style={{color: '#ffb'}}>{currentLevel?.name || 'Unknown Level'}</span> 
                (<span style={{color: '#ffb'}}>{state.selectedLevelId}</span>)
              </div>
              <div>
                Test Active: <span style={{color: state.testActive ? '#8f8' : '#f88'}}>{state.testActive ? 'YES' : 'NO'}</span>
              </div>
            </div>
            <div style={{marginTop: '3px'}}>
              <div>Level Characters: <span style={{color: '#ffb'}}>{currentLevel?.chars.join(', ')}</span></div>
              <div>AppState Characters: <span style={{color: '#ffb'}}>{state.chars.join(', ')}</span></div>
            </div>
            <div style={{marginTop: '3px'}}>
              <div>
                Mastery: {(state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length)} of {state.chars.length} characters mastered
              </div>
            </div>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {/* Level Completion Tracker */}
            <div style={{
              border: '1px solid #444', 
              padding: '5px', 
              backgroundColor: 'rgba(0,100,100,0.2)'
            }}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>
                Level Completion Status
              </div>
              <div>
                <div>Last Checked: <span style={{color: '#8ff'}}>
                  {Object.keys(localCharPointsRef.current).length > 0 ? 'Yes' : 'Not yet'}
                </span></div>
                <div style={{marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px'}}>
                  {currentLevel && currentLevel.chars.map(char => {
                    const statePoints = state.charPoints[char] || 0;
                    const localPoints = localCharPointsRef.current[char] || 0;
                    const effectivePoints = Math.max(statePoints, localPoints);
                    const isMastered = effectivePoints >= TARGET_POINTS;
                    return (
                      <div key={char} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '1px 3px',
                        backgroundColor: isMastered ? 'rgba(0,50,0,0.3)' : 'rgba(50,0,0,0.3)',
                        borderRadius: '2px'
                      }}>
                        <div>Character: <span style={{color: '#8ff'}}>{char}</span></div>
                        <div>
                          <span style={{color: isMastered ? '#8f8' : '#f88'}}>
                            {effectivePoints.toFixed(2)}/{TARGET_POINTS}
                          </span>
                          <span style={{marginLeft: '5px'}}>
                            {isMastered ? '✅' : '❌'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop: '5px', borderTop: '1px solid #444', paddingTop: '3px'}}>
                  <div>
                    All Mastered: <span style={{
                      color: currentLevel && currentLevel.chars.every(c => 
                        Math.max(state.charPoints[c] || 0, localCharPointsRef.current[c] || 0) >= TARGET_POINTS
                      ) ? '#8f8' : '#f88'
                    }}>
                      {currentLevel && currentLevel.chars.every(c => 
                        Math.max(state.charPoints[c] || 0, localCharPointsRef.current[c] || 0) >= TARGET_POINTS
                      ) ? 'YES' : 'NO'}
                    </span>
                  </div>
                  
                  {/* Level completion indicator */}
                  {currentLevel && currentLevel.chars.every(c => 
                    Math.max(state.charPoints[c] || 0, localCharPointsRef.current[c] || 0) >= TARGET_POINTS
                  ) && (
                    <div style={{
                      marginTop: '5px',
                      padding: '4px',
                      background: 'rgba(0,100,0,0.5)',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      color: '#5f5',
                      textAlign: 'center'
                    }}>
                      🏆 LEVEL COMPLETED 🏆
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* New section for character selection */}
            <div style={{
              border: '1px solid #444', 
              padding: '5px', 
              backgroundColor: 'rgba(100,50,0,0.2)',
              marginTop: '10px'
            }}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>
                Character Selection Pool
              </div>
              <div>
                <div>Recently Mastered: <span style={{color: '#ffaa66'}}>{recentlyMasteredCharRef.current || 'None'}</span></div>
                <div style={{marginTop: '5px'}}>
                  <div style={{fontWeight: 'bold'}}>Character Selection Status:</div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px'}}>
                    {currentLevel && currentLevel.chars.map(char => {
                      const statePoints = state.charPoints[char] || 0;
                      const localPoints = localCharPointsRef.current[char] || 0;
                      const effectivePoints = Math.max(statePoints, localPoints);
                      const isMastered = effectivePoints >= TARGET_POINTS;
                      const isRecentlyMastered = char === recentlyMasteredCharRef.current;
                      
                      let selectionStatus = '';
                      let statusColor = '#fff';
                      
                      if (isRecentlyMastered) {
                        selectionStatus = 'SKIPPED (recently mastered)';
                        statusColor = '#ff8';
                      } else if (isMastered) {
                        selectionStatus = `REDUCED CHANCE (${(COMPLETED_WEIGHT * 100).toFixed(0)}%)`;
                        statusColor = '#8f8';
                      } else {
                        selectionStatus = 'PRIORITIZED';
                        statusColor = '#f88';
                      }
                      
                      return (
                        <div key={char} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '1px 3px',
                          backgroundColor: isRecentlyMastered ? 'rgba(80,80,0,0.3)' : 
                                         isMastered ? 'rgba(0,50,0,0.3)' : 'rgba(50,0,0,0.3)',
                          borderRadius: '2px'
                        }}>
                          <div>
                            <span style={{color: char === currentChar ? '#ff5' : '#fff'}}>{char}</span>
                            {char === currentChar && <span style={{marginLeft: '5px', color: '#ff5'}}>← CURRENT</span>}
                          </div>
                          <div style={{color: statusColor}}>
                            {selectionStatus}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{marginTop: '5px', fontSize: '11px', fontStyle: 'italic', color: '#ccc'}}>
                  Characters with higher point values are less likely to be selected. 
                  Recently mastered characters are temporarily excluded.
                </div>
              </div>
            </div>
            
            <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(0,50,0,0.2)'}}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>AppState Context</div>
              <div>Level ID: <span style={{color: '#8fff8f'}}>{state.selectedLevelId}</span></div>
              <div>Level Name: <span style={{color: '#8fff8f'}}>{currentLevel?.name || 'Unknown'}</span></div>
              <div>Test Active: <span style={{color: '#8fff8f'}}>{state.testActive ? 'Yes' : 'No'}</span></div>
              <div style={{marginTop: '5px'}}>
                <div style={{fontWeight: 'bold'}}>Chars from AppState:</div>
                <div style={{color: '#8fff8f'}}>{state.chars.join(', ')}</div>
              </div>
              <div style={{marginTop: '5px'}}>
                <div style={{fontWeight: 'bold'}}>Points from AppState:</div>
                <div>
                  {Object.entries(state.charPoints).length > 0 ? (
                    <table style={{borderCollapse: 'collapse', width: '100%'}}>
                      <thead>
                        <tr>
                          <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                          <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Points</th>
                          <th style={{textAlign: 'center', padding: '2px', borderBottom: '1px solid #444'}}>Mastered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(state.charPoints).map(([char, points]) => (
                          <tr key={char}>
                            <td style={{padding: '1px'}}>{char}</td>
                            <td style={{textAlign: 'right', padding: '1px'}}>{points.toFixed(2)}</td>
                            <td style={{textAlign: 'center', padding: '1px'}}>{points >= TARGET_POINTS ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <span style={{color: '#aaa', fontStyle: 'italic'}}>No points recorded</span>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(0,50,0,0.2)'}}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>Local Component State</div>
              <div>Current Char: <span style={{color: '#ff8f8f'}}>{currentChar || '(none)'}</span></div>
              <div>Current Char Ref: <span style={{color: '#ff8f8f'}}>{currentCharRef.current || '(none)'}</span></div>
              <div>Feedback State: <span style={{color: '#ff8f8f'}}>{feedbackState}</span></div>
              <div>Test Start Time: <span style={{color: '#ff8f8f'}}>{testStartTime ? new Date(testStartTime).toISOString() : 'Not started'}</span></div>
              <div>Char Start Time: <span style={{color: '#ff8f8f'}}>{charStartTime ? new Date(charStartTime).toISOString() : 'Not started'}</span></div>
              <div>Char Start Time Ref: <span style={{color: '#ff8f8f'}}>{charStartTimeRef.current ? new Date(charStartTimeRef.current).toISOString() : 'Not set'}</span></div>
              <div>Recently Mastered: <span style={{color: '#ff8f8f'}}>{recentlyMasteredCharRef.current || 'None'}</span></div>
              <div>Response Times: <span style={{color: '#ff8f8f'}}>{responseTimes.length} records</span></div>
              
              <div style={{marginTop: '5px'}}>
                <div style={{fontWeight: 'bold'}}>Local Points Tracking:</div>
                <div>
                  {Object.keys(localCharPointsRef.current).length > 0 ? (
                    <table style={{borderCollapse: 'collapse', width: '100%'}}>
                      <thead>
                        <tr>
                          <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                          <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Local</th>
                          <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>AppState</th>
                          <th style={{textAlign: 'center', padding: '2px', borderBottom: '1px solid #444'}}>Match?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(localCharPointsRef.current).map(([char, points]) => {
                          const appPoints = state.charPoints[char] || 0;
                          const match = Math.abs(points - appPoints) < 0.001; // Float comparison
                          return (
                            <tr key={char}>
                              <td style={{padding: '1px'}}>{char}</td>
                              <td style={{textAlign: 'right', padding: '1px'}}>{points.toFixed(2)}</td>
                              <td style={{textAlign: 'right', padding: '1px'}}>{appPoints.toFixed(2)}</td>
                              <td style={{textAlign: 'center', padding: '1px', color: match ? 'green' : 'red'}}>{match ? '✓' : '✗'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <span style={{color: '#aaa', fontStyle: 'italic'}}>No local points recorded</span>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(0,0,50,0.2)'}}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>Response History</div>
              <div>
                {responseTimes.length > 0 ? (
                  <table style={{borderCollapse: 'collapse', width: '100%'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>#</th>
                        <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                        <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Time (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responseTimes.map((rt, idx) => (
                        <tr key={idx}>
                          <td style={{padding: '1px'}}>{idx + 1}</td>
                          <td style={{padding: '1px'}}>{rt.char}</td>
                          <td style={{textAlign: 'right', padding: '1px'}}>{rt.time.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span style={{color: '#aaa', fontStyle: 'italic'}}>No responses recorded</span>
                )}
              </div>
            </div>
            
            <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(50,50,0,0.2)'}}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>Level Definition</div>
              {currentLevel ? (
                <>
                  <div>ID: <span style={{color: '#ffff8f'}}>{currentLevel.id}</span></div>
                  <div>Name: <span style={{color: '#ffff8f'}}>{currentLevel.name}</span></div>
                  <div>Type: <span style={{color: '#ffff8f'}}>{currentLevel.type}</span></div>
                  <div>Chars from level definition: <span style={{color: '#ffff8f'}}>{currentLevel.chars.join(', ')}</span></div>
                  {isCheckpoint && (
                    <div>Strike Limit: <span style={{color: '#ffff8f'}}>{strikeLimit}</span></div>
                  )}
                </>
              ) : (
                <span style={{color: '#aaa', fontStyle: 'italic'}}>No level definition found</span>
              )}
            </div>
            
            {/* Mismatch detection */}
            {currentLevel && (
              (() => {
                const levelChars = currentLevel.chars;
                const stateChars = state.chars;
                const sameLength = levelChars.length === stateChars.length;
                const allPresent = levelChars.every(c => stateChars.includes(c));
                const noExtras = stateChars.every(c => levelChars.includes(c));
                const match = sameLength && allPresent && noExtras;
                
                if (!match) {
                  return (
                    <div style={{
                      border: '2px solid #f00', 
                      padding: '5px', 
                      backgroundColor: 'rgba(100,0,0,0.5)',
                      marginTop: '10px',
                      color: '#faa'
                    }}>
                      <div style={{fontWeight: 'bold', color: '#f55'}}>⚠️ CHARACTER MISMATCH DETECTED!</div>
                      <div>Level chars: {levelChars.join(', ')}</div>
                      <div>State chars: {stateChars.join(', ')}</div>
                      <div>Same length: {sameLength ? 'Yes' : 'No'}</div>
                      <div>All present: {allPresent ? 'Yes' : 'No'}</div>
                      <div>No extras: {noExtras ? 'Yes' : 'No'}</div>
                      <div style={{marginTop: '5px', fontStyle: 'italic', color: '#fcc'}}>
                        This indicates a state synchronization problem
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}
            
            <div style={{marginTop: '10px', border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(50,0,50,0.2)'}}>
              <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>
                Complete Character Tracking
              </div>
              <div>
                <table style={{borderCollapse: 'collapse', width: '100%'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                      <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Local Points</th>
                      <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>AppState Points</th>
                      <th style={{textAlign: 'center', padding: '2px', borderBottom: '1px solid #444'}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLevel && currentLevel.chars.map(char => {
                      const localPoints = localCharPointsRef.current[char] || 0;
                      const appPoints = state.charPoints[char] || 0;
                      const effectivePoints = Math.max(localPoints, appPoints);
                      const isMastered = effectivePoints >= TARGET_POINTS;
                      const isAttempted = effectivePoints > 0;
                      
                      return (
                        <tr key={char} style={{
                          backgroundColor: char === currentChar ? 'rgba(255,255,0,0.15)' : 'transparent'
                        }}>
                          <td style={{padding: '1px', fontWeight: char === currentChar ? 'bold' : 'normal'}}>
                            {char}{char === currentChar ? ' ←' : ''}
                          </td>
                          <td style={{textAlign: 'right', padding: '1px'}}>{localPoints.toFixed(2)}</td>
                          <td style={{textAlign: 'right', padding: '1px'}}>{appPoints.toFixed(2)}</td>
                          <td style={{textAlign: 'center', padding: '1px'}}>
                            {!isAttempted && (
                              <span style={{color: '#aaa'}}>Not attempted</span>
                            )}
                            {isAttempted && !isMastered && (
                              <span style={{color: '#f88'}}>In progress</span>
                            )}
                            {isMastered && (
                              <span style={{color: '#8f8'}}>Mastered ✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop: '5px', fontSize: '11px', color: '#ccc'}}>
                Shows all characters in the current level regardless of whether they've been attempted.
              </div>
            </div>
            
            {/* Character Picker Debug Widget */}
            <div style={{
              marginTop: '15px', 
              border: '2px solid #f00', 
              padding: '5px', 
              backgroundColor: 'rgba(80,0,0,0.3)'
            }}>
              <div style={{
                fontWeight: 'bold', 
                marginBottom: '2px', 
                borderBottom: '1px solid #f88', 
                paddingBottom: '2px', 
                color: '#f88'
              }}>
                🔍 CHARACTER SELECTION DEBUG
              </div>
              
              {lastPickerInputs ? (
                <div>
                  <div style={{marginBottom: '5px'}}>
                    <div><strong>Last Character Selection:</strong></div>
                    <div>Level: <span style={{color: '#f88'}}>{lastPickerInputs.levelName} ({lastPickerInputs.levelId})</span></div>
                    <div>Current Char: <span style={{color: '#f88'}}>{currentChar || '(none)'}</span></div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '5px',
                    padding: '4px',
                    backgroundColor: 'rgba(50,0,0,0.4)',
                    borderRadius: '3px'
                  }}>
                    <div>
                      <div><strong>⚠️ Level Chars Used:</strong></div>
                      <div style={{color: '#f88'}}>{lastPickerInputs.levelChars.join(', ')}</div>
                    </div>
                    <div>
                      <div><strong>⚠️ State Chars:</strong></div>
                      <div style={{color: '#f88'}}>{lastPickerInputs.stateChars.join(', ')}</div>
                    </div>
                  </div>
                  
                  <div style={{marginBottom: '5px'}}>
                    <div><strong>Recently Mastered:</strong> <span style={{color: '#f88'}}>{lastPickerInputs.recentlyMasteredChar || 'None'}</span></div>
                  </div>
                  
                  <div>
                    <div><strong>Character Point Snapshot:</strong></div>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr>
                          <th style={{textAlign: 'left', borderBottom: '1px solid #666'}}>Char</th>
                          <th style={{textAlign: 'right', borderBottom: '1px solid #666'}}>Points</th>
                          <th style={{textAlign: 'center', borderBottom: '1px solid #666'}}>In Level?</th>
                          <th style={{textAlign: 'center', borderBottom: '1px solid #666'}}>In State?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(lastPickerInputs.pointsSnapshot).map(([char, points]) => {
                          const inLevel = lastPickerInputs.levelChars.includes(char);
                          const inState = lastPickerInputs.stateChars.includes(char);
                          const isCurrent = char === currentChar;
                          
                          return (
                            <tr key={char} style={{
                              backgroundColor: isCurrent ? 'rgba(80,80,0,0.3)' : 'transparent',
                              color: isCurrent ? '#ff0' : (inLevel ? '#fff' : '#a55')
                            }}>
                              <td style={{padding: '1px'}}>{char} {isCurrent && '←'}</td>
                              <td style={{textAlign: 'right', padding: '1px'}}>{points.toFixed(2)}</td>
                              <td style={{textAlign: 'center', padding: '1px', color: inLevel ? '#8f8' : '#f55'}}>
                                {inLevel ? '✓' : '✗'}
                              </td>
                              <td style={{textAlign: 'center', padding: '1px', color: inState ? '#8f8' : '#f55'}}>
                                {inState ? '✓' : '✗'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div style={{marginTop: '8px', padding: '3px', backgroundColor: 'rgba(80,0,0,0.5)', borderRadius: '3px'}}>
                    <div style={{color: '#f55', fontWeight: 'bold'}}>CHARACTER MISMATCH DETECTION:</div>
                    <div>
                      {lastPickerInputs.levelChars.join(',') !== lastPickerInputs.stateChars.join(',') ? (
                        <div style={{color: '#f55'}}>
                          ⚠️ <strong>MISMATCH DETECTED:</strong> Level chars and State chars are different!
                        </div>
                      ) : (
                        <div style={{color: '#8f8'}}>
                          Level chars and State chars match correctly.
                        </div>
                      )}
                    </div>
                    {lastPickerInputs.stateChars.some(c => !lastPickerInputs.levelChars.includes(c)) && (
                      <div style={{color: '#f55', marginTop: '3px'}}>
                        Found characters in State that don't belong in current level: 
                        <strong>{lastPickerInputs.stateChars.filter(c => !lastPickerInputs.levelChars.includes(c)).join(', ')}</strong>
                      </div>
                    )}
                    {currentChar && !lastPickerInputs.levelChars.includes(currentChar) && (
                      <div style={{color: '#f00', marginTop: '3px', fontWeight: 'bold'}}>
                        🚨 CRITICAL: Current char "{currentChar}" is not in level chars!
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{color: '#aaa', fontStyle: 'italic'}}>No character selection recorded yet</div>
              )}
            </div>
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