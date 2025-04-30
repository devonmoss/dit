import React, { useState } from 'react';
import styles from './RaceShareUI.module.css';

interface RaceShareUIProps {
  raceId: string;
  onStartRace: () => void;
  raceStatus?: string;
  isHost?: boolean;
  hostName?: string;
}

const RaceShareUI: React.FC<RaceShareUIProps> = ({ 
  raceId, 
  onStartRace, 
  raceStatus = 'created',
  isHost = true,
  hostName = 'the host'
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
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
      <h2>Race Created!</h2>
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