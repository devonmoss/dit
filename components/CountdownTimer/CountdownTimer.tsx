import React, { useState, useEffect } from 'react';
import styles from './CountdownTimer.module.css';

interface CountdownTimerProps {
  seconds: number;
  onComplete: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ seconds, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(seconds);
  
  useEffect(() => {
    // Set the initial value when the seconds prop changes
    setTimeLeft(seconds);
    
    // Don't start if seconds is 0 or negative
    if (seconds <= 0) {
      onComplete();
      return;
    }
    
    // Start countdown
    const intervalId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [seconds, onComplete]);
  
  return (
    <div className={styles.countdownContainer}>
      <div className={styles.countdownInner}>
        <h2>Race starts in</h2>
        <div className={styles.countdownNumber}>{timeLeft}</div>
        <h2>seconds</h2>
      </div>
    </div>
  );
};

export default CountdownTimer;