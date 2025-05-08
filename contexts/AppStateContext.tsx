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
  endTest: (completed?: boolean, levelIdOverride?: string) => void;
  
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
        console.log('[AppState][INIT] --- Loading completed levels from localStorage ---');
        
        // First try to load the new format (mode-specific completed levels)
        const copyCompletedString = localStorage.getItem('morseCompletedCopy');
        const sendCompletedString = localStorage.getItem('morseCompletedSend');
        
        console.log('[AppState][INIT] Raw values from localStorage:');
        console.log('[AppState][INIT] - morseCompletedCopy:', copyCompletedString);
        console.log('[AppState][INIT] - morseCompletedSend:', sendCompletedString);
        
        // Process copy mode completed levels
        if (copyCompletedString) {
          try {
            const parsedCopyCompleted = JSON.parse(copyCompletedString);
            initialState.completedLevels.copy = Array.isArray(parsedCopyCompleted) ? parsedCopyCompleted : [];
            console.log('[AppState][INIT] Parsed copy completed levels:', initialState.completedLevels.copy);
          } catch (parseError) {
            console.error('[AppState][INIT] Error parsing copy completed levels:', parseError);
            initialState.completedLevels.copy = [];
          }
        }
        
        // Process send mode completed levels
        if (sendCompletedString) {
          try {
            const parsedSendCompleted = JSON.parse(sendCompletedString);
            initialState.completedLevels.send = Array.isArray(parsedSendCompleted) ? parsedSendCompleted : [];
            console.log('[AppState][INIT] Parsed send completed levels:', initialState.completedLevels.send);
          } catch (parseError) {
            console.error('[AppState][INIT] Error parsing send completed levels:', parseError);
            initialState.completedLevels.send = [];
          }
        }
        
        // Migrate from old format if needed
        if ((!copyCompletedString || initialState.completedLevels.copy.length === 0) && 
            (!sendCompletedString || initialState.completedLevels.send.length === 0)) {
          const legacyCompletedString = localStorage.getItem('morseCompleted');
          console.log('[AppState][INIT] No or empty mode-specific completed levels, checking legacy format:', legacyCompletedString);
          
          if (legacyCompletedString) {
            try {
              const legacyCompleted = JSON.parse(legacyCompletedString);
              
              // Validate that we have an array
              if (Array.isArray(legacyCompleted)) {
                // Assume all legacy completed levels are in copy mode
                initialState.completedLevels.copy = legacyCompleted;
                
                // Save in the new format for future use
                localStorage.setItem('morseCompletedCopy', legacyCompletedString);
                console.log('[AppState][INIT] Migrated legacy completed levels to copy mode:', initialState.completedLevels.copy);
              } else {
                console.error('[AppState][INIT] Legacy completed levels is not an array:', legacyCompleted);
              }
            } catch (legacyParseError) {
              console.error('[AppState][INIT] Error parsing legacy completed levels:', legacyParseError);
            }
          }
        }
        
        // Final sanity check to ensure we have arrays
        if (!Array.isArray(initialState.completedLevels.copy)) {
          console.warn('[AppState][INIT] Copy completed levels is not an array, resetting to empty array');
          initialState.completedLevels.copy = [];
        }
        
        if (!Array.isArray(initialState.completedLevels.send)) {
          console.warn('[AppState][INIT] Send completed levels is not an array, resetting to empty array');
          initialState.completedLevels.send = [];
        }
        
        console.log('[AppState][INIT] Final completed levels state:');
        console.log('[AppState][INIT] - copy:', initialState.completedLevels.copy);
        console.log('[AppState][INIT] - send:', initialState.completedLevels.send);
      } catch (error) {
        console.error('[AppState][INIT] Error loading completed levels from localStorage:', error);
        // Reset to empty arrays as fallback
        initialState.completedLevels = {
          copy: [],
          send: []
        };
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
    
    console.log(`[AppState][INIT] Determining initial level for mode: ${currentMode}`);
    console.log(`[AppState][INIT] Selected level from localStorage: ${currentSelectedLevelId}`);
    
    // If we have a saved level for the current mode, use it
    if (currentSelectedLevelId) {
      initialState.selectedLevelId = currentSelectedLevelId;
      console.log(`[AppState][INIT] Using saved level ID: ${initialState.selectedLevelId}`);
    } 
    // Otherwise find the first incomplete level for current mode
    else if (trainingLevels.length > 0) {
      // Get completed levels for the current mode
      const currentModeCompletedLevels = initialState.completedLevels[currentMode];
      console.log(`[AppState][INIT] No saved level, finding first incomplete level`);
      console.log(`[AppState][INIT] Completed levels for ${currentMode}:`, currentModeCompletedLevels);
      
      const firstIncomplete = trainingLevels.find(
        level => !currentModeCompletedLevels.includes(level.id)
      );
      
      const selectedLevel = firstIncomplete 
        ? firstIncomplete
        : trainingLevels[trainingLevels.length - 1];
      
      console.log(`[AppState][INIT] Selected ${firstIncomplete ? 'first incomplete' : 'last'} level:`, selectedLevel.id);
        
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
    
    console.log(`[AppState] Selecting level: ${id}, mode: ${state.mode}, modeToUpdate: ${modeToUpdate}`);
    
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
      console.log(`[AppState] Saving to localStorage: morseSelectedLevel=${id} and morseSelectedLevel${modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1)}=${id}`);
      
      localStorage.setItem('morseSelectedLevel', id); // Legacy format
      localStorage.setItem(`morseSelectedLevel${modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1)}`, id); // New format
      
      // Verify saving
      const legacyValue = localStorage.getItem('morseSelectedLevel');
      const newFormatValue = localStorage.getItem(`morseSelectedLevel${modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1)}`);
      console.log(`[AppState] Verification - localStorage.morseSelectedLevel: ${legacyValue}`);
      console.log(`[AppState] Verification - localStorage.morseSelectedLevel${modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1)}: ${newFormatValue}`);
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
    
    console.log(`[AppState] =============================================`);
    console.log(`[AppState] MARK LEVEL COMPLETED CALLED`);
    console.log(`[AppState] Level ID: ${id}`);
    console.log(`[AppState] Mode: ${modeToUpdate}`);
    console.log(`[AppState] Current completedLevels.${modeToUpdate}:`, state.completedLevels[modeToUpdate]);
    
    // Check if the level is already marked as completed
    const isAlreadyCompleted = state.completedLevels[modeToUpdate].includes(id);
    console.log(`[AppState] Is level already completed: ${isAlreadyCompleted}`);
    
    if (!isAlreadyCompleted) {
      // Create a new completed levels object
      const newCompletedLevels = {
        ...state.completedLevels,
        [modeToUpdate]: [...state.completedLevels[modeToUpdate], id]
      };
      
      console.log(`[AppState] New completedLevels.${modeToUpdate}:`, newCompletedLevels[modeToUpdate]);
      
      // Update state first
      setState(prev => ({
        ...prev,
        completedLevels: newCompletedLevels,
      }));
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        // Construct the correct storage key with consistent capitalization
        const modeSuffix = modeToUpdate.charAt(0).toUpperCase() + modeToUpdate.slice(1);
        const storageKey = `morseCompleted${modeSuffix}`;
        
        console.log(`[AppState] LOCALSTORAGE UPDATE START`);
        console.log(`[AppState] Storage key: ${storageKey}`);
        console.log(`[AppState] New array to save: ${JSON.stringify(newCompletedLevels[modeToUpdate])}`);
        
        try {
          // To ensure we're not overwriting with stale data, read current localStorage first
          const currentStoredValue = localStorage.getItem(storageKey);
          console.log(`[AppState] Current stored value for ${storageKey}:`, currentStoredValue);
          
          // Parse the current stored value if it exists
          let currentValues: string[] = [];
          if (currentStoredValue) {
            try {
              currentValues = JSON.parse(currentStoredValue);
              console.log(`[AppState] Parsed current values from localStorage:`, currentValues);
              console.log(`[AppState] Type of parsed values:`, Array.isArray(currentValues) ? 'Array' : typeof currentValues);
            } catch (parseError) {
              console.error(`[AppState] Error parsing existing localStorage value for ${storageKey}:`, parseError);
              console.log(`[AppState] Raw value that failed to parse:`, currentStoredValue);
            }
          }
          
          // Check if the level is already in localStorage
          const levelAlreadyInStorage = Array.isArray(currentValues) && currentValues.includes(id);
          console.log(`[AppState] Level ${id} already in storage: ${levelAlreadyInStorage}`);
          
          // Combine existing values with new completed level
          if (!levelAlreadyInStorage) {
            const updatedValues = Array.isArray(currentValues) ? [...currentValues, id] : [id];
            console.log(`[AppState] Combined values to save:`, updatedValues);
            
            // Save the updated array
            const jsonToSave = JSON.stringify(updatedValues);
            console.log(`[AppState] JSON to save: ${jsonToSave}`);
            localStorage.setItem(storageKey, jsonToSave);
            console.log(`[AppState] Storage update complete`);
            
            // Verify storage
            const verifyValue = localStorage.getItem(storageKey);
            console.log(`[AppState] Verification - read back from storage: ${verifyValue}`);
            if (verifyValue !== jsonToSave) {
              console.error(`[AppState] WARNING: Storage verification failed!`);
              console.log(`[AppState] Expected: ${jsonToSave}`);
              console.log(`[AppState] Actual: ${verifyValue}`);
            }
          } else {
            console.log(`[AppState] Level ${id} already in localStorage.${storageKey}, not updating`);
          }
          
          // Dump all localStorage keys and values related to morse for verification
          console.log('[AppState] All localStorage morse keys:');
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('morse')) {
              console.log(`  - ${key}: ${localStorage.getItem(key)}`);
            }
          }
        } catch (error) {
          console.error(`[AppState] Error saving to localStorage: ${storageKey}`, error);
        }
        
        // Automatically advance the next level in localStorage ONLY
        // This way when the user refreshes, they'll be at the next level
        // but we don't immediately advance the UI
        const currentLevelIndex = trainingLevels.findIndex(level => level.id === id);
        if (currentLevelIndex >= 0 && currentLevelIndex < trainingLevels.length - 1) {
          // Get the next level ID
          const nextLevelId = trainingLevels[currentLevelIndex + 1].id;
          
          // Update legacy and mode-specific localStorage keys
          console.log(`[AppState] Updating next level in localStorage: morseSelectedLevel=${nextLevelId}`);
          localStorage.setItem('morseSelectedLevel', nextLevelId);
          
          const selectedLevelKey = `morseSelectedLevel${modeSuffix}`;
          console.log(`[AppState] Updating next level in localStorage: ${selectedLevelKey}=${nextLevelId}`);
          localStorage.setItem(selectedLevelKey, nextLevelId);
          
          // Verify selected level updates
          const verifyLegacy = localStorage.getItem('morseSelectedLevel');
          const verifyModeSpecific = localStorage.getItem(selectedLevelKey);
          console.log(`[AppState] Verification - legacy selected level: ${verifyLegacy}`);
          console.log(`[AppState] Verification - mode-specific selected level: ${verifyModeSpecific}`);
        }
        
        console.log(`[AppState] LOCALSTORAGE UPDATE COMPLETE`);
      }
    } else {
      console.log(`[AppState] Level ${id} already completed in ${modeToUpdate} mode, skipping`);
    }
    console.log(`[AppState] =============================================`);
  };
  
  // Test management with explicit level ID
  const startTestWithLevelId = (levelId: string) => {
    console.log(`[AppState] Starting test with explicit level: ${levelId}, mode: ${state.mode}`);
    
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
    console.log(`[AppState] Starting test with current level: ${state.selectedLevelId}, mode: ${state.mode}`);
    
    // Initialize character points for the current level
    // Get fresh data by directly finding the level rather than using state.selectedLevelId
    // which might not have been fully updated yet
    const freshLevelId = state.selectedLevelId;
    const freshLevel = trainingLevels.find(level => level.id === freshLevelId);
    
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
  
  const endTest = (completed = true, levelIdOverride?: string) => {
    console.log(`[AppState] Ending test, completed: ${completed}, level: ${levelIdOverride || state.selectedLevelId}, mode: ${state.mode}`);
    
    setState(prev => ({
      ...prev,
      testActive: false,
    }));
    
    if (completed) {
      // Use the override if provided, otherwise fall back to current selectedLevelId
      const levelToComplete = levelIdOverride || state.selectedLevelId;
      
      if (levelToComplete) {
        console.log(`[AppState] Test completed successfully, marking level completed: ${levelToComplete}`);
        markLevelCompleted(levelToComplete);
      } else {
        console.log(`[AppState] Test not completed successfully, skipping markLevelCompleted`);
      }
    } else {
      console.log(`[AppState] Test not completed successfully, skipping markLevelCompleted`);
    }
  };
  
  // Settings
  const setWpm = (wpm: number) => {
    setState(prev => ({
      ...prev,
      wpm: wpm,
    }));
  };
  
  const setVolume = (volume: number) => {
    setState(prev => ({
      ...prev,
      volume: volume,
    }));
  };
  
  const setSendWpm = (wpm: number) => {
    setState(prev => ({
      ...prev,
      sendWpm: wpm,
    }));
  };
  
  const setTheme = (theme: Theme) => {
    setState(prev => ({
      ...prev,
      theme: theme,
    }));
  };
  
  // Mode and test type
  const setMode = (mode: Mode) => {
    console.log(`[AppState] Setting mode from ${state.mode} to ${mode}`);
    console.log(`[AppState] Current state before mode change:`, {
      selectedLevelId: state.selectedLevelId,
      selectedLevels: state.selectedLevels,
      completedLevels: state.completedLevels
    });
    
    // Get the target mode (or race → copy)
    const targetMode = mode === 'race' ? 'copy' : mode;
    
    // Check if we have a saved level for this mode
    let targetLevelId = state.selectedLevels[targetMode];
    
    // If no saved level exists for this mode, default to level-1
    if (!targetLevelId) {
      console.log(`[AppState] No saved level for ${targetMode} mode, defaulting to level-1`);
      targetLevelId = trainingLevels[0].id;
      
      // Save this default to localStorage for the mode
      if (typeof window !== 'undefined') {
        const selectedLevelKey = `morseSelectedLevel${targetMode.charAt(0).toUpperCase() + targetMode.slice(1)}`;
        console.log(`[AppState] Saving default level to localStorage: ${selectedLevelKey}=${targetLevelId}`);
        localStorage.setItem(selectedLevelKey, targetLevelId);
      }
    } else {
      console.log(`[AppState] Found saved level for ${targetMode} mode: ${targetLevelId}`);
    }
    
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
      console.log(`[AppState] Found target level:`, targetLevel.name);
      setState(prev => ({
        ...prev,
        chars: [...targetLevel.chars]
      }));
    } else {
      console.log(`[AppState] Warning: Could not find target level for ID ${targetLevelId}`);
    }
    
    // Store mode in localStorage
    if (typeof window !== 'undefined') {
      console.log(`[AppState] Saving mode to localStorage: ${mode}`);
      localStorage.setItem('morseMode', mode);
    }
  };
  
  const setTestType = (type: TestType) => {
    setState(prev => ({
      ...prev,
      testType: type,
    }));
  };
  
  // Character points
  const updateCharPoints = (char: string, points: number) => {
    setState(prev => ({
      ...prev,
      charPoints: {
        ...prev.charPoints,
        [char]: points,
      },
    }));
  };
  
  // Response times
  const saveResponseTimes = (times: CharTiming[]) => {
    // Implementation needed
  };
  
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
      saveResponseTimes,
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};