import React from 'react';
import RaceParticipants from '../../RaceParticipants/RaceParticipants';
import { RaceParticipant, RaceMode } from '../../../types/raceTypes';
import styles from '../RaceMode.module.css';

interface RacingStageProps {
  raceMode: RaceMode;
  raceText: string;
  userProgress: number;
  currentCharIndex: number;
  participants: RaceParticipant[];
  currentUserId: string;
  raceLength: number;
  onlineUserIds: string[];
  keyerOutput: string;
  showCorrectIndicator: boolean;
  onReplayCurrent: () => void;
}

/**
 * Main racing stage where users participate in the race
 */
const RacingStage: React.FC<RacingStageProps> = ({
  raceMode,
  raceText,
  userProgress,
  currentCharIndex,
  participants,
  currentUserId,
  raceLength,
  onlineUserIds,
  keyerOutput,
  showCorrectIndicator,
  onReplayCurrent
}) => {
  return (
    <div className={styles.raceContainer}>
      <div className={styles.morseText}>
        <div className={styles.textDisplay}>
          <h3>{raceMode === 'copy' 
            ? 'Type the characters as you hear them:' 
            : 'Send the characters you see using Morse code:'}</h3>
          <div className={styles.textContainer}>
            {/* Display progress but not the actual characters */}
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${userProgress}%` }}
              />
            </div>
            <div className={styles.characterCount}>
              {Math.floor((userProgress / 100) * raceText.length)} / {raceText.length} characters
            </div>
          </div>
        </div>
        
        {/* Character display depends on mode */}
        <div className={styles.currentCharContainer}>
          <div className={styles.currentCharPrompt}>Current character:</div>
          <div className={styles.currentChar}>
            {raceMode === 'send' && !showCorrectIndicator
              ? (raceText[currentCharIndex]?.toUpperCase() || '') 
              : ''  /* Hide character in copy mode or when showing correct indicator */
            }
          </div>
          <div className={styles.typingInstructions}>
            {raceMode === 'copy'
              ? 'Listen for the Morse code and type the character you hear'
              : 'Use ← key for · and → key for - to send the character displayed'
            }
          </div>
        </div>
        
        <div className={styles.raceControls}>
          {raceMode === 'copy' ? (
            <>
              <button 
                onClick={onReplayCurrent}
                className={styles.replayButton}
                title="Replay current character"
              >
                Replay Sound
              </button>
              <div className={styles.hint}>
                Press Tab to replay the current character sound
              </div>
            </>
          ) : (
            <div className={styles.morseControls}>
              <div className={styles.keyerDisplay}>
                <div className={styles.keyerOutput}>{keyerOutput}</div>
              </div>
              <div className={styles.hint}>
                Use ← key for · and → key for –
              </div>
            </div>
          )}
        </div>
      </div>
      
      <RaceParticipants
        participants={participants}
        currentUserId={currentUserId}
        raceLength={raceLength}
        onlineUserIds={onlineUserIds}
        showPlacement={true}
      />
      
      <div className={`${styles.correctIndicator} ${showCorrectIndicator ? styles.visible : ''}`}>✓</div>
    </div>
  );
};

export default RacingStage; 