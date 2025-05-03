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
  // Track playback and paddle state
  const wpm = useRef<number>(opts.wpm);
  const unit = useRef<number>(1200 / opts.wpm);
  const buffer = useRef<string>('');
  const dotHeld = useRef<boolean>(false);
  const dashHeld = useRef<boolean>(false);
  const lastSymbol = useRef<Symbol | null>(null);
  const isActive = useRef<boolean>(false);
  
  // Element scheduled, played, etc.
  const elementTimer = useRef<number | null>(null);
  const charTimer = useRef<number | null>(null);
  const wordTimer = useRef<number | null>(null);
  
  // Debug
  const debugEvents = useRef<Array<{type: string, value?: string, timestamp: number}>>([]);
  
  // Debug log
  const debugLog = (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IambicKeyer] ${message}`);
    }
  };
  
  // Add debug event
  const addDebugEvent = (type: string, value?: string) => {
    if (process.env.NODE_ENV === 'development') {
      const event = { type, value, timestamp: Date.now() };
      debugEvents.current = [...debugEvents.current.slice(-99), event];
      debugLog(`Event: ${type}${value ? ' - ' + value : ''}`);
    }
  };
  
  // Update WPM
  const updateWpm = (newWpm: number) => {
    wpm.current = newWpm;
    unit.current = 1200 / newWpm;
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSendWpm', String(newWpm));
    }
    opts.onWpmChange?.(newWpm);
    addDebugEvent('wpm_change', String(newWpm));
  };
  
  // Handle emit and schedule next
  const emitSymbol = (sym: Symbol) => {
    // Update last symbol
    lastSymbol.current = sym;
    
    // Add to buffer 
    buffer.current += sym;
    
    // Log and emit
    addDebugEvent('emit', sym);
    opts.onElement?.(sym);
    opts.playElement?.(sym);
    
    // Schedule next element based on current element duration and gap
    const symbolDuration = sym === '.' ? unit.current : unit.current * 3;
    const gapDuration = unit.current; // Always 1 unit gap between elements
    const totalDuration = symbolDuration + gapDuration;
    
    debugLog(`Playing ${sym === '.' ? 'DOT' : 'DASH'} - duration: ${symbolDuration}ms, gap: ${gapDuration}ms`);
    
    // Schedule word gap
    scheduleWord();
    
    // Schedule next element
    scheduleNextElement(totalDuration);
  };
  
  // Schedule next element after current one finishes
  const scheduleNextElement = (delayMs: number) => {
    // Clear existing timer
    if (elementTimer.current !== null) {
      clearTimeout(elementTimer.current);
      elementTimer.current = null;
    }
    
    // Set new timer
    elementTimer.current = window.setTimeout(() => {
      elementTimer.current = null;
      
      // First check for explicitly queued symbols from quick keypresses
      if (pendingSymbols.current.length > 0) {
        const nextSymbol = pendingSymbols.current.shift()!;
        addDebugEvent('dequeue', nextSymbol);
        emitSymbol(nextSymbol);
        return;
      }
      
      // Otherwise check paddle states for continuous/squeeze behavior
      if (dotHeld.current && dashHeld.current) {
        // Squeeze - alternate
        addDebugEvent('squeeze');
        const nextSym: Symbol = lastSymbol.current === '.' ? '-' : '.';
        emitSymbol(nextSym);
      } else if (dotHeld.current) {
        // Continuous dots
        addDebugEvent('continuous', 'dot');
        emitSymbol('.');
      } else if (dashHeld.current) {
        // Continuous dashes
        addDebugEvent('continuous', 'dash');
        emitSymbol('-');
      } else {
        // No paddles held, end of sequence
        addDebugEvent('element_end');
        scheduleChar();
      }
    }, delayMs);
  };
  
  // Schedule character decode
  const scheduleChar = () => {
    if (charTimer.current !== null) {
      clearTimeout(charTimer.current);
    }
    
    addDebugEvent('schedule_char');
    
    charTimer.current = window.setTimeout(() => {
      charTimer.current = null;
      decodeChar();
    }, unit.current * 3);
  };
  
  // Decode character from buffer
  const decodeChar = () => {
    if (!buffer.current) return;
    
    const code = buffer.current;
    buffer.current = '';
    const char = invMorseMap[code] || '';
    
    if (char) {
      addDebugEvent('char', char);
      opts.onCharacter?.(char);
    } else {
      addDebugEvent('unknown', code);
    }
  };
  
  // Schedule word boundary
  const scheduleWord = () => {
    if (wordTimer.current !== null) {
      clearTimeout(wordTimer.current);
    }
    
    wordTimer.current = window.setTimeout(() => {
      wordTimer.current = null;
      opts.onWord?.();
      addDebugEvent('word');
    }, unit.current * 7);
  };
  
  // Track key events to filter OS key repeat
  const lastKeyTime = useRef<{[key: string]: number}>({});
  
  // Queue for quick successive keypresses
  const pendingSymbols = useRef<Symbol[]>([]);
  
  // Handle key down
  const handleKeyDown = (e: KeyboardEvent) => {
    const now = Date.now();
    const lastTime = lastKeyTime.current[e.key] || 0;
    const timeSince = now - lastTime;
    
    lastKeyTime.current[e.key] = now;
    
    // Dot key (left arrow)
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      
      // Always record a new keypress when the key is pressed (not just released and pressed again)
      // This detects both: 1) newly pressed paddles and 2) quick successive presses
      if (timeSince > 50) { // Filter out OS key repeat events
        addDebugEvent('key_down', 'ArrowLeft');
        
        // Always update paddle state
        dotHeld.current = true;
        
        // If no element is playing, start immediately
        if (elementTimer.current === null) {
          emitSymbol('.');
        } 
        // If an element is playing but this is a quick explicit press (not just held state)
        // then queue this symbol to be played next
        else if (timeSince > 200) {
          addDebugEvent('queue', 'dot');
          pendingSymbols.current.push('.');
        }
      }
    }
    
    // Dash key (right arrow)
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      
      // Always record a new keypress when the key is pressed (not just released and pressed again)
      // This detects both: 1) newly pressed paddles and 2) quick successive presses
      if (timeSince > 50) { // Filter out OS key repeat events
        addDebugEvent('key_down', 'ArrowRight');
        
        // Always update paddle state
        dashHeld.current = true;
        
        // If no element is playing, start immediately
        if (elementTimer.current === null) {
          emitSymbol('-');
        } 
        // If an element is playing but this is a quick explicit press (not just held state)
        // then queue this symbol to be played next
        else if (timeSince > 200) {
          addDebugEvent('queue', 'dash');
          pendingSymbols.current.push('-');
        }
      }
    }
    
    // Tab - clear
    else if (e.key === 'Tab') {
      e.preventDefault();
      clear();
    }
    
    // Speed control
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newWpm = Math.min(opts.maxWpm || 40, wpm.current + 1);
      updateWpm(newWpm);
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newWpm = Math.max(opts.minWpm || 5, wpm.current - 1);
      updateWpm(newWpm);
    }
  };
  
  // Handle key up
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      dotHeld.current = false;
      addDebugEvent('key_up', 'ArrowLeft');
      
      // If both paddles released and no element playing, decode character
      if (!dashHeld.current && elementTimer.current === null && buffer.current) {
        scheduleChar();
      }
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      dashHeld.current = false;
      addDebugEvent('key_up', 'ArrowRight');
      
      // If both paddles released and no element playing, decode character
      if (!dotHeld.current && elementTimer.current === null && buffer.current) {
        scheduleChar();
      }
    }
  };
  
  // Install event listeners
  const install = () => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    isActive.current = true;
    addDebugEvent('install');
  };
  
  // Remove event listeners and cleanup
  const uninstall = () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    clear();
    isActive.current = false;
    addDebugEvent('uninstall');
  };
  
  // Clear state and timers
  const clear = () => {
    buffer.current = '';
    pendingSymbols.current = [];
    
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
    updateWpm(opts.wpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.wpm]);
  
  // Create return object
  const keyer: IambicKeyer = {
    install,
    uninstall,
    clear
  };
  
  // Add debug in development
  if (process.env.NODE_ENV === 'development') {
    keyer.debug = {
      dotHeld: dotHeld.current,
      dashHeld: dashHeld.current,
      buffer: buffer.current,
      lastSymbol: lastSymbol.current,
      wpm: wpm.current,
      isActive: isActive.current,
      addEvent: (event) => addDebugEvent(event.type, event.value)
    };
    
    // Update debug values
    useEffect(() => {
      const interval = setInterval(() => {
        if (keyer.debug) {
          keyer.debug.dotHeld = dotHeld.current;
          keyer.debug.dashHeld = dashHeld.current;
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