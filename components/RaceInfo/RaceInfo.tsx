import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './RaceInfo.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { trainingLevels } from '../../utils/levels';

interface RaceInfoProps {
  onCreateRace: () => void;
  raceMode?: 'copy' | 'send';
}

// Create a client-only component for the character list
const CharacterList = dynamic(() => Promise.resolve(({ chars }: { chars: string[] }) => (
  <span className={styles.charsList}>
    {chars.map(c => c.toUpperCase()).join(', ')}
  </span>
)), { ssr: false });

const RaceInfo: React.FC<RaceInfoProps> = ({ onCreateRace, raceMode = 'copy' }) => {
  const { state } = useAppState();
  const [hydrated, setHydrated] = useState(false);
  
  // Current level data
  const [levelInfo, setLevelInfo] = useState({
    name: 'Default',
    chars: [] as string[]
  });
  
  // Set hydrated state once component mounts on client
  useEffect(() => {
    setHydrated(true);
    
    // Find the current level data
    const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);
    if (currentLevel) {
      setLevelInfo({
        name: currentLevel.name,
        chars: [...currentLevel.chars]
      });
    }
  }, [state.selectedLevelId]);
  
  return (
    <div className={styles.raceInfoContainer}>
      <h2>Create a Morse Code Race</h2>
      
      <div className={styles.raceDetails}>
        <p>You are about to create a race with the following settings:</p>
        
        <ul className={styles.detailsList}>
          <li>
            <strong>Race Mode:</strong>{' '}
            <span className={styles.modeName}>
              {raceMode === 'copy' ? 'Copy Mode' : 'Send Mode'}
            </span>
            <span className={styles.modeDescription}>
              {raceMode === 'copy' 
                ? ' (listen to Morse code and type the character you hear)' 
                : ' (see characters and send them using arrow keys)'}
            </span>
          </li>
          <li>
            <strong>Number of characters:</strong> 20
          </li>
          <li>
            <strong>Characters will be randomly selected from:</strong>{' '}
            {hydrated ? (
              <CharacterList chars={levelInfo.chars} />
            ) : (
              <span className={styles.charsList}>Loading characters...</span>
            )}
          </li>
          <li>
            <strong>Current level:</strong>{' '}
            <span className={styles.levelName}>
              {hydrated ? levelInfo.name : 'Loading...'}
            </span>
          </li>
        </ul>
        
        <p className={styles.instruction}>
          Click &quot;Create Race&quot; to generate a race that you can share with friends.
        </p>
      </div>
      
      <button 
        className={styles.createButton}
        onClick={onCreateRace}
      >
        Create Race
      </button>
    </div>
  );
};

// Export as client-only component to prevent hydration issues
export default dynamic(() => Promise.resolve(RaceInfo), { ssr: false });