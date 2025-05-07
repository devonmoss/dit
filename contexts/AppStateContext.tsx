import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { trainingLevels, TrainingLevel } from '../utils/levels';
import { defaultChars } from '../utils/morse';
import { trackLevelStarted } from '../utils/analytics';

// Define types for our app state
interface CharPoints {
  [key: string]: number;
}

interface CharTiming {
  char: string;
  time: number;
}

type Mode = 'copy' | 'send' | 'race';
type TestType = 'training' | 'time' | 'words' | 'race' | 'zen' | 'pota';
type Theme = 'default' | 'catppuccin-mocha';

// Track completed levels by mode
export interface CompletedLevels {
  copy: string[];
  send: string[];
}

// Track selected level by mode
export interface SelectedLevels {
  copy: string;
  send: string; 
}

export interface AppState {
  // Current selected level for each mode
  selectedLevels: SelectedLevels;
  // Current selected level ID - used for the active mode
  selectedLevelId: string;
  // Character mastery points
  charPoints: CharPoints;
  // Completed levels by mode
  completedLevels: CompletedLevels;
  // User settings
  wpm: number;
  volume: number;
  sendWpm: number;
  theme: Theme;
  // Current mode and test type
  mode: Mode;
  testType: TestType;
  // Test state
  testActive: boolean;
  // Current character set for the test
  chars: string[];
}

// Define interface for the context
interface AppStateContextType {
  state: AppState;
  
  // Level management
  selectLevel: (id: string) => void;
  getCurrentLevel: () => TrainingLevel | undefined;
  markLevelCompleted: (id: string) => void;
  isLevelCompleted: (id: string) => boolean;
  
  // Test management
  startTest: () => void;
  startTestWithLevelId: (levelId: string) => void;
  endTest: (completed?: boolean) => void;
  
  // Settings
  setWpm: (wpm: number) => void;
  setVolume: (volume: number) => void;
  setSendWpm: (wpm: number) => void;
  setTheme: (theme: Theme) => void;
  
  // Mode and test type
  setMode: (mode: Mode) => void;
  setTestType: (type: TestType) => void;
  
  // Character points
  updateCharPoints: (char: string, points: number) => void;
  
  // Response times
  saveResponseTimes: (times: CharTiming[]) => void;
}

// Create the context with a default value
const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load initial state from localStorage where appropriate
  const [state, setState] = useState<AppState>(() => {
    // Set default values
    const initialState: AppState = {
      selectedLevelId: '',
      selectedLevels: {
        copy: '',
        send: ''
      },
      charPoints: {},
      completedLevels: {
        copy: [],
        send: []
      },
      wpm: 20,
      volume: 75,
      sendWpm: 20,
      theme: 'default',
      mode: 'copy',
      testType: 'training',
      testActive: false,
      chars: [],  // Initialize empty, will be set below based on selectedLevelId
    };
    
    // Only run localStorage loading on client side
    if (typeof window !== 'undefined') {
      // Load WPM from localStorage
      const storedWpm = parseInt(localStorage.getItem('morseWpm') || '', 10);
      if (!isNaN(storedWpm) && storedWpm > 0) {
        initialState.wpm = storedWpm;
      }
      
      // Load volume from localStorage
      const storedVolume = parseInt(localStorage.getItem('morseVolume') || '', 10);
      if (!isNaN(storedVolume) && storedVolume >= 0) {
        initialState.volume = storedVolume;
      }
      
      // Load send WPM from localStorage
      const storedSendWpm = parseInt(localStorage.getItem('morseSendWpm') || '', 10);
      if (!isNaN(storedSendWpm) && storedSendWpm > 0) {
        initialState.sendWpm = storedSendWpm;
      }
      
      // Load theme from localStorage
      const storedTheme = localStorage.getItem('morseTheme');
      if (storedTheme === 'default' || storedTheme === 'catppuccin-mocha') {
        initialState.theme = storedTheme;
      }
      
      // Load completed levels from localStorage
      try {
        // First try to load the new format (mode-specific completed levels)
        const copyCompletedString = localStorage.getItem('morseCompletedCopy');
        const sendCompletedString = localStorage.getItem('morseCompletedSend');
        
        if (copyCompletedString) {
          initialState.completedLevels.copy = JSON.parse(copyCompletedString);
        }
        
        if (sendCompletedString) {
          initialState.completedLevels.send = JSON.parse(sendCompletedString);
        }
        
        // Migrate from old format if needed
        if (!copyCompletedString && !sendCompletedString) {
          const legacyCompletedString = localStorage.getItem('morseCompleted');
          if (legacyCompletedString) {
            const legacyCompleted = JSON.parse(legacyCompletedString);
            // Assume all legacy completed levels are in copy mode
            initialState.completedLevels.copy = legacyCompleted;
            
            // Save in the new format for future use
            localStorage.setItem('morseCompletedCopy', legacyCompletedString);
          }
        }
      } catch (error) {
        console.error('Error loading completed levels from localStorage:', error);
      }
      
      // Load selected levels from localStorage - new format
      try {
        const copySelectedLevelId = localStorage.getItem('morseSelectedLevelCopy');
        const sendSelectedLevelId = localStorage.getItem('morseSelectedLevelSend');
        
        if (copySelectedLevelId) {
          initialState.selectedLevels.copy = copySelectedLevelId;
        }
        
        if (sendSelectedLevelId) {
          initialState.selectedLevels.send = sendSelectedLevelId;
        }
        
        // Migration from old format for backward compatibility
        if (!copySelectedLevelId && !sendSelectedLevelId) {
          const legacySelectedLevelId = localStorage.getItem('morseSelectedLevel');
          if (legacySelectedLevelId) {
            // Store it in both modes for migration, but prioritize copy mode
            initialState.selectedLevels.copy = legacySelectedLevelId;
            
            // Save in the new format for future use
            localStorage.setItem('morseSelectedLevelCopy', legacySelectedLevelId);
          }
        }
      } catch (error) {
        console.error('Error loading selected levels from localStorage:', error);
      }
      
      // Load mode from localStorage
      const storedMode = localStorage.getItem('morseMode');
      if (storedMode === 'copy' || storedMode === 'send' || storedMode === 'race') {
        initialState.mode = storedMode;
      }
    }
    
    // Calculate initial selectedLevelId based on current mode
    const currentMode = initialState.mode === 'race' ? 'copy' : initialState.mode;
    const currentSelectedLevelId = initialState.selectedLevels[currentMode];
    
    // If we have a saved level for the current mode, use it
    if (currentSelectedLevelId) {
      initialState.selectedLevelId = currentSelectedLevelId;
    } 
    // Otherwise find the first incomplete level for current mode
    else if (trainingLevels.length > 0) {
      // Get completed levels for the current mode
      const currentModeCompletedLevels = initialState.completedLevels[currentMode];
      
      const firstIncomplete = trainingLevels.find(
        level => !currentModeCompletedLevels.includes(level.id)
      );
      
      const selectedLevel = firstIncomplete 
        ? firstIncomplete
        : trainingLevels[trainingLevels.length - 1];
        
      initialState.selectedLevelId = selectedLevel.id;
      initialState.selectedLevels[currentMode] = selectedLevel.id;
    }
    
    // Set the character set to match the selected level
    const level = trainingLevels.find(lvl => lvl.id === initialState.selectedLevelId);
    if (level) {
      initialState.chars = [...level.chars];
    }
    
    return initialState;
  });
  
  // Level management functions
  const selectLevel = (id: string) => {
    // Determine which mode's selected level to update
    const modeToUpdate = state.mode === 'race' ? 'copy' : state.mode;
    
    // Find the level to get its characters
    const level = trainingLevels.find(level => level.id === id);
    const levelChars = level ? [...level.chars] : [...defaultChars];
    
    setState(prev => {
      // Create updated selectedLevels
      const updatedSelectedLevels = {
        ...prev.selectedLevels,
        [modeToUpdate]: id
      };
      
      return {
        ...prev,
        selectedLevelId: id,
        selectedLevels: updatedSelectedLevels,
        chars: levelChars,
      };
    });
    
    // Store selected level in localStorage - both in legacy and new format
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSelectedLevel', id); // Legacy format
      localStorage.setItem(`morseSelectedLevel${modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1)}`, id); // New format
    }
  };
  
  const getCurrentLevel = () => {
    return trainingLevels.find(level => level.id === state.selectedLevelId);
  };
  
  // Check if a level is completed in the current mode
  const isLevelCompleted = (id: string) => {
    // Use 'copy' mode for race since they share the same completed levels
    const modeToCheck = state.mode === 'race' ? 'copy' : state.mode;
    return state.completedLevels[modeToCheck].includes(id);
  };
  
  const markLevelCompleted = (id: string) => {
    // Use 'copy' mode for race since they share the same completed levels
    const modeToUpdate = state.mode === 'race' ? 'copy' : state.mode;
    
    if (!state.completedLevels[modeToUpdate].includes(id)) {
      // Create a new completed levels object
      const newCompletedLevels = {
        ...state.completedLevels,
        [modeToUpdate]: [...state.completedLevels[modeToUpdate], id]
      };
      
      setState(prev => ({
        ...prev,
        completedLevels: newCompletedLevels,
      }));
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`morseCompleted${modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1)}`, 
          JSON.stringify(newCompletedLevels[modeToUpdate]));
        
        // Automatically advance the next level in localStorage ONLY
        // This way when the user refreshes, they'll be at the next level
        // but we don't immediately advance the UI
        const currentLevelIndex = trainingLevels.findIndex(level => level.id === id);
        if (currentLevelIndex >= 0 && currentLevelIndex < trainingLevels.length - 1) {
          // Get the next level ID
          const nextLevelId = trainingLevels[currentLevelIndex + 1].id;
          
          // Update localStorage only, without changing the current UI state
          localStorage.setItem('morseSelectedLevel', nextLevelId);
        }
      }
    }
  };
  
  // Test management with explicit level ID
  const startTestWithLevelId = (levelId: string) => {
    console.log('======== startTestWithLevelId ========');
    // Get fresh level data directly
    const level = trainingLevels.find(l => l.id === levelId);
    
    if (!level) {
      console.error('Level not found for ID:', levelId);
      return;
    }
    
    // Initialize character points for this level
    const newCharPoints: CharPoints = {};
    level.chars.forEach(char => {
      newCharPoints[char] = 0;
    });
    
    setState(prev => ({
      ...prev,
      selectedLevelId: levelId, // Ensure level ID is set correctly
      testActive: true,
      charPoints: newCharPoints,
      chars: [...level.chars],
    }));

    // Track level started event
    trackLevelStarted(levelId);
  };
  
  // Original startTest function (kept for backward compatibility)
  const startTest = () => {
    // Initialize character points for the current level
    // Get fresh data by directly finding the level rather than using state.selectedLevelId
    // which might not have been fully updated yet
    const freshLevelId = state.selectedLevelId;
    const freshLevel = trainingLevels.find(level => level.id === freshLevelId);
    
    // console.log('======== startTest ========');
    
    const newCharPoints: CharPoints = {};
    
    if (freshLevel) {
      freshLevel.chars.forEach(char => {
        newCharPoints[char] = 0;
      });
    }
    
    setState(prev => ({
      ...prev,
      testActive: true,
      charPoints: newCharPoints,
    }));

    // Track level started event
    trackLevelStarted(state.selectedLevelId);
  };
  
  const endTest = (completed = true) => {
    setState(prev => ({
      ...prev,
      testActive: false,
    }));
    
    if (completed && state.selectedLevelId) {
      markLevelCompleted(state.selectedLevelId);
    }
  };
  
  // Settings management
  const setWpm = (wpm: number) => {
    setState(prev => ({
      ...prev,
      wpm,
    }));
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseWpm', wpm.toString());
    }
  };
  
  const setVolume = (volume: number) => {
    setState(prev => ({
      ...prev,
      volume,
    }));
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseVolume', volume.toString());
    }
  };
  
  const setSendWpm = (sendWpm: number) => {
    setState(prev => ({
      ...prev,
      sendWpm,
    }));
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSendWpm', sendWpm.toString());
    }
  };
  
  // Mode and test type
  const setMode = (mode: Mode) => {
    // Get the selected level for the target mode (or race → copy)
    const targetMode = mode === 'race' ? 'copy' : mode;
    const targetLevelId = state.selectedLevels[targetMode] || state.selectedLevelId;
    
    setState(prev => ({
      ...prev,
      mode,
      selectedLevelId: targetLevelId,
      // End test when changing modes to ensure we return to start screen
      testActive: false
    }));
    
    // Update the current level's characters
    const targetLevel = trainingLevels.find(level => level.id === targetLevelId);
    if (targetLevel) {
      setState(prev => ({
        ...prev,
        chars: [...targetLevel.chars]
      }));
    }
    
    // Store mode in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseMode', mode);
    }
  };
  
  const setTestType = (testType: TestType) => {
    setState(prev => ({
      ...prev,
      testType,
    }));
  };
  
  // Character points management
  const updateCharPoints = (char: string, points: number) => {
    setState(prev => ({
      ...prev,
      charPoints: {
        ...prev.charPoints,
        [char]: points,
      },
    }));
  };
  
  // Save response times to localStorage
  const saveResponseTimes = (times: CharTiming[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Get existing response times
      const existingTimesStr = localStorage.getItem('morseResponseTimes');
      const existingTimes = existingTimesStr ? JSON.parse(existingTimesStr) : [];
      
      // Add timestamp to the new batch
      const newEntry = {
        timestamp: new Date().toISOString(),
        mode: state.mode,
        level: state.selectedLevelId,
        times
      };
      
      // Add to existing data
      const updatedTimes = [...existingTimes, newEntry];
      
      // Save back to localStorage
      localStorage.setItem('morseResponseTimes', JSON.stringify(updatedTimes));
    } catch (error) {
      console.error('Error saving response times to localStorage:', error);
    }
  };
  
  // Theme setting function
  const setTheme = (theme: Theme) => {
    setState(prev => ({
      ...prev,
      theme
    }));
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseTheme', theme);
      
      // Apply the theme to the document root
      document.documentElement.setAttribute('data-theme', theme);
    }
  };
  
  // Apply theme from state when the app loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);
  
  // Provide all the values to the context
  return (
    <AppStateContext.Provider value={{
      state,
      selectLevel,
      getCurrentLevel,
      markLevelCompleted,
      isLevelCompleted,
      startTest,
      startTestWithLevelId,
      endTest,
      setWpm,
      setVolume,
      setSendWpm,
      setTheme,
      setMode,
      setTestType,
      updateCharPoints,
      saveResponseTimes
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook to use the AppState context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}; 