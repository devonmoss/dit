import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { trainingLevels, TrainingLevel } from '../utils/levels';
import { defaultChars } from '../utils/morse';

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

export interface AppState {
  // Current selected level
  selectedLevelId: string;
  // Character mastery points
  charPoints: CharPoints;
  // Completed levels
  completedLevels: string[];
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
      charPoints: {},
      completedLevels: [],
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
        const completedString = localStorage.getItem('morseCompleted');
        if (completedString) {
          initialState.completedLevels = JSON.parse(completedString);
        }
      } catch (error) {
        console.error('Error loading completed levels from localStorage:', error);
      }
      
      // Load selected level from localStorage
      const storedSelectedLevelId = localStorage.getItem('morseSelectedLevel');
      if (storedSelectedLevelId) {
        initialState.selectedLevelId = storedSelectedLevelId;
      }
      
      // Load mode from localStorage
      const storedMode = localStorage.getItem('morseMode');
      if (storedMode === 'copy' || storedMode === 'send' || storedMode === 'race') {
        initialState.mode = storedMode;
      }
    }
    
    // If no selected level is stored in localStorage, determine the initial selected level
    if (!initialState.selectedLevelId && trainingLevels.length > 0) {
      const firstIncomplete = trainingLevels.find(
        level => !initialState.completedLevels.includes(level.id)
      );
      
      const selectedLevel = firstIncomplete 
        ? firstIncomplete
        : trainingLevels[trainingLevels.length - 1];
        
      initialState.selectedLevelId = selectedLevel.id;
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
    // Find the level to get its characters
    const level = trainingLevels.find(level => level.id === id);
    const levelChars = level ? [...level.chars] : [...defaultChars];
    
    setState(prev => ({
      ...prev,
      selectedLevelId: id,
      chars: levelChars,
    }));
    
    // Store selected level in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('morseSelectedLevel', id);
    }
  };
  
  const getCurrentLevel = () => {
    return trainingLevels.find(level => level.id === state.selectedLevelId);
  };
  
  const markLevelCompleted = (id: string) => {
    if (!state.completedLevels.includes(id)) {
      const newCompletedLevels = [...state.completedLevels, id];
      setState(prev => ({
        ...prev,
        completedLevels: newCompletedLevels,
      }));
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('morseCompleted', JSON.stringify(newCompletedLevels));
        
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
      chars: freshLevel ? [...freshLevel.chars] : [...defaultChars],
    }));
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
    setState(prev => ({
      ...prev,
      mode,
      // End test when changing modes to ensure we return to start screen
      testActive: false
    }));
    
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