import { RaceStats } from "../types/raceTypes";

/**
 * Calculate race statistics based on start time, finish time, text length, and error count
 * 
 * @param startTime - Race start timestamp in milliseconds 
 * @param finishTime - Race finish timestamp in milliseconds
 * @param textLength - Length of race text
 * @param errorCount - Number of errors made during race
 * @returns Race statistics or null if timestamps are missing
 */
export const calculateRaceStats = (
  startTime: number | null, 
  finishTime: number | null,
  textLength: number,
  errorCount: number
): RaceStats | null => {
  if (!startTime || !finishTime) return null;
  
  const durationSeconds = (finishTime - startTime) / 1000;
  const minutes = durationSeconds / 60;
  // Calculate words per minute (assuming 5 chars per word)
  const wpm = Math.round((textLength / 5) / minutes);
  
  return {
    time: durationSeconds,
    wpm,
    errors: errorCount
  };
}; 