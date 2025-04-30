import React from 'react';
import styles from './RaceParticipants.module.css';

interface Participant {
  id: string;
  name: string;
  progress: number;
  finished?: boolean;
  finishTime?: number;
  errorCount?: number;
  raceTime?: number; // Duration in seconds
}

interface RaceParticipantsProps {
  participants: Participant[];
  currentUserId?: string;
  raceLength?: number;
  onlineUserIds?: string[];
  showPlacement?: boolean;
}

const RaceParticipants: React.FC<RaceParticipantsProps> = ({ 
  participants, 
  currentUserId,
  raceLength = 100,
  onlineUserIds = [],
  showPlacement = false
}) => {
  // Sort participants by progress and finish time
  const sortedParticipants = [...participants]
    .sort((a, b) => {
      // First sort by finished state
      if (a.finished !== b.finished) {
        return a.finished ? -1 : 1;
      }
      
      // Then by finish time if both finished
      if (a.finished && b.finished && a.finishTime && b.finishTime) {
        return a.finishTime - b.finishTime;
      }
      
      // Lastly by progress
      return b.progress - a.progress;
    });

  // Get medal for placement
  const getMedalBadge = (placement: number, finished: boolean | undefined) => {
    if (!finished) return null;
    
    switch (placement) {
      case 1:
        return <span className={`${styles.medalBadge} ${styles.gold}`}>🥇</span>;
      case 2:
        return <span className={`${styles.medalBadge} ${styles.silver}`}>🥈</span>;
      case 3:
        return <span className={`${styles.medalBadge} ${styles.bronze}`}>🥉</span>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.participantsContainer}>
      <h3>Participants</h3>
      
      <div className={styles.list}>
        {sortedParticipants.length === 0 ? (
          <div className={styles.noParticipants}>
            Waiting for participants to join...
          </div>
        ) : (
          sortedParticipants.map((participant, index) => {
            const progressPercent = (participant.progress / raceLength) * 100;
            const isCurrentUser = participant.id === currentUserId;
            const isOnline = onlineUserIds.includes(participant.id);
            const placement = index + 1;
            const placementSuffix = getOrdinalSuffix(placement);
            const medalBadge = getMedalBadge(placement, participant.finished);
            
            return (
              <div 
                key={participant.id} 
                className={`${styles.participant} ${isCurrentUser ? styles.currentUser : ''}`}
              >
                <div className={styles.nameRow}>
                  <div className={styles.nameWithStatus}>
                    <span 
                      className={`${styles.statusIndicator} ${isOnline ? styles.online : styles.offline}`} 
                      title={isOnline ? "Online" : "Offline"}
                    />
                    <span className={styles.name}>
                      {participant.name} {isCurrentUser ? '(You)' : ''}
                    </span>
                  </div>
                  <div className={styles.participantInfo}>
                    {participant.finished && (
                      <>
                        {medalBadge}
                        <span className={styles.placementBadge}>{placement}{placementSuffix}</span>
                      </>
                    )}
                    {participant.finished && (
                      <span className={styles.finishedBadge}>Finished!</span>
                    )}
                    {participant.errorCount !== undefined && (
                      <span className={styles.errorCount}>
                        Errors: {participant.errorCount}
                      </span>
                    )}
                    {participant.finished && participant.raceTime !== undefined && (
                      <span className={styles.raceTime}>
                        Time: {formatRaceTime(participant.raceTime)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${progressPercent}%` }}
                  >
                    <span className={styles.progressText}>
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Helper function to get the ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// Add a helper function to format race time
function formatRaceTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }
}

export default RaceParticipants;