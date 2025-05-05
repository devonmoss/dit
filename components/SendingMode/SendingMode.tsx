import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SendingMode.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { isBrowser } from '../../utils/morse';
import MasteryDisplay from '../MasteryDisplay/MasteryDisplay';
import TestResultsSummary from '../TestResultsSummary/TestResultsSummary';
import { trainingLevels } from '../../utils/levels';
import { useIambicKeyer } from '../../hooks/useIambicKeyer';

// Constants
const TARGET_POINTS = 3;
const COMPLETED_WEIGHT = 0.2;
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
  // App state
  const { state, startTest, endTest, updateCharPoints, saveResponseTimes, selectLevel } = useAppState();
  
  // UI state
  const [sendCurrentChar, setSendCurrentChar] = useState('');
  const [morseOutput, setMorseOutput] = useState('');
  const [feedbackState, setFeedbackState] = useState<'none' | 'correct' | 'incorrect'>('none');
  const [incorrectChar, setIncorrectChar] = useState('');
  const [sendingActive, setSendingActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [levelProgress, setLevelProgress] = useState('');
  
  // Performance tracking
  const [responseTimes, setResponseTimes] = useState<CharTiming[]>([]);
  const [mistakesMap, setMistakesMap] = useState<Record<string, number>>({});
  const [strikeCount, setStrikeCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completed, setCompleted] = useState(true);
  const [testResults, setTestResults] = useState('');
  
  // Timing refs
  const charStartTimeRef = useRef<number>(0);
  const testStartTimeRef = useRef<number>(0);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  // Component state
  const activeRef = useRef(false);
  const currentCharRef = useRef('');
  
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
      
      setTimeout(() => {
        stopSound();
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = 0.5;
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
  
  // Pick next character to practice
  const pickNextChar = useCallback(() => {
    if (!state.chars.length) return '';
    
    const pool = state.chars.map(char => {
      const points = state.charPoints[char] || 0;
      const weight = points >= TARGET_POINTS ? COMPLETED_WEIGHT : 1;
      return { char, weight };
    });
    
    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * totalWeight;
    
    for (const p of pool) {
      if (r < p.weight) return p.char;
      r -= p.weight;
    }
    
    return pool[pool.length - 1].char;
  }, [state.chars, state.charPoints]);
  
  // Show next character
  const showNextChar = useCallback(() => {
    if (!activeRef.current) {
      console.log(`SendingMode: showNextChar called but activeRef is false - ignoring`);
      return;
    }
    
    const nextChar = pickNextChar();
    console.log(`SendingMode: Showing next character: "${nextChar}" (activeRef: true)`);
    
    // Update both the state and the ref
    setSendCurrentChar(nextChar);
    currentCharRef.current = nextChar;
    
    setMorseOutput('');
    setFeedbackState('none');
    
    // Set the start time for response time tracking
    charStartTimeRef.current = Date.now();
  }, [pickNextChar]);
  
  // Handle an element (dot/dash) from the keyer
  const handleElement = useCallback((symbol: '.' | '-') => {
    if (!activeRef.current) {
      console.log(`SendingMode: Element ${symbol} detected but activeRef is false - ignoring`);
      return;
    }
    
    setMorseOutput(prev => prev + symbol);
  }, []);
  
  // Finish test
  const finishTest = useCallback((isCompleted = true) => {
    console.log(`SendingMode: Finishing test, completed: ${isCompleted}, current state: sendingActive=${sendingActive}`);
    
    // Set active ref to false immediately - this affects callbacks
    activeRef.current = false;
    currentCharRef.current = '';  // Clear current character ref
    
    // Ensure we only process this once
    if (!sendingActive) {
      console.log(`SendingMode: finishTest called but sendingActive is already false - ignoring`);
      return;
    }
    
    // Update UI state
    setSendingActive(false);
    setCompleted(isCompleted);
    
    // Calculate elapsed time
    const endTime = Date.now();
    const totalTime = (endTime - testStartTimeRef.current) / 1000;
    setElapsedTime(totalTime);
    
    // Save response times
    if (responseTimes.length > 0) {
      console.log(`SendingMode: Saving ${responseTimes.length} response times`);
      saveResponseTimes(responseTimes);
    }
    
    // End app test
    endTest(isCompleted);
    
    // Create results summary
    const masteredCount = state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length;
    const totalCount = state.chars.length;
    const avgTime = responseTimes.length > 0 
      ? (responseTimes.reduce((sum, item) => sum + item.time, 0) / responseTimes.length).toFixed(2)
      : '0';
    
    const results = `You've mastered ${masteredCount}/${totalCount} characters. Average response time: ${avgTime}s`;
    console.log(`SendingMode: Test results: ${results}`);
    setTestResults(results);
    
    // Show results
    setShowResults(true);
  }, [state.chars, responseTimes, saveResponseTimes, endTest, sendingActive]);
  
  // Handle a character from the keyer
  const handleCharacter = useCallback((char: string) => {
    // Use the ref to check if we're active - this will always be current
    console.log(`SendingMode: Character detected "${char}" - activeRef: ${activeRef.current}, currentChar: ${currentCharRef.current || '(empty)'}`);
    
    if (!activeRef.current) {
      console.log(`SendingMode: Character detected but ignored - activeRef is false`);
      return;
    }
    
    if (!currentCharRef.current) {
      console.log(`SendingMode: Character detected but ignored - no current character to match against`);
      return;
    }
    
    console.log(`SendingMode: Keyer decoded: "${char}", target: "${currentCharRef.current}"`);
    console.log(`SendingMode: Comparing ${char.toLowerCase()} === ${currentCharRef.current.toLowerCase()}: ${char.toLowerCase() === currentCharRef.current.toLowerCase()}`);
    
    // Calculate response time
    const responseTime = Date.now() - charStartTimeRef.current;
    
    // Check if character matches
    if (char.toLowerCase() === currentCharRef.current.toLowerCase()) {
      console.log(`SendingMode: CORRECT match - "${char}" matches "${currentCharRef.current}"`);
      // Correct character!
      setFeedbackState('correct');
      
      // Calculate points based on response time
      const points = calculatePointsForTime(responseTime);
      console.log(`SendingMode: Awarding ${points.toFixed(2)} points for response time: ${responseTime}ms`);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: currentCharRef.current, time: responseTime / 1000 }]);
      
      // Update character points
      const currentPoints = state.charPoints[currentCharRef.current] || 0;
      const newPoints = currentPoints + points;
      updateCharPoints(currentCharRef.current, newPoints);
      
      // Check if this completes mastery
      const willComplete = newPoints >= TARGET_POINTS;
      const othersMastered = state.chars
        .filter(c => c !== currentCharRef.current)
        .every(c => (state.charPoints[c] || 0) >= TARGET_POINTS);
      
      if (willComplete && othersMastered) {
        // Level complete!
        console.log(`SendingMode: Level complete! All characters mastered.`);
        setTimeout(() => finishTest(true), 750);
        return;
      }
      
      // Show next character after delay
      console.log(`SendingMode: Correct match - showing next character in 750ms`);
      setTimeout(() => {
        setFeedbackState('none');
        showNextChar();
      }, 750);
    } else {
      // Incorrect character
      console.log(`SendingMode: INCORRECT match - "${char}" does not match "${currentCharRef.current}"`);
      setFeedbackState('incorrect');
      setIncorrectChar(char);
      
      // Update mistakes map
      setMistakesMap(prev => {
        const count = prev[currentCharRef.current] || 0;
        console.log(`SendingMode: Increasing mistake count for "${currentCharRef.current}" from ${count} to ${count + 1}`);
        return { ...prev, [currentCharRef.current]: count + 1 };
      });
      
      // Reduce points
      const currentPoints = state.charPoints[currentCharRef.current] || 0;
      const newPoints = Math.max(0, currentPoints * INCORRECT_PENALTY);
      console.log(`SendingMode: Reducing points for "${currentCharRef.current}" from ${currentPoints} to ${newPoints}`);
      updateCharPoints(currentCharRef.current, newPoints);
      
      // Handle checkpoint strikes
      if (isCheckpoint && strikeLimit) {
        const newStrikeCount = strikeCount + 1;
        setStrikeCount(newStrikeCount);
        
        if (newStrikeCount >= strikeLimit) {
          setTimeout(() => finishTest(false), 1000);
          return;
        }
      }
      
      // Play error sound
      playErrorSound();
      
      // Show next character after longer delay
      setTimeout(() => {
        setFeedbackState('none');
        showNextChar();
      }, 2000);
    }
    
    // Clear morse output
    setMorseOutput('');
  }, [
    calculatePointsForTime,
    state.charPoints,
    state.chars,
    updateCharPoints,
    isCheckpoint,
    strikeLimit,
    strikeCount,
    playErrorSound,
    showNextChar,
    finishTest
  ]);
  
  // Create the keyer
  const keyer = useIambicKeyer({
    wpm: state.sendWpm,
    minWpm: 5,
    maxWpm: 40,
    onElement: handleElement,
    playElement: playElement,
    onCharacter: handleCharacter,
    onWpmChange: (newWpm) => {
      console.log('WPM changed to', newWpm);
    }
  });
  
  // Start test 
  const startSendingTest = useCallback(() => {
    console.log('SendingMode: Starting sending test - initializing state');
    
    // Set active ref to true immediately - this will be available to callbacks
    activeRef.current = true;
    
    // Clear any pending keyer state
    console.log(`SendingMode: Clearing keyer state`);
    keyer.clear();
    
    // Pick and set the first character immediately
    const firstChar = pickNextChar();
    console.log(`SendingMode: Setting first character: "${firstChar}"`);
    setSendCurrentChar(firstChar);
    currentCharRef.current = firstChar;  // Set the ref immediately
    
    // Reset UI state
    setSendingActive(true);
    setMorseOutput('');
    setFeedbackState('none');
    setIncorrectChar('');
    setStrikeCount(0);
    
    // Reset performance tracking
    setResponseTimes([]);
    setMistakesMap({});
    setCompleted(true);
    setShowResults(false);
    
    // Start app test
    startTest();
    
    // Set start time
    testStartTimeRef.current = Date.now();
    charStartTimeRef.current = Date.now();  // Set start time for the first character
    
    console.log(`SendingMode: Test started, first character is "${firstChar}", waiting for input`);
  }, [startTest, pickNextChar, keyer]);
  
  // Install keyer once on mount
  useEffect(() => {
    if (isBrowser) {
      console.log('Installing keyer');
      keyer.install();
    }
    
    return () => {
      console.log('Uninstalling keyer');
      keyer.uninstall();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Update progress display
  useEffect(() => {
    if (sendingActive) {
      const masteredCount = state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length;
      setLevelProgress(`Mastered: ${masteredCount}/${state.chars.length}`);
    }
  }, [sendingActive, state.chars, state.charPoints]);
  
  // Handle escape key
  useEffect(() => {
    if (!isBrowser) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sendingActive) {
        e.preventDefault();
        finishTest(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sendingActive, finishTest]);
  
  // Handle repeat level
  const handleRepeatLevel = useCallback(() => {
    setShowResults(false);
    startSendingTest();
  }, [startSendingTest]);
  
  // Handle next level
  const handleNextLevel = useCallback(() => {
    setShowResults(false);
    
    // Find next level
    const currentLevelIndex = trainingLevels.findIndex(l => l.id === state.selectedLevelId);
    
    if (currentLevelIndex >= 0 && currentLevelIndex < trainingLevels.length - 1) {
      // Move to next level
      const nextLevel = trainingLevels[currentLevelIndex + 1];
      selectLevel(nextLevel.id);
      
      // Start with new level
      setTimeout(startSendingTest, 300);
    } else {
      // Restart current level if at end
      startSendingTest();
    }
  }, [state.selectedLevelId, selectLevel, startSendingTest]);
  
  return (
    <div className={styles.sendingTrainer}>
      {showResults ? (
        <TestResultsSummary
          completed={completed}
          elapsedTime={elapsedTime}
          replayCount={0} // Not applicable for sending mode
          mistakesMap={mistakesMap}
          responseTimes={responseTimes}
          levelId={state.selectedLevelId}
          onRepeat={handleRepeatLevel}
          onNext={handleNextLevel}
        />
      ) : sendingActive ? (
        <>
          <div className={styles.sendCurrentMeta}>
            <div className={styles.sendCurrentLevel}>{levelProgress}</div>
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
            {sendCurrentChar && (
              <div className={styles.bigCharacter}>{sendCurrentChar.toUpperCase()}</div>
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
            onClick={startSendingTest}
          >
            Start {currentLevel ? currentLevel.name.split(':')[0] : 'Test'}
          </button>
          
          {testResults && (
            <div className={styles.results}>
              {testResults}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SendingMode; 