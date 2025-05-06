import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('CharPointsContext');

interface CharPointsContextType {
  // Local character points that mirror the app state but can be updated first
  localCharPoints: Record<string, number>;
  // Get the effective points (max of local and app state)
  getEffectivePoints: (char: string, statePoints: number) => number;
  // Update local character points
  updateLocalCharPoints: (char: string, points: number) => void;
  // Reset local character points
  resetLocalCharPoints: () => void;
  // Check if a character is mastered based on both local and app state
  isCharacterMastered: (char: string, targetPoints: number, statePoints: number) => boolean;
  // Get all local character points
  getAllLocalCharPoints: () => Record<string, number>;
  // Track recently mastered character
  recentlyMasteredChar: string | null;
  setRecentlyMasteredChar: (char: string | null) => void;
}

const CharPointsContext = createContext<CharPointsContextType | null>(null);

export const CharPointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Store character points locally in state
  const [localCharPoints, setLocalCharPoints] = useState<Record<string, number>>({});
  const [recentlyMasteredChar, setRecentlyMasteredChar] = useState<string | null>(null);

  // Get effective points (maximum of local and app state)
  const getEffectivePoints = useCallback((char: string, statePoints: number): number => {
    const localPoints = localCharPoints[char] || 0;
    return Math.max(localPoints, statePoints);
  }, [localCharPoints]);

  // Update local character points
  const updateLocalCharPoints = useCallback((char: string, points: number) => {
    logger.debug(`Updating local points for "${char}": ${points}`);
    setLocalCharPoints(prev => ({
      ...prev,
      [char]: points
    }));
  }, []);

  // Reset local character points
  const resetLocalCharPoints = useCallback(() => {
    logger.debug('Resetting all local character points');
    setLocalCharPoints({});
  }, []);

  // Check if a character is mastered
  const isCharacterMastered = useCallback((char: string, targetPoints: number, statePoints: number): boolean => {
    const effectivePoints = getEffectivePoints(char, statePoints);
    return effectivePoints >= targetPoints;
  }, [getEffectivePoints]);

  // Get all local character points
  const getAllLocalCharPoints = useCallback((): Record<string, number> => {
    return { ...localCharPoints };
  }, [localCharPoints]);

  // Create the context value
  const contextValue: CharPointsContextType = {
    localCharPoints,
    getEffectivePoints,
    updateLocalCharPoints,
    resetLocalCharPoints,
    isCharacterMastered,
    getAllLocalCharPoints,
    recentlyMasteredChar,
    setRecentlyMasteredChar
  };

  return (
    <CharPointsContext.Provider value={contextValue}>
      {children}
    </CharPointsContext.Provider>
  );
};

// Custom hook to use the character points context
export function useCharPoints(): CharPointsContextType {
  const context = useContext(CharPointsContext);
  if (context === null) {
    throw new Error('useCharPoints must be used within a CharPointsProvider');
  }
  return context;
}