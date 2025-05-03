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
}

export function useIambicKeyer(opts: IambicKeyerOptions): IambicKeyer {
  const wpmRef = useRef<number>(opts.wpm);
  const minWpm = opts.minWpm ?? 5;
  const maxWpm = opts.maxWpm ?? 40;
  const unitRef = useRef<number>(1200 / opts.wpm);

  // Buffer and timers for decoding
  const bufferRef = useRef<string>('');
  const charTimer = useRef<number | null>(null);
  const wordTimer = useRef<number | null>(null);
  // Timer for recursive element cycling
  const cycleTimer = useRef<number | null>(null);
  // Flags for held paddles
  const dotHeld = useRef(false);
  const dashHeld = useRef(false);

  // Helper to update unit when wpm changes
  const updateUnit = (newWpm: number) => {
    wpmRef.current = newWpm;
    unitRef.current = 1200 / newWpm;
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSendWpm', String(newWpm));
    }
    opts.onWpmChange?.(newWpm);
  };

  // Decode buffered symbols into a character
  const decodeChar = () => {
    const code = bufferRef.current;
    bufferRef.current = '';
    const char = invMorseMap[code] || '';
    if (char) opts.onCharacter?.(char);
  };

  // Schedule a word boundary (7 units)
  const scheduleWord = () => {
    if (wordTimer.current != null) clearTimeout(wordTimer.current);
    wordTimer.current = window.setTimeout(() => {
      opts.onWord?.();
    }, unitRef.current * 7);
  };

  // Schedule character decode (3 units)
  const scheduleChar = () => {
    if (charTimer.current != null) clearTimeout(charTimer.current);
    charTimer.current = window.setTimeout(() => {
      decodeChar();
    }, unitRef.current * 3);
  };

  // Recursive cycle function for a held paddle
  const cycleEmit = (sym: Symbol) => {
    // Emit the symbol
    opts.onElement?.(sym);
    opts.playElement?.(sym);
    // Append to buffer
    bufferRef.current += sym;
    // Schedule word gap after this element
    scheduleWord();
    // Determine durations
    const unit = unitRef.current;
    const symbolDur = sym === '.' ? unit : unit * 3;
    const cycleDur = symbolDur + unit;
    // Schedule next cycle if paddle still held
    cycleTimer.current = window.setTimeout(() => {
      // Determine next symbol based on iambic paddle holds
      let next: Symbol | null = null;
      if (dotHeld.current && dashHeld.current) {
        // Both paddles held: alternate
        next = sym === '.' ? '-' : '.';
      } else if (sym === '.' && dotHeld.current) {
        // Continue same paddle
        next = '.';
      } else if (sym === '-' && dashHeld.current) {
        next = '-';
      }
      if (next) {
        cycleEmit(next);
      }
    }, cycleDur);
  };

  // Key event handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    // Speed control
    // Morse paddles
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!dotHeld.current) {
        dotHeld.current = true;
        if (cycleTimer.current != null) clearTimeout(cycleTimer.current);
        cycleEmit('.');
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!dashHeld.current) {
        dashHeld.current = true;
        if (cycleTimer.current != null) clearTimeout(cycleTimer.current);
        cycleEmit('-');
      }
      return;
    }
    // Clear buffer on Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      bufferRef.current = '';
      if (charTimer.current != null) clearTimeout(charTimer.current);
      if (wordTimer.current != null) clearTimeout(wordTimer.current);
      return;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      dotHeld.current = false;
    }
    if (e.key === 'ArrowRight') {
      dashHeld.current = false;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && cycleTimer.current != null) {
      clearTimeout(cycleTimer.current);
      cycleTimer.current = null;
      // On release, schedule character decode
      scheduleChar();
    }
  };

  const install = () => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  };

  const uninstall = () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    bufferRef.current = '';
    if (charTimer.current != null) clearTimeout(charTimer.current);
    if (wordTimer.current != null) clearTimeout(wordTimer.current);
    if (cycleTimer.current != null) clearTimeout(cycleTimer.current);
    dotHeld.current = dashHeld.current = false;
  };

  const clear = () => {
    bufferRef.current = '';
    if (charTimer.current != null) clearTimeout(charTimer.current);
    if (wordTimer.current != null) clearTimeout(wordTimer.current);
    if (cycleTimer.current != null) clearTimeout(cycleTimer.current);
    dotHeld.current = dashHeld.current = false;
  };

  // Update unit if opts.wpm prop changes
  useEffect(() => {
    updateUnit(opts.wpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.wpm]);

  return { install, uninstall, clear };
}