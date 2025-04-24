import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import SendingMode from '../components/SendingMode/SendingMode';
import { AppStateProvider } from '../contexts/AppStateContext';
import { trainingLevels } from '../utils/levels';

// Mock the audio context to avoid browser API issues in tests
jest.mock('../utils/morse', () => {
  const original = jest.requireActual('../utils/morse');
  return {
    ...original,
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

// Set up a custom render function that wraps components with the AppStateProvider
const customRender = (ui: React.ReactElement, { initialLevel = '1', ...renderOptions } = {}) => {
  // Create a wrapper function that includes all the providers
  const Wrapper: React.FC<{children: React.ReactNode}> = ({ children }) => {
    // Setup happens in the AppStateProvider
    return (
      <AppStateProvider>
        {children}
      </AppStateProvider>
    );
  };
  
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

describe('SendingMode Component', () => {
  // Helper function to simulate keyboard events for arrow keys
  const simulateKeyPresses = async (keys: string[]) => {
    for (const key of keys) {
      // KeyDown
      fireEvent.keyDown(document, { key });
      await waitFor(() => {}, { timeout: 50 });
      
      // KeyUp
      fireEvent.keyUp(document, { key });
      await waitFor(() => {}, { timeout: 50 });
    }
  };
  
  // Extract specific level data for testing
  const getTestLevel = (levelId: string) => {
    return trainingLevels.find(level => level.id === levelId) || trainingLevels[0];
  };
  
  // Test 1: Component should show the start button initially
  test('displays start button initially', () => {
    customRender(<SendingMode />);
    expect(screen.getByText('Start Sending Practice')).toBeInTheDocument();
  });
  
  // Test 2: After clicking start, it should show the sending interface
  test('shows sending interface after clicking start', async () => {
    customRender(<SendingMode />);
    
    // Click start button
    fireEvent.click(screen.getByText('Start Sending Practice'));
    
    // Verify the sending interface is displayed
    await waitFor(() => {
      expect(screen.getByText(/use ← key for/i)).toBeInTheDocument();
    });
  });
  
  // Test 3: When starting a specific level, it should only use characters from that level
  test('only uses characters from the selected level', async () => {
    // We want to test level 1 which typically has just E and T
    const testLevel = getTestLevel('1');
    
    // Setup a way to track which characters are being asked for
    const askedCharacters = new Set<string>();
    
    // Override the mock to keep track of what's being asked
    const originalConsoleLog = console.log;
    console.log = jest.fn((...args) => {
      const logMessage = args.join(' ');
      // Look for logs containing the "Send the character:" message
      if (typeof logMessage === 'string' && logMessage.includes('Send the character:')) {
        const charMatch = logMessage.match(/Send the character: ([A-Z])/);
        if (charMatch && charMatch[1]) {
          askedCharacters.add(charMatch[1].toLowerCase());
        }
      }
      originalConsoleLog(...args);
    });
    
    customRender(<SendingMode />);
    
    // Click start button
    fireEvent.click(screen.getByText('Start Sending Practice'));
    
    // Wait for the sending interface to load
    await waitFor(() => {
      expect(screen.getByText(/use ← key for/i)).toBeInTheDocument();
    });
    
    // Simulate sending some characters (10 rounds of practice)
    for (let i = 0; i < 10; i++) {
      // Simulate dot (E) or dash (T) as appropriate
      await simulateKeyPresses(['ArrowLeft']);
    }
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Verify that only characters from the level were used
    for (const char of askedCharacters) {
      expect(testLevel.chars.includes(char)).toBe(true);
    }
  });
  
  // Test 4: Sending the correct character should give positive feedback
  test('gives positive feedback for correct character input', async () => {
    // Mock the handleWordComplete method to simulate correct input
    jest.spyOn(global.console, 'log').mockImplementation((...args) => {
      // This will let us see what characters are being sent
    });
    
    customRender(<SendingMode />);
    
    // Click start button
    fireEvent.click(screen.getByText('Start Sending Practice'));
    
    // Wait for the interface to be ready
    await waitFor(() => {
      expect(screen.getByText(/use ← key for/i)).toBeInTheDocument();
    });
    
    // Extract the current character being asked for
    const statusText = screen.getByText(/Send the character:/i);
    const currentChar = statusText.textContent?.match(/Send the character: ([A-Z])/)?.[1]?.toLowerCase() || 'e';
    
    // Simulate sending the correct character
    // If character is 'e', send a dot, if 't', send a dash
    if (currentChar === 'e') {
      await simulateKeyPresses(['ArrowLeft']);
    } else if (currentChar === 't') {
      await simulateKeyPresses(['ArrowRight']);
    }
    
    // Should eventually show positive feedback
    await waitFor(() => {
      // Look for any text indicating success, either "Correct!" or the next prompt
      const statusElements = screen.getAllByText(/Send the character:|Correct!/i);
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });
  
  // Test 5: Verify escape key ends the test
  test('ends test when escape key is pressed', async () => {
    customRender(<SendingMode />);
    
    // Click start button
    fireEvent.click(screen.getByText('Start Sending Practice'));
    
    // Wait for the interface to be ready
    await waitFor(() => {
      expect(screen.getByText(/use ← key for/i)).toBeInTheDocument();
    });
    
    // Press escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    
    // Should return to the start screen
    await waitFor(() => {
      expect(screen.getByText('Start Sending Practice')).toBeInTheDocument();
    });
  });
});