import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopMenu from '../components/TopMenu/TopMenu';
import TrainingMode from '../components/TrainingMode/TrainingMode';
import SendingMode from '../components/SendingMode/SendingMode';
import { AppStateProvider, useAppState } from '../contexts/AppStateContext';
import { trainingLevels } from '../utils/levels';

// Mock the audio context
jest.mock('../utils/morse', () => {
  const originalModule = jest.requireActual('../utils/morse');
  return {
    ...originalModule,
    isBrowser: true,
    createAudioContext: () => ({
      playSymbol: jest.fn().mockResolvedValue(undefined),
      playMorse: jest.fn().mockResolvedValue(undefined),
      playErrorSound: jest.fn().mockResolvedValue(undefined),
      playTone: jest.fn().mockResolvedValue(undefined),
      setVolume: jest.fn(),
      setWpm: jest.fn(),
      getRawContext: jest.fn().mockReturnValue({
        createOscillator: jest.fn().mockReturnValue({
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          frequency: { value: 0 },
          type: 'sine'
        }),
        destination: {}
      })
    })
  };
});

// Create a test wrapper component that can access AppState
const TestWrapper = () => {
  const { state, selectLevel } = useAppState();
  
  return (
    <div>
      <div data-testid="selected-level-id">{state.selectedLevelId}</div>
      <div data-testid="level-chars">{state.chars.join('')}</div>
      <div data-testid="test-active">{state.testActive ? 'true' : 'false'}</div>
      <button 
        data-testid="select-level-1" 
        onClick={() => selectLevel('1')}
      >
        Select Level 1
      </button>
      <button 
        data-testid="select-level-2" 
        onClick={() => selectLevel('2')}
      >
        Select Level 2
      </button>
      <button 
        data-testid="select-level-3" 
        onClick={() => selectLevel('3')}
      >
        Select Level 3
      </button>
      <TopMenu />
      {state.mode === 'copy' ? <TrainingMode /> : <SendingMode />}
    </div>
  );
};

// Custom render function with AppStateProvider
const customRender = (ui, options = {}) => {
  return render(
    <AppStateProvider>
      {ui}
    </AppStateProvider>,
    options
  );
};

describe('Level Selection and Character Sets', () => {
  // Test 1: Verify level selection updates the character set
  test('selecting a level updates the character set correctly', async () => {
    customRender(<TestWrapper />);
    
    // Get initial level info
    const initialLevelId = screen.getByTestId('selected-level-id').textContent;
    const initialChars = screen.getByTestId('level-chars').textContent;
    
    // Select Level 2
    fireEvent.click(screen.getByTestId('select-level-2'));
    
    // Wait for state update
    await waitFor(() => {
      const level2 = trainingLevels.find(l => l.id === '2');
      if (level2) {
        expect(screen.getByTestId('selected-level-id').textContent).toBe('2');
        // Chars won't be updated until a test is started
        expect(screen.getByTestId('test-active').textContent).toBe('false');
      }
    });
    
    // Find buttons that would start a test
    const startCopyButton = screen.getByText('Start', { exact: false });
    
    // Start the test (in copy mode by default)
    fireEvent.click(startCopyButton);
    
    // Verify the character set matches Level 2
    await waitFor(() => {
      const level2 = trainingLevels.find(l => l.id === '2');
      if (level2) {
        expect(screen.getByTestId('test-active').textContent).toBe('true');
        
        // Now characters should be updated to level 2
        const updatedChars = screen.getByTestId('level-chars').textContent;
        expect(updatedChars).not.toBe(initialChars);
        
        // Verify each character in the rendered set is from level 2's charset
        for (const char of updatedChars) {
          expect(level2.chars.includes(char)).toBe(true);
        }
      }
    });
  });
  
  // Test 2: Verify that switching between copy and send mode preserves the level
  test('switching between copy and send mode preserves the selected level', async () => {
    customRender(<TestWrapper />);
    
    // Select Level 3
    fireEvent.click(screen.getByTestId('select-level-3'));
    
    // Wait for level selection to update
    await waitFor(() => {
      expect(screen.getByTestId('selected-level-id').textContent).toBe('3');
    });
    
    // Switch to send mode
    const sendModeRadio = screen.getByLabelText('send');
    fireEvent.click(sendModeRadio);
    
    // Verify level is still the same
    expect(screen.getByTestId('selected-level-id').textContent).toBe('3');
    
    // Start a send test
    const startSendButton = screen.getByText('Start Sending Practice');
    fireEvent.click(startSendButton);
    
    // Verify the test is active and using Level 3 characters
    await waitFor(() => {
      expect(screen.getByTestId('test-active').textContent).toBe('true');
      
      const level3 = trainingLevels.find(l => l.id === '3');
      if (level3) {
        const currentChars = screen.getByTestId('level-chars').textContent;
        // Verify each character in the current set is from level 3's charset
        for (const char of currentChars) {
          expect(level3.chars.includes(char)).toBe(true);
        }
      }
    });
  });
  
  // Test 3: Verify that test characters are limited to the selected level
  test('test only uses characters from the selected level', async () => {
    customRender(<TestWrapper />);
    
    // Select Level 1 (typically just E and T)
    fireEvent.click(screen.getByTestId('select-level-1'));
    
    // Wait for level selection to update
    await waitFor(() => {
      expect(screen.getByTestId('selected-level-id').textContent).toBe('1');
    });
    
    // Start a test
    const startButton = screen.getByText('Start', { exact: false });
    fireEvent.click(startButton);
    
    // Verify the test is active
    await waitFor(() => {
      expect(screen.getByTestId('test-active').textContent).toBe('true');
    });
    
    // Check the character set matches Level 1
    const level1 = trainingLevels.find(l => l.id === '1');
    if (level1) {
      const currentChars = screen.getByTestId('level-chars').textContent;
      
      // The character set should only contain characters from Level 1
      expect(currentChars.length).toBeGreaterThan(0);
      
      // Each character should be in Level 1's character set
      for (const char of currentChars) {
        expect(level1.chars.includes(char)).toBe(true);
      }
      
      // The character set should not include any characters not in Level 1
      const allOtherChars = trainingLevels
        .filter(l => l.id !== '1')
        .flatMap(l => l.chars)
        .filter(c => !level1.chars.includes(c));
      
      for (const char of allOtherChars) {
        expect(currentChars.includes(char)).toBe(false);
      }
    }
  });
});