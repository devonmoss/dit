import { useEffect, useRef } from 'react';
import { invMorseMap } from '../utils/morse';

type Symbol = '.' | '-';

export interface IambicKeyerOptions {
  /** Starting speed in WPM */
  wpm: number;
  /** Minimum and maximum bounds for dynamic speed */
  minWpm?: number;
  maxWpm?: number;
  /** Callbacks */
  onElement?: (sym: Symbol) => void;
  playElement?: (sym: Symbol) => void;
  onCharacter?: (char: string) => void;
  onWord?: () => void;
  onWpmChange?: (newWpm: number) => void;
}

export interface IambicKeyer {
  /** Attach global key event listeners */
  install: () => void;
  /** Remove listeners and cleanup timers */
  uninstall: () => void;
  /** Clear current buffer and pending timers */
  clear: () => void;
  /** Debug information (only available in development) */
  debug?: {
    dotHeld: boolean;
    dashHeld: boolean;
    buffer: string;
    lastSymbol: string | null;
    wpm: number;
    isActive: boolean;
    addEvent: (event: { type: string, value?: string }) => void;
  };
}

export function useIambicKeyer(opts: IambicKeyerOptions): IambicKeyer {
  // State
  const wpm = useRef<number>(opts.wpm);
  const unit = useRef<number>(1200 / opts.wpm); // dit duration in ms
  const buffer = useRef<string>('');
  const dotPressed = useRef<boolean>(false);
  const dashPressed = useRef<boolean>(false);
  const lastSymbol = useRef<Symbol | null>(null);
  const isActive = useRef<boolean>(false);
  
  // Timers
  const elementTimer = useRef<number | null>(null);
  const charTimer = useRef<number | null>(null);
  const wordTimer = useRef<number | null>(null);
  
  // Debug events
  const debugEvents = useRef<Array<{type: string, value?: string, timestamp: number}>>([]);
  
  // Debug functions
  const debugLog = (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IambicKeyer] ${message}`);
    }
  };
  
  const addDebugEvent = (type: string, value?: string) => {
    if (process.env.NODE_ENV === 'development') {
      const event = { type, value, timestamp: Date.now() };
      debugEvents.current = [...debugEvents.current.slice(-99), event];
      debugLog(`Event: ${type}${value ? ' - ' + value : ''}`);
    }
  };
  
  // Update WPM and unit duration
  const setWpm = (newWpm: number) => {
    wpm.current = newWpm;
    unit.current = 1200 / newWpm;
    // Persist to localStorage in browser
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSendWpm', String(newWpm));
    }
    // Notify parent
    opts.onWpmChange?.(newWpm);
    addDebugEvent('wpm_change', String(newWpm));
  };
  
  // Handle element emission (dot or dash)
  const emitElement = (sym: Symbol) => {
    // Log debug info
    addDebugEvent('emit', sym);
    debugLog(`Emitting ${sym === '.' ? 'DOT' : 'DASH'}`);
    
    // Store as last symbol
    lastSymbol.current = sym;
    
    // Add to buffer
    buffer.current += sym;
    
    // Trigger callbacks
    opts.onElement?.(sym);
    opts.playElement?.(sym);
    
    // Schedule word gap after this element
    scheduleWord();
    
    // Schedule the next element based on state
    scheduleNextElement();
  };
  
  // Schedule the next element based on paddle state
  const scheduleNextElement = () => {
    // Clear any existing element timer
    if (elementTimer.current !== null) {
      clearTimeout(elementTimer.current);
      elementTimer.current = null;
    }
    
    // Calculate timing - current element + inter-element gap
    const elementDuration = lastSymbol.current === '.' ? unit.current : unit.current * 3;
    const gapDuration = unit.current; // One unit between elements
    const totalDuration = elementDuration + gapDuration;
    
    // Schedule next element after current + gap
    elementTimer.current = window.setTimeout(() => {
      elementTimer.current = null;
      
      // At this point, it's time for the next element
      // Check paddle state and determine what element to play next
      
      if (dotPressed.current && dashPressed.current) {
        // Squeeze logic (both paddles pressed)
        // Alternating pattern for iambic keyer mode A
        addDebugEvent('squeeze');
        const nextSymbol: Symbol = lastSymbol.current === '.' ? '-' : '.';
        emitElement(nextSymbol);
      } else if (dotPressed.current) {
        // Dot paddle still held
        addDebugEvent('continuous', 'dot');
        emitElement('.');
      } else if (dashPressed.current) {
        // Dash paddle still held
        addDebugEvent('continuous', 'dash');
        emitElement('-');
      } else {
        // No paddles held, end of sequence
        addDebugEvent('element_end');
        scheduleChar();
      }
    }, totalDuration);
  };
  
  // Schedule character decode after element end
  const scheduleChar = () => {
    if (charTimer.current !== null) {
      clearTimeout(charTimer.current);
    }
    
    addDebugEvent('schedule_char');
    
    // 3 units after last element to detect character end
    charTimer.current = window.setTimeout(() => {
      charTimer.current = null;
      decodeChar();
    }, unit.current * 3);
  };
  
  // Decode the current buffer as a character
  const decodeChar = () => {
    if (!buffer.current) return;
    
    const code = buffer.current;
    buffer.current = '';
    const char = invMorseMap[code] || '';
    
    if (char) {
      addDebugEvent('char', char);
      opts.onCharacter?.(char);
    } else {
      addDebugEvent('unknown_char', code);
    }
  };
  
  // Schedule word boundary
  const scheduleWord = () => {
    if (wordTimer.current !== null) {
      clearTimeout(wordTimer.current);
    }
    
    // 7 units after last element to detect word end
    wordTimer.current = window.setTimeout(() => {
      wordTimer.current = null;
      addDebugEvent('word');
      opts.onWord?.();
    }, unit.current * 7);
  };
  
  // Track the last key event timestamp to handle OS key repeat
  const lastKeyDownTimestamps = useRef<{[key: string]: number}>({});
  
  // Handle key press
  const handleKeyDown = (e: KeyboardEvent) => {
    // Get current time for rate limiting
    const now = Date.now();
    const lastTimestamp = lastKeyDownTimestamps.current[e.key] || 0;
    const timeSinceLastKeyDown = now - lastTimestamp;
    
    debugLog(`Key down: ${e.key} (${timeSinceLastKeyDown}ms since last press)`);
    
    // Store this keydown timestamp
    lastKeyDownTimestamps.current[e.key] = now;
    
    // Left arrow = dot
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      
      // Always update paddle state on keydown
      if (!dotPressed.current) {
        dotPressed.current = true;
        addDebugEvent('paddle_down', 'dot');
        
        // If no element is being emitted, start with a dot
        if (elementTimer.current === null) {
          emitElement('.');
        }
      } else {
        // This is likely a key repeat - still log it so we know
        addDebugEvent('key_repeat', 'ArrowLeft');
      }
    }
    
    // Right arrow = dash
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      
      // Always update paddle state on keydown
      if (!dashPressed.current) {
        dashPressed.current = true;
        addDebugEvent('paddle_down', 'dash');
        
        // If no element is being emitted, start with a dash
        if (elementTimer.current === null) {
          emitElement('-');
        }
      } else {
        // This is likely a key repeat - still log it so we know
        addDebugEvent('key_repeat', 'ArrowRight');
      }
    }
    
    // Tab = clear buffer
    else if (e.key === 'Tab') {
      e.preventDefault();
      addDebugEvent('clear');
      clear();
    }
    
    // Speed controls
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newWpm = Math.min(opts.maxWpm || 40, wpm.current + 1);
      setWpm(newWpm);
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newWpm = Math.max(opts.minWpm || 5, wpm.current - 1);
      setWpm(newWpm);
    }
  };
  
  // Handle key release
  const handleKeyUp = (e: KeyboardEvent) => {
    debugLog(`Key up: ${e.key}`);
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      lastKeyDownTimestamps.current['ArrowLeft'] = 0; // Reset timestamp on keyup
      
      if (dotPressed.current) {
        dotPressed.current = false;
        addDebugEvent('paddle_up', 'dot');
        
        // If element timer is null and dash isn't pressed, schedule char
        if (elementTimer.current === null && !dashPressed.current) {
          scheduleChar();
        }
      }
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      lastKeyDownTimestamps.current['ArrowRight'] = 0; // Reset timestamp on keyup
      
      if (dashPressed.current) {
        dashPressed.current = false;
        addDebugEvent('paddle_up', 'dash');
        
        // If element timer is null and dot isn't pressed, schedule char
        if (elementTimer.current === null && !dotPressed.current) {
          scheduleChar();
        }
      }
    }
  };
  
  // Install event listeners
  const install = () => {
    debugLog('Installing keyer');
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    isActive.current = true;
    addDebugEvent('install');
  };
  
  // Remove event listeners and cleanup
  const uninstall = () => {
    debugLog('Uninstalling keyer');
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    clear();
    isActive.current = false;
    addDebugEvent('uninstall');
  };
  
  // Clear state and timers
  const clear = () => {
    debugLog('Clearing keyer state');
    buffer.current = '';
    
    if (elementTimer.current !== null) {
      clearTimeout(elementTimer.current);
      elementTimer.current = null;
    }
    
    if (charTimer.current !== null) {
      clearTimeout(charTimer.current);
      charTimer.current = null;
    }
    
    if (wordTimer.current !== null) {
      clearTimeout(wordTimer.current);
      wordTimer.current = null;
    }
    
    addDebugEvent('clear');
  };
  
  // Set initial WPM
  useEffect(() => {
    setWpm(opts.wpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.wpm]);
  
  // Create return object
  const keyer: IambicKeyer = {
    install,
    uninstall,
    clear
  };
  
  // Add debug info in development
  if (process.env.NODE_ENV === 'development') {
    keyer.debug = {
      dotHeld: dotPressed.current,
      dashHeld: dashPressed.current,
      buffer: buffer.current,
      lastSymbol: lastSymbol.current,
      wpm: wpm.current,
      isActive: isActive.current,
      addEvent: (event) => addDebugEvent(event.type, event.value)
    };
    
    // Update debug values every 50ms
    useEffect(() => {
      const interval = setInterval(() => {
        if (keyer.debug) {
          keyer.debug.dotHeld = dotPressed.current;
          keyer.debug.dashHeld = dashPressed.current;
          keyer.debug.buffer = buffer.current;
          keyer.debug.lastSymbol = lastSymbol.current;
          keyer.debug.wpm = wpm.current;
          keyer.debug.isActive = isActive.current;
        }
      }, 50);
      
      return () => clearInterval(interval);
    }, [keyer]);
  }
  
  return keyer;
}