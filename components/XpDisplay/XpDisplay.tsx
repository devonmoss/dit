import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './XpDisplay.module.css';

interface XpDisplayProps {
  compact?: boolean;
  onClick?: () => void;
}

const XpDisplay: React.FC<XpDisplayProps> = ({ compact = false, onClick }) => {
  const { xpInfo, loadingXp } = useAuth();
  const [earningsAnimation, setEarningsAnimation] = useState<{amount: number, active: boolean} | null>(null);
  const [impactAnimation, setImpactAnimation] = useState(false);
  const prevXp = useRef<number | null>(null);
  
  // Check for XP changes and trigger animation
  useEffect(() => {
    if (!xpInfo || !prevXp.current) {
      // Initialize reference without animation
      prevXp.current = xpInfo?.xp || 0;
      return;
    }
    
    // Check if XP has increased
    if (xpInfo.xp > prevXp.current) {
      const earned = xpInfo.xp - prevXp.current;
      
      // Trigger the earning animation
      setEarningsAnimation({
        amount: earned,
        active: true
      });
      
      // Trigger impact animation with a slight delay
      setTimeout(() => {
        setImpactAnimation(true);
      }, 1200);
      
      // Reset animations after they complete
      setTimeout(() => {
        setEarningsAnimation(null);
        setImpactAnimation(false);
      }, 2500);
    }
    
    // Update reference
    prevXp.current = xpInfo.xp;
  }, [xpInfo]);
  
  if (loadingXp) {
    return (
      <div className={`${styles.xpDisplay} ${compact ? styles.compact : ''}`}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }
  
  if (!xpInfo) {
    return null;
  }
  
  // Determine tier color class
  const getTierColorClass = (tier: string): string => {
    switch (tier) {
      case 'Novice':
        return styles.tierNovice;
      case 'Apprentice':
        return styles.tierApprentice;
      case 'Operator':
        return styles.tierOperator;
      case 'Expert':
        return styles.tierExpert;
      case 'Master':
        return styles.tierMaster;
      case 'Legend':
        return styles.tierLegend;
      default:
        return '';
    }
  };
  
  // Default to 'Novice' if tier is not provided
  const tierName = xpInfo.tier || 'Novice';
  const tierColorClass = getTierColorClass(tierName);
  
  return (
    <div 
      className={`${styles.xpDisplay} ${compact ? styles.compact : ''} ${tierColorClass} ${impactAnimation ? styles.impactAnimation : ''}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* XP notification animation */}
      {earningsAnimation && earningsAnimation.active && (
        <div className={`${styles.xpNotification} ${styles.xpAnimating}`}>
          +{earningsAnimation.amount}
        </div>
      )}
      
      <div className={styles.levelBadge}>
        {xpInfo.level}
      </div>
      
      {!compact && (
        <div className={styles.tierName}>
          {tierName}
        </div>
      )}
      
      <div className={styles.progressContainer}>
        <div 
          className={styles.progressBar}
          style={{ width: `${xpInfo.progress}%` }}
        ></div>
        
        {!compact && (
          <div className={styles.progressText}>
            {xpInfo.xp} / {xpInfo.nextLevelXp} XP
          </div>
        )}
      </div>
    </div>
  );
};

export default XpDisplay;