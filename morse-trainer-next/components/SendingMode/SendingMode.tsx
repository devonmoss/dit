import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SendingMode.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { createAudioContext, invMorseMap, morseMap, isBrowser } from '../../utils/morse';
import MasteryDisplay from '../MasteryDisplay/MasteryDisplay';

// Constants
const TARGET_POINTS = 3;
const COMPLETED_WEIGHT = 0.2;
const MIN_RESPONSE_TIME = 0.8; // seconds
const MAX_RESPONSE_TIME = 7; // seconds
const INCORRECT_PENALTY = 0.7; // 30% reduction

interface SendingModeProps {}

interface CharTiming {
  char: string;
  time: number;
}

const SendingMode: React.FC<SendingModeProps> = () => {
  const { state, startTest, endTest, updateCharPoints, saveResponseTimes } = useAppState();
  const [audioContextInstance, setAudioContextInstance] = useState<ReturnType<typeof createAudioContext> | null>(null);
  
  // Initialize audio context on client-side only
  useEffect(() => {
    if (isBrowser) {
      setAudioContextInstance(createAudioContext());
    }
  }, []);
  
  // Sending state
  const [sendCurrentChar, setSendCurrentChar] = useState('');
  const [sendCurrentMistakes, setSendCurrentMistakes] = useState(0);
  const [sendStatus, setSendStatus] = useState('');
  const [sendResults, setSendResults] = useState('');
  const [sendProgress, setSendProgress] = useState('');
  const [keyerOutput, setKeyerOutput] = useState('');
  const [decodedOutput, setDecodedOutput] = useState('');
  const [codeBuffer, setCodeBuffer] = useState('');
  const [wordBuffer, setWordBuffer] = useState('');
  // Track key state with useState for UI updates
  const [keyState, setKeyState] = useState({ ArrowLeft: false, ArrowRight: false });
  // Track key state with a ref for immediate access in event handlers
  const keyStateRef = useRef({ ArrowLeft: false, ArrowRight: false });
  const [sendingActive, setSendingActive] = useState(false);
  const [guidedSendActive, setGuidedSendActive] = useState(false);
  const [allMastered, setAllMastered] = useState(false);
  const [responseTimes, setResponseTimes] = useState<CharTiming[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Time tracking
  const charStartTimeRef = useRef<number>(0);
  
  // Pick next character to practice sending
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
  
  // Start Send Test
  const startSendTest = useCallback(() => {
    startTest();
    setSendingActive(true);
    setGuidedSendActive(true);
    setSendCurrentChar('');
    setSendCurrentMistakes(0);
    setSendStatus('');
    setSendResults('');
    setKeyerOutput('');
    setDecodedOutput('');
    setCodeBuffer('');
    setWordBuffer('');
    setAllMastered(false);
    setResponseTimes([]);
    
    // Clear the send queue and key state
    sendQueueRef.current = [];
    keyStateRef.current = { ArrowLeft: false, ArrowRight: false };
    
    // Need a slight delay to ensure state is updated
    setTimeout(nextSendQuestion, 100);
  }, [startTest]);
  
  // Next character to send
  const nextSendQuestion = useCallback(() => {
    const nextChar = pickNextChar();
    setSendCurrentChar(nextChar);
    setSendCurrentMistakes(0);
    setSendStatus('');
    setKeyerOutput('');
    setCodeBuffer('');
    
    // Set the start time for response time tracking
    charStartTimeRef.current = Date.now();
  }, [pickNextChar]);
  
  // Finish send test
  const finishSendTest = useCallback(() => {
    console.log('Finishing send test');
    setSendingActive(false);
    setGuidedSendActive(false);
    
    // Clear any remaining state
    sendQueueRef.current = [];
    keyStateRef.current = { ArrowLeft: false, ArrowRight: false };
    console.log('Reset key state and queue');
    
    // Save response times to database
    if (responseTimes.length > 0) {
      saveResponseTimes(responseTimes);
    }
    
    endTest(true);
    
    // Display results
    const masteredCount = state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length;
    const totalCount = state.chars.length;
    const avgTime = responseTimes.length > 0 
      ? (responseTimes.reduce((sum, item) => sum + item.time, 0) / responseTimes.length).toFixed(2)
      : '0';
      
    setSendResults(`You've mastered ${masteredCount}/${totalCount} characters. Average response time: ${avgTime}s`);
  }, [state.chars, endTest, responseTimes, saveResponseTimes]);
  
  // Make sure we're using the same timing as the original application
  useEffect(() => {
    if (audioContextInstance) {
      audioContextInstance.setWpm(state.sendWpm);
    }
  }, [audioContextInstance, state.sendWpm]);
  
  // Play sound for dot or dash - Match original implementation exactly
  const playSendSymbol = useCallback(async (symbol: string) => {
    if (!audioContextInstance) return;
    const sendUnit = 1200 / state.sendWpm;
    const duration = symbol === '.' ? sendUnit : sendUnit * 3;
    
    console.log(`Playing ${symbol} with duration ${duration}ms`);
    
    // Match original implementation behavior directly
    return new Promise<void>((resolve) => {
      // Use the WebAudio API directly as in the original code
      if (window.AudioContext || (window as any).webkitAudioContext) {
        const tmpContext = audioContextInstance.getRawContext();
        const osc = tmpContext.createOscillator();
        osc.frequency.value = 600; 
        osc.type = 'sine';
        osc.connect(tmpContext.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          resolve();
        }, duration);
      } else {
        setTimeout(resolve, duration);
      }
    });
  }, [audioContextInstance, state.sendWpm]);
  
  // Play error sound for incorrect inputs
  const playErrorSound = useCallback(async () => {
    if (!audioContextInstance) return;
    await audioContextInstance.playTone(300, 150, 0.5); // Lower frequency, shorter duration, reduced volume
  }, [audioContextInstance]);
  
  // Calculate response time points
  const calculatePointsForTime = useCallback((responseTime: number) => {
    const seconds = responseTime / 1000;
    if (seconds <= MIN_RESPONSE_TIME) return 1;
    if (seconds >= MAX_RESPONSE_TIME) return 0;
    
    // Linear scale between min and max response times
    return 1 - ((seconds - MIN_RESPONSE_TIME) / (MAX_RESPONSE_TIME - MIN_RESPONSE_TIME));
  }, []);
  
  // Check if all characters are mastered
  const checkAllMastered = useCallback(() => {
    return state.chars.every(c => (state.charPoints[c] || 0) >= TARGET_POINTS);
  }, [state.chars, state.charPoints]);
  
  // Handle when a word/character is completed
  const handleWordComplete = useCallback((word: string) => {
    if (!guidedSendActive) return;
    
    // Calculate response time
    const responseTime = Date.now() - charStartTimeRef.current;
    
    // Check if the sent word matches the current character
    if (word.toLowerCase() === sendCurrentChar.toLowerCase()) {
      // Clear any error message
      setErrorMessage('');
      
      // Points based on response time
      const responsePoints = calculatePointsForTime(responseTime);
      
      // Add to response times log
      setResponseTimes(prev => [...prev, { char: sendCurrentChar, time: responseTime / 1000 }]);
      
      // Correct!
      updateCharPoints(sendCurrentChar, (state.charPoints[sendCurrentChar] || 0) + responsePoints);
      
      // Clear the current character to indicate a successful completion
      setSendCurrentChar('');
      
      // Check if all characters are mastered
      const newAllMastered = checkAllMastered();
      
      // If all are mastered now but weren't before, set the flag
      if (newAllMastered && !allMastered) {
        setAllMastered(true);
      }
      // If all were already mastered, finish the test
      else if (newAllMastered && allMastered) {
        finishSendTest();
        return;
      }
      
      // Go to next character after a delay - match original feedbackDelay of 750ms
      setTimeout(nextSendQuestion, 750);
    } else {
      // Incorrect
      setSendCurrentMistakes(prev => prev + 1);
      
      // Show error message
      setErrorMessage(`You sent "${word}" instead of "${sendCurrentChar}"`);
      
      // Reduce points for mistakes - now 30% reduction
      const currentPoints = state.charPoints[sendCurrentChar] || 0;
      const newPoints = Math.max(0, currentPoints * INCORRECT_PENALTY);
      updateCharPoints(sendCurrentChar, newPoints);
      
      // Play error sound
      playErrorSound();
      
      // Clear error message after delay
      setTimeout(() => {
        setErrorMessage('');
      }, 2000);
    }
    
    // Clear the keyer display
    setKeyerOutput('');
    setCodeBuffer('');
    setWordBuffer('');
  }, [guidedSendActive, sendCurrentChar, state.charPoints, updateCharPoints, nextSendQuestion, finishSendTest, playErrorSound, calculatePointsForTime, checkAllMastered, allMastered]);
  
  // Clear current output
  const handleClear = useCallback(() => {
    setKeyerOutput('');
    setDecodedOutput('');
    setCodeBuffer('');
    setWordBuffer('');
  }, []);
  
  
  // Queue of user-triggered symbols to support taps during play
  // In the original implementation, sendQueue was a mutable array 
  // We'll use a ref to match that mutable behavior
  const sendQueueRef = useRef<string[]>([]);

  // Paddle key handlers - Exactly match original implementation
  // These are redundant now - we've moved the implementation to the useEffect
  // Keep them as empty stubs but they're no longer used
  const handleKeyUp = useCallback(() => {}, []);
  const handleKeyDown = useCallback(() => {}, []);
  
  // Main sending loop - Exactly following original implementation for consistent behavior
  // Uses wait function with setTimeout instead of requestAnimationFrame for more consistent timing
  useEffect(() => {
    if (!sendingActive || !isBrowser) return;
    
    let lastSymbol: string | null = null;
    let lastTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;
    let active = true;
    // Using local variables to track state to avoid closure issues
    let localCodeBuffer = '';
    let localWordBuffer = '';
    
    const wait = (ms: number): Promise<void> => {
      return new Promise(resolve => {
        timeoutId = setTimeout(() => {
          resolve();
        }, ms);
      });
    };
    
    const sendLoop = async () => {
      while (active && sendingActive) {
        const now = Date.now();
        const gap = now - lastTime;
        const sendUnit = 1200 / state.sendWpm;
        
        // Word gap detection: >=7 units
        if (gap >= sendUnit * 7 && (localCodeBuffer || localWordBuffer)) {
          // decode pending letter
          if (localCodeBuffer) {
            const letter = invMorseMap[localCodeBuffer] || "?";
            setDecodedOutput(prev => prev + letter);
            setWordBuffer(prev => prev + letter);
            localWordBuffer += letter;
            localCodeBuffer = '';
            setCodeBuffer('');
          }
          
          // Word complete: evaluate and clear displays
          if (localWordBuffer) {
            handleWordComplete(localWordBuffer);
          }
          
          // Clear displays
          setKeyerOutput('');
          setDecodedOutput('');
          setWordBuffer('');
          localWordBuffer = '';
          
          lastTime = now;
          await wait(10);
          continue;
        }
        
        // Letter gap detection: >=3 units
        if (gap >= sendUnit * 3 && localCodeBuffer) {
          const letter = invMorseMap[localCodeBuffer] || "?";
          setDecodedOutput(prev => prev + letter);
          setWordBuffer(prev => prev + letter);
          localWordBuffer += letter;
          localCodeBuffer = '';
          setCodeBuffer('');
          lastTime = now;
        }
        
        // determine next symbol: queued taps first
        let symbol: string | undefined;
        
        // Exactly match original implementation using shift() to remove and return the first element
        if (sendQueueRef.current.length > 0) {
          symbol = sendQueueRef.current.shift();
          console.log(`Dequeued symbol: ${symbol}, queue length now: ${sendQueueRef.current.length}`);
        } else {
          // Use the ref for immediate access to current key state
          const left = keyStateRef.current.ArrowLeft;
          const right = keyStateRef.current.ArrowRight;
          console.log(`Checking key states (from ref) - left: ${left}, right: ${right}`);
          
          if (!left && !right) {
            await wait(10);
            continue;
          } else if (left && right) {
            // Iambic keying - alternate between dot and dash exactly like the original
            symbol = lastSymbol === "." ? "-" : ".";
          } else if (left) {
            symbol = ".";
          } else {
            symbol = "-";
          }
        }
        
        if (symbol) {
          // play and display symbol
          await playSendSymbol(symbol);
          setKeyerOutput(prev => prev + symbol);
          setCodeBuffer(prev => prev + symbol);
          localCodeBuffer += symbol;
          lastSymbol = symbol;
          
          // inter-element gap
          await wait(sendUnit);
          lastTime = Date.now();
        }
      }
    };
    
    // Start the send loop
    sendLoop();
    
    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [sendingActive, state.sendWpm, handleWordComplete, playSendSymbol]);
  
  // Attach and detach event listeners with proper handlers
  useEffect(() => {
    if (!isBrowser) return;
    
    // Create stable handler references that won't change between renders
    const keyDownHandler = (e: KeyboardEvent) => {
      // Only handle events during active sending
      if (!sendingActive) return;
      
      // Log the raw event
      console.log(`[RAW] keydown: ${e.key}, repeat: ${e.repeat}`);
      
      // Ignore key repeats
      if (e.repeat) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        endTest(false);
        setSendingActive(false);
        setGuidedSendActive(false);
        return;
      }
      
      // Handle paddle key presses
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        console.log(`ArrowLeft DOWN (ref state: ${JSON.stringify(keyStateRef.current)})`);
        
        // Only queue a dot if key wasn't already pressed
        if (!keyStateRef.current.ArrowLeft) {
          console.log('Queueing a DOT');
          sendQueueRef.current.push('.');
        }
        
        // Update ref state immediately
        keyStateRef.current.ArrowLeft = true;
        
        // Update React state for UI rendering
        setKeyState(prev => ({ ...prev, ArrowLeft: true }));
      } 
      else if (e.key === 'ArrowRight') {
        e.preventDefault();
        console.log(`ArrowRight DOWN (ref state: ${JSON.stringify(keyStateRef.current)})`);
        
        // Only queue a dash if key wasn't already pressed
        if (!keyStateRef.current.ArrowRight) {
          console.log('Queueing a DASH');
          sendQueueRef.current.push('-');
        }
        
        // Update ref state immediately
        keyStateRef.current.ArrowRight = true;
        
        // Update React state for UI rendering
        setKeyState(prev => ({ ...prev, ArrowRight: true }));
      }
    };
    
    const keyUpHandler = (e: KeyboardEvent) => {
      // Only handle events during active sending
      if (!sendingActive) return;
      
      // Log the raw event
      console.log(`[RAW] keyup: ${e.key}`);
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        console.log(`${e.key} UP (ref state: ${JSON.stringify(keyStateRef.current)})`);
        
        // Update ref state immediately
        keyStateRef.current[e.key as 'ArrowLeft' | 'ArrowRight'] = false;
        
        // Update React state for UI rendering
        setKeyState(prev => ({ ...prev, [e.key]: false }));
      }
    };
    
    // Add event listeners
    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);
    
    // Clean up on component unmount
    return () => {
      console.log('Cleaning up keyboard event listeners');
      document.removeEventListener('keydown', keyDownHandler);
      document.removeEventListener('keyup', keyUpHandler);
    };
  }, [sendingActive, endTest]);
  
  // Calculate progress
  useEffect(() => {
    if (sendingActive) {
      const masteredCount = state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length;
      setSendProgress(`Mastered: ${masteredCount}/${state.chars.length}`);
    }
  }, [sendingActive, state.chars, state.charPoints]);
  
  return (
    <div className={styles.sendingTrainer}>
      {sendingActive ? (
        <>
          <div className={styles.sendCurrentMeta}>
            <div className={styles.sendCurrentLevel}>{sendProgress}</div>
          </div>
          
          <MasteryDisplay targetPoints={TARGET_POINTS} />
          
          <div className={styles.currentCharDisplay}>
            {sendCurrentChar && (
              <div className={styles.bigCharacter}>{sendCurrentChar.toUpperCase()}</div>
            )}
          </div>
          
          {errorMessage && (
            <div className={styles.errorMessage}>
              {errorMessage}
            </div>
          )}
          
          <div className={styles.sendingInstructions}>
            Use ← key for <span className={styles.dot}>·</span> and → key for <span className={styles.dash}>–</span>
          </div>
          
          <div className={styles.keyerDisplay}>
            <div className={styles.keyerOutput}>{keyerOutput}</div>
            <div className={styles.decodedOutput}>{decodedOutput}</div>
          </div>
          
          <div className={styles.controls}>
            <button 
              className={styles.button}
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
          
          <div className={styles.actionHints}>
            Esc: End Test
          </div>
        </>
      ) : (
        <div className={styles.startContainer}>
          <button 
            className={styles.startButton}
            onClick={startSendTest}
          >
            Start Sending Practice
          </button>
          
          {sendResults && (
            <div className={styles.results}>
              {sendResults}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SendingMode; 