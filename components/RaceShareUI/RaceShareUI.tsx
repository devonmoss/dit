import React, { useState, useEffect } from 'react';
import styles from './RaceShareUI.module.css';

interface RaceShareUIProps {
  raceId: string;
  onStartRace: () => void;
}

const RaceShareUI: React.FC<RaceShareUIProps> = ({ raceId, onStartRace }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [raceUrl, setRaceUrl] = useState('');
  
  // Move URL generation to useEffect to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRaceUrl(`${window.location.origin}/race?id=${raceId}`);
    }
  }, [raceId]);
  
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
      
      <p className={styles.waitingText}>Waiting for participants to join...</p>
      
      <div className={styles.startContainer}>
        <button 
          onClick={onStartRace}
          className={styles.startButton}
        >
          Start Race
        </button>
      </div>
    </div>
  );
};

export default RaceShareUI;