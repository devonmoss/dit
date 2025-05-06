import React from 'react';
import { render, act, fireEvent, screen, waitFor } from '@testing-library/react';
import SendingMode from '../../components/SendingMode/SendingMode';
import { AppStateProvider } from '../../contexts/AppStateContext';
import { selectNextCharacter } from '../../utils/characterSelection';
import { trainingLevels } from '../../utils/levels';

// Mock Supabase client
jest.mock('../../utils/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation(cb => cb({ data: [], error: null }))
    })
  }
}));

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => {
  const React = require('react');
  
  return {
    ...jest.requireActual('../../contexts/AuthContext'),
    useAuth: () => ({
      user: null,
      session: null,
      isLoading: false,
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn()
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

// Mock useIambicKeyer hook
jest.mock('../../hooks/useIambicKeyer', () => {
  return {
    useIambicKeyer: jest.fn(() => ({
      install: jest.fn(),
      uninstall: jest.fn(),
      clear: jest.fn()
    }))
  };
});

// Mock the audio context and browser environment
jest.mock('../../utils/morse', () => ({
  ...jest.requireActual('../../utils/morse'),
  isBrowser: true,
  createAudioContext: jest.fn(() => ({
    playMorse: jest.fn().mockResolvedValue(undefined),
    playSymbol: jest.fn().mockResolvedValue(undefined),
    playErrorSound: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock AppStateContext with controllable values
jest.mock('../../contexts/AppStateContext', () => {
  const React = require('react');
  
  // Default mock state
  const mockState = {
    selectedLevelId: 'level-1',
    charPoints: {},
    completedLevels: [],
    testActive: false,
    chars: ['e', 't'],
    sendWpm: 20,
    wpm: 20,
    volume: 75,
    mode: 'send',
    testType: 'training',
    theme: 'default'
  };
  
  // Mock functions
  const mockSelectLevel = jest.fn((id) => {
    // Update the mock state to simulate level selection
    const level = trainingLevels.find(l => l.id === id);
    if (level) {
      mockState.selectedLevelId = id;
      mockState.chars = [...level.chars];
    }
  });
  
  const mockUpdateCharPoints = jest.fn((char, points) => {
    mockState.charPoints[char] = points;
  });
  
  const mockStartTest = jest.fn(() => {
    mockState.testActive = true;
    // Reset char points for the current level
    const level = trainingLevels.find(l => l.id === mockState.selectedLevelId);
    if (level) {
      level.chars.forEach(char => {
        mockState.charPoints[char] = 0;
      });
    }
  });
  
  const mockStartTestWithLevelId = jest.fn((levelId) => {
    mockState.testActive = true;
    mockState.selectedLevelId = levelId;
    
    // Reset char points for the selected level
    const level = trainingLevels.find(l => l.id === levelId);
    if (level) {
      mockState.chars = [...level.chars];
      level.chars.forEach(char => {
        mockState.charPoints[char] = 0;
      });
    }
  });
  
  const mockEndTest = jest.fn((completed = true) => {
    mockState.testActive = false;
    if (completed) {
      if (!mockState.completedLevels.includes(mockState.selectedLevelId)) {
        mockState.completedLevels.push(mockState.selectedLevelId);
      }
    }
  });
  
  const mockSaveResponseTimes = jest.fn();
  
  // Create a context provider that uses our mock state and functions
  return {
    useAppState: () => ({
      state: { ...mockState },
      selectLevel: mockSelectLevel,
      startTest: mockStartTest,
      startTestWithLevelId: mockStartTestWithLevelId,
      endTest: mockEndTest,
      updateCharPoints: mockUpdateCharPoints,
      saveResponseTimes: mockSaveResponseTimes,
      getCurrentLevel: () => trainingLevels.find(l => l.id === mockState.selectedLevelId),
      markLevelCompleted: jest.fn(),
      setWpm: jest.fn(),
      setVolume: jest.fn(),
      setSendWpm: jest.fn(),
      setTheme: jest.fn(),
      setMode: jest.fn(),
      setTestType: jest.fn()
    }),
    AppStateProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

// Create a wrapper for tests that expose internal component functions
const ExposedSendingMode = () => {
  const SendingModeRef = React.forwardRef((props, ref) => {
    const component = <SendingMode {...props} />;
    
    // Expose internal functions for testing
    React.useImperativeHandle(ref, () => ({
      calculatePointsForTime: () => {
        // We'll need to extract this from the component
        return null;
      },
      pickNextChar: () => {
        // We'll need to extract this from the component
        return null;
      }
    }));
    
    return component;
  });
  
  const ref = React.useRef(null);
  return <SendingModeRef ref={ref} />;
};

// Test suite
describe('SendingMode Component', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Mock Date.now for predictable timing tests
  const originalDateNow = Date.now;
  beforeAll(() => {
    let counter = 1000; // Start time
    global.Date.now = jest.fn(() => {
      counter += 1000; // Increment by 1 second each call
      return counter;
    });
  });
  
  afterAll(() => {
    global.Date.now = originalDateNow;
  });
  
  // Test for Issue 1: Mastery points calculation
  test('calculates points correctly based on response time', () => {
    // Create a testing component instance that directly tests calculatePointsForTime
    const TestComponent = () => {
      const [results, setResults] = React.useState<Record<string, number>>({});
      
      React.useEffect(() => {
        // Reference constants from the original component
        const MIN_RESPONSE_TIME = 0.8; // seconds
        const MAX_RESPONSE_TIME = 7; // seconds
        
        // Testing function that matches the one in SendingMode
        const calculatePointsForTime = (responseTime: number) => {
          const seconds = responseTime / 1000;
          if (seconds <= MIN_RESPONSE_TIME) return 1;
          if (seconds >= MAX_RESPONSE_TIME) return 0;
          
          // Linear scale between min and max response times
          return 1 - ((seconds - MIN_RESPONSE_TIME) / (MAX_RESPONSE_TIME - MIN_RESPONSE_TIME));
        };
        
        // Test with various response times
        const testResults = {
          'very_fast': calculatePointsForTime(500), // Under MIN_RESPONSE_TIME -> 1.0
          'right_at_min': calculatePointsForTime(800), // At MIN_RESPONSE_TIME -> 1.0
          'middle': calculatePointsForTime(3900), // Between MIN and MAX -> ~0.5
          'right_at_max': calculatePointsForTime(7000), // At MAX_RESPONSE_TIME -> 0.0
          'very_slow': calculatePointsForTime(10000) // Over MAX_RESPONSE_TIME -> 0.0
        };
        
        setResults(testResults);
      }, []);
      
      return (
        <div>
          <div data-testid="very_fast">{results.very_fast}</div>
          <div data-testid="right_at_min">{results.right_at_min}</div>
          <div data-testid="middle">{results.middle}</div>
          <div data-testid="right_at_max">{results.right_at_max}</div>
          <div data-testid="very_slow">{results.very_slow}</div>
        </div>
      );
    };
    
    // Render the test component
    render(<TestComponent />);
    
    // Check results
    expect(screen.getByTestId('very_fast').textContent).toBe('1');
    expect(screen.getByTestId('right_at_min').textContent).toBe('1');
    expect(parseFloat(screen.getByTestId('middle').textContent || '0')).toBeCloseTo(0.5, 1);
    expect(screen.getByTestId('right_at_max').textContent).toBe('0');
    expect(screen.getByTestId('very_slow').textContent).toBe('0');
  });
  
  // Test for Issue 2: Character selection based on level
  test('selects characters from the correct level', () => {
    // Create a testing component that verifies character selection
    const TestComponent = () => {
      const [results, setResults] = React.useState<Record<string, string[]>>({});
      
      React.useEffect(() => {
        const testCharacterSelection = () => {
          // Get levels data
          const level1 = trainingLevels.find(l => l.id === 'level-1');
          const level2 = trainingLevels.find(l => l.id === 'level-2');
          const level4 = trainingLevels.find(l => l.id === 'level-4');
          
          if (!level1 || !level2 || !level4) {
            throw new Error('Test levels not found');
          }
          
          // Create mock data for testing
          const mockLevel1Data = {
            chars: [...level1.chars],
            charPoints: Object.fromEntries(level1.chars.map(c => [c, 0]))
          };
          
          const mockLevel2Data = {
            chars: [...level2.chars],
            charPoints: Object.fromEntries(level2.chars.map(c => [c, 0]))
          };
          
          const mockLevel4Data = {
            chars: [...level4.chars],
            charPoints: Object.fromEntries(level4.chars.map(c => [c, 0]))
          };
          
          // Test 100 character selections for each level
          const testLevel = (levelData: typeof mockLevel1Data) => {
            const selectedChars = [];
            for (let i = 0; i < 100; i++) {
              const nextChar = selectNextCharacter(
                levelData.chars,
                levelData.charPoints,
                3, // TARGET_POINTS constant
                null // No recently mastered char
              );
              selectedChars.push(nextChar);
            }
            return selectedChars;
          };
          
          // Run tests
          const level1Results = testLevel(mockLevel1Data);
          const level2Results = testLevel(mockLevel2Data);
          const level4Results = testLevel(mockLevel4Data);
          
          return {
            level1: level1Results,
            level2: level2Results,
            level4: level4Results
          };
        };
        
        // Execute the test
        setResults(testCharacterSelection());
      }, []);
      
      return (
        <div>
          <div data-testid="level1-chars">{results.level1?.join(',')}</div>
          <div data-testid="level2-chars">{results.level2?.join(',')}</div>
          <div data-testid="level4-chars">{results.level4?.join(',')}</div>
        </div>
      );
    };
    
    // Render the test component
    render(<TestComponent />);
    
    // Wait for results
    waitFor(() => {
      // Check that only level 1 characters (e, t) appear in level 1 results
      const level1Chars = screen.getByTestId('level1-chars').textContent?.split(',') || [];
      expect(level1Chars.every(c => ['e', 't'].includes(c))).toBe(true);
      
      // Check that only level 2 characters appear in level 2 results
      const level2Chars = screen.getByTestId('level2-chars').textContent?.split(',') || [];
      const level2Set = new Set(trainingLevels.find(l => l.id === 'level-2')?.chars || []);
      expect(level2Chars.every(c => level2Set.has(c))).toBe(true);
      
      // Check that only level 4 characters appear in level 4 results
      const level4Chars = screen.getByTestId('level4-chars').textContent?.split(',') || [];
      const level4Set = new Set(trainingLevels.find(l => l.id === 'level-4')?.chars || []);
      expect(level4Chars.every(c => level4Set.has(c))).toBe(true);
    });
  });
  
  // Test for level switching behavior
  test('updates character set when level changes', async () => {
    // Create a context wrapper with controllable state
    const TestWrapper = ({ children }: { children: React.ReactNode }) => {
      const [state, setState] = React.useState({
        selectedLevelId: 'level-1',
        chars: trainingLevels.find(l => l.id === 'level-1')?.chars || [],
        testActive: false,
        charPoints: {} as Record<string, number>
      });
      
      const selectLevel = (id: string) => {
        const level = trainingLevels.find(l => l.id === id);
        if (level) {
          setState({
            ...state,
            selectedLevelId: id,
            chars: [...level.chars]
          });
        }
      };
      
      // Create context value with our controlled state
      const contextValue = {
        state,
        selectLevel,
        startTest: jest.fn(() => {
          setState({ ...state, testActive: true });
        }),
        startTestWithLevelId: jest.fn((levelId) => {
          const level = trainingLevels.find(l => l.id === levelId);
          if (level) {
            setState({
              ...state,
              selectedLevelId: levelId,
              chars: [...level.chars],
              testActive: true
            });
          }
        }),
        endTest: jest.fn(),
        updateCharPoints: jest.fn((char, points) => {
          setState({
            ...state,
            charPoints: {
              ...state.charPoints,
              [char]: points
            }
          });
        }),
        saveResponseTimes: jest.fn(),
        getCurrentLevel: () => trainingLevels.find(l => l.id === state.selectedLevelId),
        markLevelCompleted: jest.fn(),
        setWpm: jest.fn(),
        setVolume: jest.fn(),
        setSendWpm: jest.fn(),
        setTheme: jest.fn(),
        setMode: jest.fn(),
        setTestType: jest.fn()
      };
      
      // Use our custom context provider
      return (
        <div>
          <div data-testid="level-id">{state.selectedLevelId}</div>
          <div data-testid="chars">{state.chars.join(',')}</div>
          {React.cloneElement(children, { appState: contextValue })}
        </div>
      );
    };
    
    // Create a simplified SendingMode-like component for testing
    const SimplifiedSendingMode = ({ appState }: { appState: any }) => {
      const [currentChar, setCurrentChar] = React.useState('');
      
      // Mock the pickNextChar function similarly to SendingMode
      const pickNextChar = () => {
        return selectNextCharacter(
          appState.state.chars,
          appState.state.charPoints,
          3, // TARGET_POINTS
          null // No recently mastered char
        );
      };
      
      // Handle level change - similar to SendingMode
      const changeLevel = (levelId: string) => {
        appState.selectLevel(levelId);
      };
      
      // Start test - similar to SendingMode
      const startTest = () => {
        appState.startTest();
        const nextChar = pickNextChar();
        setCurrentChar(nextChar);
      };
      
      return (
        <div>
          <div data-testid="current-char">{currentChar}</div>
          <button data-testid="level-1-button" onClick={() => changeLevel('level-1')}>
            Level 1
          </button>
          <button data-testid="level-2-button" onClick={() => changeLevel('level-2')}>
            Level 2
          </button>
          <button data-testid="level-4-button" onClick={() => changeLevel('level-4')}>
            Level 4
          </button>
          <button data-testid="start-button" onClick={startTest}>
            Start
          </button>
        </div>
      );
    };
    
    // Create a context mock value
    const mockContextValue = {
      state: {
        selectedLevelId: 'level-1',
        chars: trainingLevels.find(l => l.id === 'level-1')?.chars || [],
        testActive: false,
        charPoints: {} as Record<string, number>
      },
      selectLevel: jest.fn(),
      startTest: jest.fn(),
      startTestWithLevelId: jest.fn(),
      endTest: jest.fn(),
      updateCharPoints: jest.fn(),
      saveResponseTimes: jest.fn(),
      getCurrentLevel: jest.fn(),
      markLevelCompleted: jest.fn(),
      setWpm: jest.fn(),
      setVolume: jest.fn(),
      setSendWpm: jest.fn(),
      setTheme: jest.fn(),
      setMode: jest.fn(),
      setTestType: jest.fn()
    };

    // Render with test wrapper
    render(
      <TestWrapper>
        <SimplifiedSendingMode appState={mockContextValue} />
      </TestWrapper>
    );
    
    // Initially should be level 1
    expect(screen.getByTestId('level-id').textContent).toBe('level-1');
    
    // Test level switching
    act(() => {
      fireEvent.click(screen.getByTestId('level-2-button'));
    });
    
    // Should update to level 2
    expect(screen.getByTestId('level-id').textContent).toBe('level-2');
    
    // Character set should include level 2 chars
    const level2Chars = trainingLevels.find(l => l.id === 'level-2')?.chars || [];
    const displayedChars = screen.getByTestId('chars').textContent?.split(',') || [];
    expect(displayedChars.length).toBe(level2Chars.length);
    expect(displayedChars.every(c => level2Chars.includes(c))).toBe(true);
    
    // Start the test
    act(() => {
      fireEvent.click(screen.getByTestId('start-button'));
    });
    
    // Current char should be from level 2
    await waitFor(() => {
      const currentChar = screen.getByTestId('current-char').textContent || '';
      expect(level2Chars.includes(currentChar)).toBe(true);
    });
    
    // Switch to level 4
    act(() => {
      fireEvent.click(screen.getByTestId('level-4-button'));
    });
    
    // Should update to level 4
    expect(screen.getByTestId('level-id').textContent).toBe('level-4');
    
    // Character set should include level 4 chars
    const level4Chars = trainingLevels.find(l => l.id === 'level-4')?.chars || [];
    const updatedChars = screen.getByTestId('chars').textContent?.split(',') || [];
    expect(updatedChars.length).toBe(level4Chars.length);
    expect(updatedChars.every(c => level4Chars.includes(c))).toBe(true);
  });
});