import React from 'react';
import styles from './RaceMode.module.css';
import { RaceMode } from '../../types/raceTypes';

// Race mode selector component
const RaceModeSelector: React.FC<{
  onSelectMode: (mode: RaceMode) => void;
  selectedMode: RaceMode;
}> = ({ onSelectMode, selectedMode }) => {
  return (
    <div className={styles.raceModeSelector}>
      <h3>Select Race Mode</h3>
      <div className={styles.modeButtonsContainer}>
        <button 
          className={`${styles.modeButton} ${selectedMode === 'copy' ? styles.selectedMode : ''}`}
          onClick={() => onSelectMode('copy')}
        >
          <h4>Copy Mode</h4>
          <p>Identify the characters you hear</p>
        </button>
        <button 
          className={`${styles.modeButton} ${selectedMode === 'send' ? styles.selectedMode : ''}`}
          onClick={() => onSelectMode('send')}
        >
          <h4>Send Mode</h4>
          <p>Send the characters you see</p>
        </button>
      </div>
    </div>
  );
};

export default RaceModeSelector; 