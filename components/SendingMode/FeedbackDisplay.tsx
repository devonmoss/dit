import React from 'react';
import styles from './SendingMode.module.css';

interface FeedbackDisplayProps {
  feedbackState: 'none' | 'correct' | 'incorrect';
  incorrectChar: string;
}

/**
 * Displays feedback to the user about their input (correct or incorrect)
 */
const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedbackState, incorrectChar }) => {
  if (feedbackState === 'none') {
    return null;
  }

  return (
    <div className={styles.feedbackContainer}>
      {feedbackState === 'correct' && (
        <div className={styles.correctFeedback}>Correct!</div>
      )}
      {feedbackState === 'incorrect' && (
        <div className={styles.incorrectFeedback}>{incorrectChar}</div>
      )}
    </div>
  );
};

export default React.memo(FeedbackDisplay);