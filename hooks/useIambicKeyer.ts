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
  /** Called when invalid Morse code is detected */
  onInvalidCharacter?: (code: string) => void;
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
  // Basic state
  const wpm = useRef<number>(opts.wpm);
  const unit = useRef<number>(1200 / opts.wpm);
  const buffer = useRef<string>('');
  const lastSymbol = useRef<Symbol | null>(null);
  
  // Paddle state
  const dotHeld = useRef<boolean>(false);
  const dashHeld = useRef<boolean>(false);
  
  // Element timing
  const elementTimer = useRef<number | null>(null);
  const charTimer = useRef<number | null>(null);
  const wordTimer = useRef<number | null>(null);
  
  // Debug state
  const debugEvents = useRef<Array<{type: string, value?: string, timestamp: number}>>([]);
  
  // Debug logging
  const log = (msg: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IambicKeyer] ${msg}`);
    }
  };
  
  const addEvent = (type: string, value?: string) => {
    if (process.env.NODE_ENV === 'development') {
      const event = { type, value, timestamp: Date.now() };
      debugEvents.current = [...debugEvents.current.slice(-99), event];
      log(`Event: ${type}${value ? ' - ' + value : ''}`);
    }
  };
  
  // Update WPM
  const setWpm = (newWpm: number) => {
    wpm.current = newWpm;
    unit.current = 1200 / newWpm;
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSendWpm', String(newWpm));
    }
    opts.onWpmChange?.(newWpm);
    addEvent('wpm_change', String(newWpm));
  };
  
  // Play a symbol and schedule the next one
  const playSymbol = (sym: Symbol) => {
    // Update last played symbol
    lastSymbol.current = sym;
    
    // Add to buffer
    buffer.current += sym;
    
    // Play it
    addEvent('play', sym);
    opts.onElement?.(sym);
    opts.playElement?.(sym);
    
    // Schedule word boundary
    scheduleWord();
    
    // Calculate timing based on symbol
    const symbolDuration = sym === '.' ? unit.current : unit.current * 3;
    const gapDuration = unit.current; // 1 unit gap between elements
    const totalDuration = symbolDuration + gapDuration;
    
    log(`Playing ${sym} for ${symbolDuration}ms, followed by ${gapDuration}ms gap`);
    
    // Schedule the next element after this one finishes
    elementTimer.current = window.setTimeout(() => {
      elementTimer.current = null;
      
      // Continue based on current paddle state
      continueSequence();
    }, totalDuration);
  };
  
  // Continue the element sequence based on current paddle state
  const continueSequence = () => {
    // First check if there are queued elements from keypresses during playback
    if (queuedElements.current.length > 0) {
      // Play the first queued element, regardless of current paddle state
      const nextElement = queuedElements.current.shift()!;
      addEvent('from_queue', nextElement);
      log(`Playing queued element: ${nextElement}`);
      playSymbol(nextElement);
      return;
    }
    
    // Log current state
    log(`Continue sequence: dot=${dotHeld.current}, dash=${dashHeld.current}, last=${lastSymbol.current}, queue=${queuedElements.current.length}`);
    
    // Check current paddle state
    if (dotHeld.current && dashHeld.current) {
      // Both paddles held - alternate symbols (squeeze behavior)
      addEvent('squeeze');
      const nextSymbol = lastSymbol.current === '.' ? '-' : '.';
      playSymbol(nextSymbol);
    } 
    else if (dotHeld.current) {
      // Only dot paddle held
      addEvent('continuous', 'dot');
      playSymbol('.');
    } else if (dashHeld.current) {
      // Only dash paddle held
      addEvent('continuous', 'dash');
      playSymbol('-');
    } else {
      // No paddles held - end of sequence
      addEvent('sequence_end');
      scheduleChar();
    }
  };
  
  // Start a new sequence if not already running
  const startSequence = (sym: Symbol) => {
    if (elementTimer.current === null) {
      // If we're starting a new sequence, ensure any pending character timer is cleared
      // This fixes the issue with consecutive characters being merged
      if (charTimer.current !== null) {
        clearTimeout(charTimer.current);
        charTimer.current = null;
        
        // If there's pending content in the buffer, decode it as a character
        if (buffer.current) {
          const code = buffer.current;
          buffer.current = '';
          
          const char = invMorseMap[code] || '';
          if (char) {
            addEvent('char_before_new_sequence', char);
            opts.onCharacter?.(char);
          }
        }
      }
      
      // No element currently playing, start a new sequence
      addEvent('start', sym);
      playSymbol(sym);
    }
    // Otherwise, the current element will finish and continueSequence will check state
  };
  
  // Schedule character decode
  const scheduleChar = () => {
    if (!buffer.current) return;
    
    // Clear any existing timer
    if (charTimer.current !== null) {
      clearTimeout(charTimer.current);
      charTimer.current = null;
    }
    
    addEvent('schedule_char', buffer.current);
    log(`Scheduling character decode for buffer: ${buffer.current}`);
    
    // Schedule decode after 3 unit gap
    charTimer.current = window.setTimeout(() => {
      charTimer.current = null;
      
      // Decode the character
      const code = buffer.current;
      if (!code) return; // Safety check
      
      buffer.current = '';
      
      const char = invMorseMap[code] || '';
      if (char) {
        addEvent('char', char);
        log(`Decoded character: ${char} from ${code}`);
        console.log(`[IAMBIC KEYER] CHARACTER DETECTED: '${char}' from Morse code '${code}'`);
        if (opts.onCharacter) {
          console.log(`[IAMBIC KEYER] Calling onCharacter callback with character: '${char}'`);
          try {
            opts.onCharacter(char);
            console.log(`[IAMBIC KEYER] onCharacter callback executed successfully for '${char}'`);
          } catch (err) {
            console.error(`[IAMBIC KEYER] Error in onCharacter callback:`, err);
          }
        } else {
          console.log(`[IAMBIC KEYER] No onCharacter callback provided`);
        }
      } else {
        log(`No character found for code: ${code}`);
        console.log(`[IAMBIC KEYER] INVALID CODE: No character found for '${code}'`);
        if (opts.onInvalidCharacter) {
          console.log(`[IAMBIC KEYER] Calling onInvalidCharacter callback with code: '${code}'`);
          try {
            opts.onInvalidCharacter(code);
            console.log(`[IAMBIC KEYER] onInvalidCharacter callback executed successfully for '${code}'`);
          } catch (err) {
            console.error(`[IAMBIC KEYER] Error in onInvalidCharacter callback:`, err);
          }
        } else {
          console.log(`[IAMBIC KEYER] No onInvalidCharacter callback provided`);
        }
      }
    }, unit.current * 3);
  };
  
  // Schedule word gap
  const scheduleWord = () => {
    // Clear any existing timer
    if (wordTimer.current !== null) {
      clearTimeout(wordTimer.current);
      wordTimer.current = null;
    }
    
    // Schedule word after 7 unit gap
    wordTimer.current = window.setTimeout(() => {
      wordTimer.current = null;
      console.log(`[IAMBIC KEYER] WORD BOUNDARY DETECTED: After ${unit.current * 7}ms gap`);
      if (opts.onWord) {
        console.log(`[IAMBIC KEYER] Calling onWord callback`);
        try {
          opts.onWord();
          console.log(`[IAMBIC KEYER] onWord callback executed successfully`);
        } catch (err) {
          console.error(`[IAMBIC KEYER] Error in onWord callback:`, err);
        }
      } else {
        console.log(`[IAMBIC KEYER] No onWord callback provided`);
      }
      addEvent('word');
    }, unit.current * 7);
  };
  
  // Queue for explicit paddle presses during element playback
  const queuedElements = useRef<Symbol[]>([]);
  
  // Last keydown timestamp to detect new user action vs. key repeat
  const lastKeyActionTime = useRef<number>(0);
  
  // Key event handlers - these are super simple now!
  const handleKeyDown = (e: KeyboardEvent) => {
    const now = Date.now();
    // We consider this a new user action if it's been more than 1000ms since
    // the last keydown or if it's a different key than was last pressed
    const isNewUserAction = (now - lastKeyActionTime.current) > 1000;
    lastKeyActionTime.current = now;
    
    if (e.key === 'ArrowLeft' || e.code === 'ControlLeft') {
      e.preventDefault();
      
      // Left arrow down = dot paddle press
      if (!dotHeld.current) {
        dotHeld.current = true;
        addEvent('key_down', 'dot');
        
        // For a completely new action (after pause), make sure we've handled
        // any pending character from a previous sequence
        if (isNewUserAction && charTimer.current !== null) {
          log("New user action detected - finalizing pending character");
          clearTimeout(charTimer.current);
          charTimer.current = null;
          
          // Immediately decode any pending character
          if (buffer.current) {
            const code = buffer.current;
            buffer.current = '';
            
            const char = invMorseMap[code] || '';
            if (char) {
              addEvent('immediate_char', char);
              log(`Immediate character: ${char} from ${code}`);
              console.log(`[IAMBIC KEYER] IMMEDIATE CHARACTER: '${char}' from '${code}' (new user action)`);
              if (opts.onCharacter) {
                console.log(`[IAMBIC KEYER] Calling onCharacter callback with immediate character: '${char}'`);
                try {
                  opts.onCharacter(char);
                  console.log(`[IAMBIC KEYER] Immediate onCharacter callback executed successfully for '${char}'`);
                } catch (err) {
                  console.error(`[IAMBIC KEYER] Error in immediate onCharacter callback:`, err);
                }
              } else {
                console.log(`[IAMBIC KEYER] No onCharacter callback provided`);
              }
            }
          }
        }
        
        // If an element is currently playing, queue a dot to play next
        if (elementTimer.current !== null) {
          // Only queue if we don't already have this element queued
          if (!queuedElements.current.includes('.')) {
            queuedElements.current.push('.');
            addEvent('queue', 'dot');
            log('Dot queued to play after current element');
          }
        } else {
          // Start with dot if nothing is playing
          startSequence('.');
        }
      }
    } else if (e.key === 'ArrowRight' || e.code === 'ControlRight') {
      e.preventDefault();
      
      // Right arrow down = dash paddle press
      if (!dashHeld.current) {
        dashHeld.current = true;
        addEvent('key_down', 'dash');
        
        // For a completely new action (after pause), make sure we've handled
        // any pending character from a previous sequence
        if (isNewUserAction && charTimer.current !== null) {
          log("New user action detected - finalizing pending character");
          clearTimeout(charTimer.current);
          charTimer.current = null;
          
          // Immediately decode any pending character
          if (buffer.current) {
            const code = buffer.current;
            buffer.current = '';
            
            const char = invMorseMap[code] || '';
            if (char) {
              addEvent('immediate_char', char);
              log(`Immediate character: ${char} from ${code}`);
              console.log(`[IAMBIC KEYER] IMMEDIATE CHARACTER: '${char}' from '${code}' (new user action)`);
              if (opts.onCharacter) {
                console.log(`[IAMBIC KEYER] Calling onCharacter callback with immediate character: '${char}'`);
                try {
                  opts.onCharacter(char);
                  console.log(`[IAMBIC KEYER] Immediate onCharacter callback executed successfully for '${char}'`);
                } catch (err) {
                  console.error(`[IAMBIC KEYER] Error in immediate onCharacter callback:`, err);
                }
              } else {
                console.log(`[IAMBIC KEYER] No onCharacter callback provided`);
              }
            }
          }
        }
        
        // If an element is currently playing, queue a dash to play next
        if (elementTimer.current !== null) {
          // Only queue if we don't already have this element queued
          if (!queuedElements.current.includes('-')) {
            queuedElements.current.push('-');
            addEvent('queue', 'dash');
            log('Dash queued to play after current element');
          }
        } else {
          // Start with dash if nothing is playing
          startSequence('-');
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      clear();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newWpm = Math.min(opts.maxWpm || 40, wpm.current + 1);
      setWpm(newWpm);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newWpm = Math.max(opts.minWpm || 5, wpm.current - 1);
      setWpm(newWpm);
    }
  };
  
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.code === 'ControlLeft') {
      e.preventDefault();
      
      // Left arrow up = dot paddle release
      dotHeld.current = false;
      addEvent('key_up', 'dot');
      
      // Note: We don't remove from the queue on key up - 
      // If the key was pressed during element playback, 
      // we want to play the queued element even if released
      
      // If both paddles released and nothing playing, schedule char decode
      if (!dashHeld.current && elementTimer.current === null && buffer.current) {
        scheduleChar();
      }
    } else if (e.key === 'ArrowRight' || e.code === 'ControlRight') {
      e.preventDefault();
      
      // Right arrow up = dash paddle release
      dashHeld.current = false;
      addEvent('key_up', 'dash');
      
      // Note: We don't remove from the queue on key up - 
      // If the key was pressed during element playback, 
      // we want to play the queued element even if released
      
      // If both paddles released and nothing playing, schedule char decode
      if (!dotHeld.current && elementTimer.current === null && buffer.current) {
        scheduleChar();
      }
    }
  };
  
  // Install/uninstall functions
  const install = () => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    addEvent('install');
  };
  
  const uninstall = () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    clear();
    addEvent('uninstall');
  };
  
  // Clear state
  const clear = () => {
    buffer.current = '';
    queuedElements.current = [];
    
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
    
    addEvent('clear');
  };
  
  // Set initial WPM
  useEffect(() => {
    setWpm(opts.wpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.wpm]);
  
  // Create return object with debug for development
  const keyer: IambicKeyer = {
    install,
    uninstall,
    clear
  };
  
  // Add debug info in development
  if (process.env.NODE_ENV === 'development') {
    keyer.debug = {
      dotHeld: dotHeld.current,
      dashHeld: dashHeld.current,
      buffer: buffer.current,
      lastSymbol: lastSymbol.current,
      wpm: wpm.current,
      isActive: true,
      addEvent: (event) => addEvent(event.type, event.value)
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
        }
      }, 50);
      
      return () => clearInterval(interval);
    }, [keyer]);
  }
  
  return keyer;
}