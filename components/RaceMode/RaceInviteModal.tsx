import React from 'react';
import styles from './RaceMode.module.css';

interface RaceInviteModalProps {
  isOpen: boolean;
  inviterName: string;
  onAccept: () => void;
  onDecline: () => void;
}

const RaceInviteModal: React.FC<RaceInviteModalProps> = ({
  isOpen,
  inviterName,
  onAccept,
  onDecline
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Race Invitation</h3>
        </div>
        <div className={styles.modalBody}>
          <p>
            <strong>{inviterName}</strong> has started a new race and invited you to join!
          </p>
          <div className={styles.raceIcon}>
            🏁
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button 
            className={styles.declineButton} 
            onClick={onDecline}
          >
            Decline
          </button>
          <button 
            className={styles.acceptButton} 
            onClick={onAccept}
            autoFocus
          >
            Join Race
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaceInviteModal; 