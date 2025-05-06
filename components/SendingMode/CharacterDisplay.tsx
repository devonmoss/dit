import React from 'react';
import styles from './SendingMode.module.css';

interface CharacterDisplayProps {
  currentChar: string;
}

/**
 * Displays the current character that the user needs to send
 */
const CharacterDisplay: React.FC<CharacterDisplayProps> = ({ currentChar }) => {
  if (!currentChar) {
    return <div className={styles.currentCharDisplay}></div>;
  }

  return (
    <div className={styles.currentCharDisplay}>
      <div className={styles.bigCharacter}>{currentChar.toUpperCase()}</div>
    </div>
  );
};

export default React.memo(CharacterDisplay);