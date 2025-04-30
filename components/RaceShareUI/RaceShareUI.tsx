import React, { useState, useEffect } from 'react';
import styles from './RaceShareUI.module.css';
import { useAppState } from '../../contexts/AppStateContext';
import { trainingLevels } from '../../utils/levels';

interface RaceShareUIProps {
  raceId: string;
  onStartRace: () => void;
  raceStatus?: string;
  isHost?: boolean;
  hostName?: string;
  raceMode?: 'copy' | 'send';
  raceLength?: number;
  levelId?: string;
  chars?: string[];
}

const RaceShareUI: React.FC<RaceShareUIProps> = ({ 
  raceId, 
  onStartRace, 
  raceStatus = 'created',
  isHost = true,
  hostName = 'the host',
  raceMode = 'copy',
  raceLength = 20,
  levelId,
  chars = []
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const { state } = useAppState();
  const [levelInfo, setLevelInfo] = useState({
    name: 'Default',
    chars: [] as string[]
  });
  
  // Find the current level data
  useEffect(() => {
    const currentLevelId = levelId || state.selectedLevelId;
    const currentLevel = trainingLevels.find(level => level.id === currentLevelId);
    if (currentLevel) {
      setLevelInfo({
        name: currentLevel.name,
        chars: [...currentLevel.chars]
      });
    } else if (chars && chars.length > 0) {
      setLevelInfo({
        name: 'Custom',
        chars: chars
      });
    }
  }, [levelId, state.selectedLevelId, chars]);
  
  const raceUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/race?id=${raceId}`
    : '';
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(raceUrl);
      setCopySuccess(true);
      
      // Reset success message after 2 seconds
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  
  // Determine if the user can start the race based on race status and if they're the host
  const canStartRace = raceStatus === 'created' && isHost;
  
  // Get the appropriate waiting message
  const getWaitingMessage = () => {
    if (raceStatus !== 'created') {
      return 'This race has already started';
    }
    
    if (isHost) {
      return 'Waiting for participants to join...';
    } else {
      return `Waiting for ${hostName} to start the race...`;
    }
  };
  
  return (
    <div className={styles.raceShareContainer}>
      <h2>Get Ready to Race!</h2>
      
      <div className={styles.raceDetails}>
        <h3>Race Details</h3>
        <ul className={styles.detailsList}>
          <li>
            <strong>Race Mode:</strong>{' '}
            <span className={styles.modeName}>
              {raceMode === 'copy' ? 'Copy Mode' : 'Send Mode'}
            </span>
          </li>
          <li>
            <strong>Number of characters:</strong> {raceLength}
          </li>
          <li>
            <strong>Characters:</strong>{' '}
            <span className={styles.charsList}>
              {levelInfo.chars.map(c => c.toUpperCase()).join(', ')}
            </span>
          </li>
          <li>
            <strong>Level:</strong>{' '}
            <span className={styles.levelName}>
              {levelInfo.name}
            </span>
          </li>
        </ul>
      </div>
      
      <p>Share this link with your friends so they can join your race:</p>
      
      <div className={styles.linkContainer}>
        <input 
          type="text" 
          value={raceUrl} 
          readOnly 
          className={styles.shareInput}
        />
        <button 
          onClick={copyToClipboard} 
          className={styles.copyButton}
        >
          {copySuccess ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      
      <p className={styles.waitingText}>
        {getWaitingMessage()}
      </p>
      
      {canStartRace && (
        <div className={styles.startContainer}>
          <button 
            onClick={onStartRace}
            className={styles.startButton}
          >
            Start Race
          </button>
        </div>
      )}
    </div>
  );
};

export default RaceShareUI;