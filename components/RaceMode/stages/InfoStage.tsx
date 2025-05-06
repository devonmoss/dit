import React from 'react';
import RaceInfo from '../../RaceInfo/RaceInfo';
import RaceModeSelector from '../RaceModeSelector';
import { RaceMode } from '../../../types/raceTypes';

interface InfoStageProps {
  raceMode: RaceMode;
  onModeChange: (mode: RaceMode) => void;
  onCreateRace: () => void;
}

/**
 * Initial race info stage where users select race mode and start a race
 */
const InfoStage: React.FC<InfoStageProps> = ({ 
  raceMode, 
  onModeChange, 
  onCreateRace 
}) => {
  return (
    <RaceInfo 
      onCreateRace={onCreateRace} 
      raceMode={raceMode}
      modeSelector={
        <RaceModeSelector 
          onSelectMode={onModeChange} 
          selectedMode={raceMode} 
        />
      }
    />
  );
};

export default InfoStage; 