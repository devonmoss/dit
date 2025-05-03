import React, { useEffect } from 'react';
import { render, cleanup } from '@testing-library/react';
import { useIambicKeyer, IambicKeyerOptions } from '../hooks/useIambicKeyer';

// Helper test component to install/uninstall the keyer
function TestComp(opts: IambicKeyerOptions) {
  const keyer = useIambicKeyer(opts);
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
    const unit = 1200 / 20; // wpm = 20

    render(<TestComp
      wpm={20}
      onElement={onElement}
      playElement={playElement}
      onCharacter={onCharacter}
      onWord={onWord}
    />);
    // Press and release dot (to avoid auto-repeat interfering with timing)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    expect(onElement).toHaveBeenCalledWith('.');
    expect(playElement).toHaveBeenCalledWith('.');
    // Before char gap, no character yet
    jest.advanceTimersByTime(unit * 2);
    expect(onCharacter).not.toHaveBeenCalled();
    // Advance to char gap
    jest.advanceTimersByTime(unit);
    expect(onCharacter).toHaveBeenCalledWith('e');
    // Advance to word gap (7 units total)
    jest.advanceTimersByTime(unit * (7 - 3));
    expect(onWord).toHaveBeenCalled();
  });


  it('clear() stops pending decode', () => {
    const onCharacter = jest.fn();
    const opts = { wpm: 20, onCharacter };
    let clearFn: () => void = () => {};
    function ClearComp() {
      const keyer = useIambicKeyer(opts);
      clearFn = keyer.clear;
      useEffect(() => { keyer.install(); return () => keyer.uninstall(); }, []);
      return null;
    }
    render(<ClearComp />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    clearFn();
    jest.advanceTimersByTime((1200 / 20) * 3);
    expect(onCharacter).not.toHaveBeenCalled();
  });

});