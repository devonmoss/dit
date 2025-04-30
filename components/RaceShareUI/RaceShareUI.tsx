import React, { useState } from 'react';
import styles from './RaceShareUI.module.css';

interface RaceShareUIProps {
  raceId: string;
  onStartRace: () => void;
  raceStatus?: string;
}

const RaceShareUI: React.FC<RaceShareUIProps> = ({ raceId, onStartRace, raceStatus = 'created' }) => {
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
  
  // Determine if the user can start the race based on race status
  const canStartRace = raceStatus === 'created';
  
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
        {canStartRace 
          ? 'Waiting for participants to join...' 
          : 'This race has already started'}
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