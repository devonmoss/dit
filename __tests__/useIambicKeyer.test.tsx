import React, { useEffect } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { useIambicKeyer, IambicKeyerOptions } from '../hooks/useIambicKeyer';

// Helper test component to install/uninstall the keyer
function TestComp({ onElement, playElement, onCharacter, onWord, wpm }: IambicKeyerOptions) {
  const keyer = useIambicKeyer({ onElement, playElement, onCharacter, onWord, wpm });
  useEffect(() => {
    keyer.install();
    return () => { keyer.uninstall(); };
  }, [keyer]);
  return null;
}

describe('useIambicKeyer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    cleanup();
    // Ensure localStorage mock
    window.localStorage.clear();
  });
  
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('emits elements, decodes char and word events', () => {
    const onElement = jest.fn();
    const playElement = jest.fn();
    const onCharacter = jest.fn();
    const onWord = jest.fn();
    const wpm = 20;
    const unit = 1200 / wpm; // 60ms per unit at 20 WPM

    // Render with all callbacks
    render(
      <TestComp
        wpm={wpm}
        onElement={onElement}
        playElement={playElement}
        onCharacter={onCharacter}
        onWord={onWord}
      />
    );
    
    // Press and release dot to avoid auto-repeat
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    });
    
    // Element handlers should be called immediately
    expect(onElement).toHaveBeenCalledWith('.');
    expect(playElement).toHaveBeenCalledWith('.');
    
    // Character detection happens after element playback + 3 units
    // Element playback (.): 1 unit for dot + 1 unit for gap = 2 units
    // Character timeout: 3 units
    act(() => {
      // Advance past element playback (2 units)
      jest.advanceTimersByTime(unit * 2);
      
      // Advance through character timeout (3 units)
      jest.advanceTimersByTime(unit * 3);
    });
    
    // Now onCharacter should have been called
    expect(onCharacter).toHaveBeenCalledWith('e');
    
    // Word boundary happens 7 units after last element
    act(() => {
      // Already advanced 5 units (2 for element, 3 for char)
      // Need 2 more to reach word boundary
      jest.advanceTimersByTime(unit * 2);
    });
    
    // Word callback should be called
    expect(onWord).toHaveBeenCalled();
  });

  it('clear() stops pending decode', () => {
    const onCharacter = jest.fn();
    const opts = { wpm: 20, onCharacter };
    let clearFn: () => void = () => {};
    
    function ClearComp() {
      const keyer = useIambicKeyer(opts);
      clearFn = keyer.clear;
      useEffect(() => { 
        keyer.install(); 
        return () => keyer.uninstall(); 
      }, [keyer]);
      return null;
    }
    
    render(<ClearComp />);
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    });
    
    act(() => {
      clearFn();
    });
    
    act(() => {
      // Advance past both element playback and character timeout
      jest.advanceTimersByTime((1200 / 20) * 5);
    });
    
    expect(onCharacter).not.toHaveBeenCalled();
  });
});