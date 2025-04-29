import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './XpDisplay.module.css';

interface XpDisplayProps {
  compact?: boolean;
  onClick?: () => void;
  transparent?: boolean;
}

const XpDisplay: React.FC<XpDisplayProps> = ({ compact = false, onClick, transparent = false }) => {
  const { xpInfo, loadingXp } = useAuth();
  const [earningsAnimation, setEarningsAnimation] = useState<{amount: number, active: boolean} | null>(null);
  const [impactAnimation, setImpactAnimation] = useState(false);
  const [leveledUp, setLeveledUp] = useState(false);
  const [badgeProgress, setBadgeProgress] = useState(0);
  
  const prevXp = useRef<number | null>(null);
  const prevLevel = useRef<number | null>(null);
  
  // First-time initialization effect
  useEffect(() => {
    // Force disable level-up animation on first load to ensure it's not stuck on
    localStorage.removeItem('leveledUp');
    setLeveledUp(false);
  }, []);
  
  // Update badge progress separately to ensure smooth animation
  useEffect(() => {
    if (xpInfo) {
      setBadgeProgress(xpInfo.progress);
    }
  }, [xpInfo?.progress]);
  
  // Check for XP changes and trigger animation
  useEffect(() => {
    if (!xpInfo) {
      return;
    }
    
    // Initialize references if not set
    if (prevXp.current === null) {
      prevXp.current = xpInfo.xp;
    }
    
    if (prevLevel.current === null) {
      prevLevel.current = xpInfo.level;
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
        
        // Clear level-up animation state when user earns XP
        // This ensures the animation stops after a user completes a training
        setLeveledUp(false);
        localStorage.removeItem('leveledUp');
      }, 2500);
    }
    
    // Check if level has increased
    if (xpInfo.level > prevLevel.current) {
      // User has leveled up, enable the leveledUp animation
      setLeveledUp(true);
      localStorage.setItem('leveledUp', 'true');
      
      console.log('Level up detected! Animation enabled.');
    }
    
    // Update references
    prevXp.current = xpInfo.xp;
    prevLevel.current = xpInfo.level;
  }, [xpInfo]);
  
  if (loadingXp) {
    return (
      <div className={`${styles.xpDisplay} ${compact ? styles.compact : ''} ${transparent ? styles.transparent : ''}`}>
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
  const tierColorClass = transparent ? '' : getTierColorClass(tierName);
  
  // Get tier color for badge fill
  const getBadgeFillColor = (): string => {
    if (leveledUp) return 'var(--badge-leveled-up-color, #ffdd00)';
    
    switch (tierName) {
      case 'Novice': return 'var(--badge-novice-color, #6c757d)';
      case 'Apprentice': return 'var(--badge-apprentice-color, #28a745)';
      case 'Operator': return 'var(--badge-operator-color, #007bff)';
      case 'Expert': return 'var(--badge-expert-color, #fd7e14)';
      case 'Master': return 'var(--badge-master-color, #dc3545)';
      case 'Legend': return 'var(--badge-legend-color, #9932cc)';
      default: return 'white';
    }
  };
  
  return (
    <div 
      className={`${styles.xpDisplay} ${compact ? styles.compact : ''} ${tierColorClass} ${impactAnimation ? styles.impactAnimation : ''} ${transparent ? styles.transparent : ''}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={`Level ${xpInfo.level} ${tierName}: ${xpInfo.xp}/${xpInfo.nextLevelXp} XP (${xpInfo.progress}%)`}
    >
      {/* XP notification animation */}
      {earningsAnimation && earningsAnimation.active && (
        <div className={`${styles.xpNotification} ${styles.xpAnimating}`}>
          +{earningsAnimation.amount}
        </div>
      )}
      
      <div className={`${styles.levelBadge} ${leveledUp ? styles.leveledUp : ''}`}>
        <div 
          className={styles.levelBadgeBackground} 
          style={{ 
            height: `${badgeProgress}%`,
            backgroundColor: getBadgeFillColor()
          }}
        ></div>
        <span className={styles.levelBadgeValue}>{xpInfo.level}</span>
      </div>
      
      {!compact && (
        <div className={styles.tierName}>
          {tierName}
        </div>
      )}
      
      {(!compact || !transparent) && (
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
      )}
    </div>
  );
};

export default XpDisplay;