import React from 'react';
import RaceParticipants from '../../RaceParticipants/RaceParticipants';
import { RaceParticipant, RaceStats } from '../../../types/raceTypes';
import styles from '../RaceMode.module.css';

interface ResultsStageProps {
  stats: RaceStats | null;
  errorCount: number;
  participants: RaceParticipant[];
  currentUserId: string;
  raceLength: number;
  onlineUserIds: string[];
  isCreatingRace: boolean;
  onNavigateHome: () => void;
  onRaceAgain: () => void;
}

/**
 * Race results stage showing final statistics and rankings
 */
const ResultsStage: React.FC<ResultsStageProps> = ({
  stats,
  errorCount,
  participants,
  currentUserId,
  raceLength,
  onlineUserIds,
  isCreatingRace,
  onNavigateHome,
  onRaceAgain
}) => {
  return (
    <div className={styles.resultsContainer}>
      <h2>Race Complete!</h2>
      
      {stats && (
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Your Speed:</span>
            <span className={styles.statValue}>{stats.wpm} WPM</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Time:</span>
            <span className={styles.statValue}>
              {stats.time.toFixed(2)}s
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Errors:</span>
            <span className={styles.statValue}>{errorCount}</span>
          </div>
        </div>
      )}
      
      <h3>Final Rankings</h3>
      <RaceParticipants
        participants={participants.sort((a, b) => {
          if (a.finished === b.finished) {
            if (a.finishTime && b.finishTime) {
              return a.finishTime - b.finishTime;
            }
            return b.progress - a.progress;
          }
          return a.finished ? -1 : 1;
        })}
        currentUserId={currentUserId}
        raceLength={raceLength}
        onlineUserIds={onlineUserIds}
        showPlacement={true}
      />
      
      <div className={styles.actions}>
        <button
          className={styles.newRaceButton}
          onClick={onNavigateHome}
        >
          Create New Race
        </button>
        <button
          className={styles.raceAgainButton}
          onClick={onRaceAgain}
          disabled={isCreatingRace}
        >
          {isCreatingRace ? 'Creating...' : 'Race Again'}
        </button>
      </div>
    </div>
  );
};

export default ResultsStage; 