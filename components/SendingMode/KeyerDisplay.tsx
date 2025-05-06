import React from 'react';
import styles from './SendingMode.module.css';

interface KeyerDisplayProps {
  morseOutput: string;
}

/**
 * Displays the morse code input from the user
 */
const KeyerDisplay: React.FC<KeyerDisplayProps> = ({ morseOutput }) => {
  return (
    <div className={styles.keyerDisplay}>
      <div className={styles.keyerOutput}>{morseOutput}</div>
    </div>
  );
};

export default React.memo(KeyerDisplay);