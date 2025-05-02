import { useCallback } from 'react';
import { RaceMode } from '../../types/raceTypes';

interface UseRaceInfoStageProps {
  raceMode: RaceMode;
  setRaceMode: (mode: RaceMode) => void;
  createRace: (params: { mode: RaceMode }) => void;
}

interface UseRaceInfoStageResult {
  handleModeChange: (mode: RaceMode) => void;
  handleCreateRace: () => void;
}

export function useRaceInfoStage({ 
  raceMode,
  setRaceMode,
  createRace,
}: UseRaceInfoStageProps): UseRaceInfoStageResult {
  const handleModeChange = useCallback((mode: RaceMode) => {
    setRaceMode(mode);
  }, [setRaceMode]);

  const handleCreateRace = useCallback(() => {
    createRace({ mode: raceMode });
  }, [createRace, raceMode]);

  return {
    handleModeChange,
    handleCreateRace,
  };
} 