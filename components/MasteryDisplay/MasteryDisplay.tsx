import React from 'react';
import styles from './MasteryDisplay.module.css';
import { useAppState } from '../../contexts/AppStateContext';

interface MasteryDisplayProps {
  targetPoints?: number;
  // Optional props to override AppState context for more direct control
  charPoints?: Record<string, number>;
  chars?: string[];
}

const MasteryDisplay: React.FC<MasteryDisplayProps> = ({ 
  targetPoints = 3,
  charPoints,
  chars
}) => {
  const { state, getCurrentLevel } = useAppState();
  
  // Use props if provided, otherwise fall back to app state
  const currentLevel = getCurrentLevel();
  const displayChars = chars || (currentLevel ? currentLevel.chars : []);
  const pointsSource = charPoints || state.charPoints;
  
  if (displayChars.length === 0) {
    return null;
  }
  
  return (
    <div className={styles.masteryContainer}>
      {displayChars.map(char => {
        const points = pointsSource[char] || 0;
        const fraction = Math.min(points / targetPoints, 1);
        
        // SVG circle parameters
        const radius = 18;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - fraction);
        
        return (
          <div key={char} className={styles.charMaster} data-char={char}>
            <svg viewBox="0 0 48 48">
              <circle 
                className={styles.bg} 
                cx="24" 
                cy="24" 
                r={radius} 
                strokeDasharray={circumference} 
                strokeDashoffset="0" 
              />
              <circle 
                className={styles.fg} 
                cx="24" 
                cy="24" 
                r={radius} 
                strokeDasharray={circumference} 
                strokeDashoffset={strokeDashoffset} 
                style={{ strokeDashoffset }}
              />
            </svg>
            <span className={styles.charLabel}>{char.toUpperCase()}</span>
          </div>
        );
      })}
    </div>
  );
};

export default MasteryDisplay;