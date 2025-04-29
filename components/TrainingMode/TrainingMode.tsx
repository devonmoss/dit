import React, { useState, useEffect, useCallback } from 'react';
import styles from './TrainingMode.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { createAudioContext, morseMap, isBrowser } from '../../utils/morse';
import { trainingLevels } from '../../utils/levels';
import MasteryDisplay from '../MasteryDisplay/MasteryDisplay';
import TestResultsSummary from '../TestResultsSummary/TestResultsSummary';

// Constants
const TARGET_POINTS = 3;
const FEEDBACK_DELAY = 750; // ms
const COMPLETED_WEIGHT = 0.2; // Weight for already mastered characters

/* eslint-disable @typescript-eslint/no-unused-vars */
interface LevelWithStrikeLimit {
  chars: string[];
  strikeLimit?: number;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const TrainingMode: React.FC = () => {
  const { state, startTest, endTest, updateCharPoints, selectLevel, startTestWithLevelId } = useAppState();
  const [audioContextInstance, setAudioContextInstance] = useState<ReturnType<typeof createAudioContext> | null>(null);
  
  // Initialize audio context in useEffect
  useEffect(() => {
    if (isBrowser) {
      setAudioContextInstance(createAudioContext());
    }
  }, []);
  
  // Local state
  const [currentChar, setCurrentChar] = useState('');
  const [status, setStatus] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [currentMistakes, setCurrentMistakes] = useState(0);
  const [hintText, setHintText] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [responseTimes, setResponseTimes] = useState<{char: string, time: number}[]>([]);
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [firstTryCount, setFirstTryCount] = useState(0);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const [mistakesMap, setMistakesMap] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<{
    completed: boolean;
    elapsedTime: number;
    startTime: number | null;
  } | null>(null);
  
  // Track test start time
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  
  // Get current level
  const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);
  const isCheckpoint = currentLevel?.type === 'checkpoint';
  const strikeLimit = isCheckpoint ? currentLevel?.strikeLimit : undefined;
  
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
  
  // Pick next character based on mastery weights
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
  
  // Start next question
  const nextQuestion = useCallback(async () => {
    if (!audioContextInstance) return;
    
    const nextChar = pickNextChar();
    setCurrentChar(nextChar);
    setCurrentMistakes(0);
    setStatus('');
    setHintText('');
    setWaitingForInput(false);
    
    try {
      await audioContextInstance.playMorse(nextChar);
      setQuestionStartTime(Date.now());
      setWaitingForInput(true);
    } catch (error) {
      console.error('Error playing morse:', error);
    }
  }, [pickNextChar, audioContextInstance]);
  
  // Handle keyboard input
  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!audioContextInstance) return;
      
      // Ignore if not waiting for input
      if (!waitingForInput) return;
      
      // Tab to replay, Escape to end test
      if (e.key === 'Tab') {
        e.preventDefault();
        if (currentChar && audioContextInstance) {
          setReplayCount(prev => prev + 1);
          setWaitingForInput(false);
          
          audioContextInstance.playMorse(currentChar)
            .then(() => {
              setWaitingForInput(true);
            });
        }
        return;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        if (testStartTime) {
          const endTime = Date.now();
          const elapsedSec = (endTime - testStartTime) / 1000;
          
          endTest(false);
          setTestResults({
            completed: false,
            elapsedTime: elapsedSec,
            startTime: testStartTime
          });
        } else {
          endTest(false);
        }
        return;
      }
      
      // Otherwise check against current char
      const input = e.key.toLowerCase();
      const target = currentChar.toLowerCase();
      
      if (input === target) {
        // Correct input
        const responseTime = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 0;
        setResponseTimes(prev => [...prev, { char: currentChar, time: responseTime }]);
        
        if (currentMistakes === 0) {
          setFirstTryCount(prev => prev + 1);
        }
        
        // Update success feedback
        setStatus('Correct!');
        setWaitingForInput(false);
        
        // Calculate points based on response time (0.8s = 1 point, 7s = 0 points)
        let pointsToAdd = 0;
        if (responseTime <= 0.4) {
          pointsToAdd = 1.25; // Extra bonus for extremely fast responses
          setStatus('Correct! (Lightning fast!)');
        } else if (responseTime <= 0.8) {
          pointsToAdd = 1; // Full point for fast responses
          setStatus('Correct! (Fast answer)');
        } else if (responseTime < 7) {
          // Linear scale between 0.8s and 7s
          pointsToAdd = 1 - ((responseTime - 0.8) / 6.2);
          pointsToAdd = Math.max(0, pointsToAdd); // Ensure non-negative
        }
        
        // Update character points
        const newPoints = (state.charPoints[target] || 0) + pointsToAdd;
        updateCharPoints(target, newPoints);
        
        console.log(`Character ${target} updated: ${state.charPoints[target] || 0} → ${newPoints} points (${pointsToAdd} added, response time: ${responseTime.toFixed(2)}s)`);
        
        // Delay before next question
        setTimeout(() => {
          // Create a simulated updated charPoints object that includes the most recent update
          const updatedCharPoints = { ...state.charPoints, [target]: newPoints };
          
          // Check if all characters are mastered using the updated points
          const allMastered = state.chars.every(c => (updatedCharPoints[c] || 0) >= TARGET_POINTS);
          
          console.log('Completion check:', { 
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
        // Incorrect input
        setCurrentMistakes(prev => prev + 1);
        
        // Track mistakes by character
        setMistakesMap(prev => ({
          ...prev,
          [target]: (prev[target] || 0) + 1
        }));
        
        // Update error feedback
        setStatus('Incorrect! Try again.');
        setWaitingForInput(false);
        
        // Lose 30% of points for this character (changed from 25%)
        const currentPoints = state.charPoints[target] || 0;
        const newPoints = Math.max(0, currentPoints * 0.7);
        updateCharPoints(target, newPoints);
        
        // Update strike count for checkpoint levels
        if (isCheckpoint && strikeLimit) {
          const newStrikeCount = strikeCount + 1;
          setStrikeCount(newStrikeCount);
          
          if (newStrikeCount >= strikeLimit) {
            finishTest(false);
            return;
          }
        }
        
        // Play error sound, delay, then replay character
        audioContextInstance.playErrorSound()
          .then(() => new Promise(resolve => setTimeout(resolve, FEEDBACK_DELAY)))
          .then(() => audioContextInstance.playMorse(currentChar))
          .then(() => {
            setWaitingForInput(true);
          });
      }
    },
    [waitingForInput, currentChar, questionStartTime, currentMistakes, state.charPoints, 
     state.chars, strikeLimit, strikeCount, endTest, updateCharPoints, nextQuestion, audioContextInstance, isCheckpoint, setReplayCount, setWaitingForInput, testStartTime, setTestResults]
  );
  
  // Replay current character
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const replayCurrent = useCallback(() => {
    if (!currentChar || !audioContextInstance) return;
    
    setReplayCount(prev => prev + 1);
    setWaitingForInput(false);
    
    audioContextInstance.playMorse(currentChar)
      .then(() => {
        setWaitingForInput(true);
      });
  }, [currentChar, audioContextInstance]);
  
  // Show hint for current character
  const showHint = useCallback(() => {
    if (!currentChar) return;
    
    const symbols = morseMap[currentChar];
    if (!symbols) return;
    
    const visual = symbols
      .split('')
      .map(s => (s === '.' ? '·' : '–'))
      .join(' ');
      
    setHintText(visual);
  }, [currentChar]);
  
  // Initialize the test
  const handleStartTest = useCallback(() => {
    // Reset test state
    setCurrentChar('');
    setStatus('');
    setWaitingForInput(false);
    setCurrentMistakes(0);
    setHintText('');
    setStrikeCount(0);
    setReplayCount(0);
    setQuestionStartTime(null);
    setResponseTimes([]);
    setFirstTryCount(0);
    setMistakesMap({});
    setTestResults(null);
    
    // Start the test
    startTest();
    
    // Need a slight delay to ensure state is updated
    setTimeout(() => {
      nextQuestion();
    }, 100);
  }, [startTest, nextQuestion]);
  
  // Set up keyboard listeners
  useEffect(() => {
    if (state.testActive) {
      document.addEventListener('keydown', handleKeydown);
      
      // Apply volume setting to audio context
      audioContextInstance?.setVolume(state.volume);
      audioContextInstance?.setWpm(state.wpm);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [state.testActive, state.volume, state.wpm, handleKeydown, audioContextInstance]);
  
  // Calculate progress - mastered characters
  const masteredCount = state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length;
  const progress = state.chars.length > 0 ? `Mastered: ${masteredCount}/${state.chars.length}` : '';
  
  // Start the test and record start time
  const startTestAndRecordTime = useCallback(() => {
    setTestStartTime(Date.now());
    handleStartTest();
  }, [handleStartTest]);
  
  // Handle test completion
  const finishTest = useCallback((completed = true) => {
    endTest(completed);
    
    const endTime = Date.now();
    const elapsedSec = testStartTime ? (endTime - testStartTime) / 1000 : 0;
    
    setTestResults({
      completed,
      elapsedTime: elapsedSec,
      startTime: testStartTime
    });
  }, [endTest, testStartTime]);
  
  // Replace endTest calls with finishTest
  useEffect(() => {
    if (state.testActive) {
      // Update handleKeydown's endTest call
      const originalHandleKeydown = handleKeydown;
      const wrappedHandleKeydown = (e: KeyboardEvent) => {
        // If Escape is pressed, use finishTest instead
        if (e.key === 'Escape') {
          e.preventDefault();
          finishTest(false);
          return;
        }
        // Otherwise use the original handler
        originalHandleKeydown(e);
      };
      
      document.addEventListener('keydown', wrappedHandleKeydown);
      
      return () => {
        document.removeEventListener('keydown', wrappedHandleKeydown);
      };
    }
  }, [state.testActive, handleKeydown, finishTest]);
  
  const [isClient, setIsClient] = useState(false);
  const [isDevelopment, setIsDevelopment] = useState(false);
  
  // Only render debug elements on client-side and in development environment
  useEffect(() => {
    setIsClient(true);
    
    // Check if we're in a development environment (localhost or 127.0.0.1)
    if (isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      setIsDevelopment(true);
    }
  }, []);
  
  // Helper to check if we have all the right characters for the level
  const checkLevelChars = useCallback(() => {
    const currentLevel = trainingLevels.find(l => l.id === state.selectedLevelId);
    
    if (!currentLevel) {
      console.error("❌ Cannot find level with ID:", state.selectedLevelId);
      return;
    }
    
    console.log("🔍 LEVEL CHARS CHECK");
    console.log("Level ID:", state.selectedLevelId);
    console.log("Expected chars:", currentLevel.chars);
    console.log("Actual chars:", state.chars);
    
    // Check for missing characters
    const missing = currentLevel.chars.filter(c => !state.chars.includes(c));
    if (missing.length > 0) {
      console.error("❌ Missing characters:", missing);
    } else {
      console.log("✅ All expected characters present");
    }
    
    // Check for extra characters
    const extra = state.chars.filter(c => !currentLevel.chars.includes(c));
    if (extra.length > 0) {
      console.warn("⚠️ Extra characters present:", extra);
    }
  }, [state.selectedLevelId, state.chars]);
  
  // Add our check function to the debug panel only in development
  useEffect(() => {
    if (isClient && isDevelopment) {
      // Add a global function to check level chars
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (window as any).checkLevelChars = checkLevelChars;
      console.log("Added checkLevelChars() to window for debugging");
      
      return () => {
        delete (window as any).checkLevelChars;
        /* eslint-enable @typescript-eslint/no-explicit-any */
      };
    }
  }, [isClient, isDevelopment, checkLevelChars]);
  
  return (
    <div className={styles.trainingContainer}>
      {/* Debug state information - only visible on client in development */}
      {isClient && isDevelopment && (
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
          <div>Level ID: {state.selectedLevelId}</div>
          <div>Characters: {state.chars.join(', ')}</div>
          <div>Mastery:
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
          replayCount={replayCount}
          mistakesMap={mistakesMap}
          responseTimes={responseTimes}
          levelId={state.selectedLevelId}
          onRepeat={() => {
            setTestResults(null);
            startTestAndRecordTime();
          }}
          onNext={() => {
            console.log("🔄 onNext triggered");
            setTestResults(null);
            
            // Reset all test state variables
            setCurrentChar('');
            setStatus('');
            setWaitingForInput(false);
            setCurrentMistakes(0);
            setHintText('');
            setStrikeCount(0);
            setReplayCount(0);
            setQuestionStartTime(null);
            setResponseTimes([]);
            setFirstTryCount(0);
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
              
              // Use the new function that takes the level ID directly
              console.log("🔄 Starting test with explicit level ID:", nextLevel.id);
              
              // Set the test start time
              setTestStartTime(Date.now());
              
              // Start the test with the explicit next level ID
              startTestWithLevelId(nextLevel.id);
              
              // Set up the first question after a short delay
              setTimeout(nextQuestion, 300);
            }
          }}
        />
      ) : state.testActive ? (
        <>
          <div className={styles.progressInfo}>{progress}</div>
          
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
          
          <div className={`${styles.status} ${status.includes('Correct') ? styles.success : status ? styles.error : ''}`}>
            {status}
          </div>
          
          <div className={styles.controls}>
            <button onClick={showHint} className={styles.hintButton}>
              ?
            </button>
          </div>
          
          {hintText && <div className={styles.hint}>{hintText}</div>}
          
          <div className={styles.actionHints}>
            Tab: Replay Sound, Esc: End Test
          </div>
        </>
      ) : (
        <div className={styles.startContainer}>
          <div className={styles.modeDescription}>
            Listen to morse code characters and identify them by typing on your keyboard.
          </div>
          <button onClick={startTestAndRecordTime} className="shared-start-button">
            Start {currentLevel ? currentLevel.name.split(':')[0] : 'Test'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TrainingMode;