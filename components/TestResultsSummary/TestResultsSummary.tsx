import React, { useState, useEffect, useRef } from 'react';
import styles from './TestResultsSummary.module.css';
import useAuth from '../../hooks/useAuth';
import supabase from '../../utils/supabase';
import { useAppState } from '../../contexts/AppStateContext';
import { 
  awardXp, 
  calculateTrainingXp, 
  calculateLevelCompletionXp,
  XpSource 
} from '../../utils/xpSystem';

interface CharTimeData {
  char: string;
  time: number;
}

interface MistakesMap {
  [key: string]: number;
}

interface TestResultsSummaryProps {
  completed: boolean;
  elapsedTime: number;
  replayCount: number;
  mistakesMap: MistakesMap;
  responseTimes: CharTimeData[];
  levelId: string;
  onRepeat: () => void;
  onNext: () => void;
}

interface HistoricalTimes {
  [key: string]: number[];
}

const TestResultsSummary: React.FC<TestResultsSummaryProps> = ({
  completed,
  elapsedTime,
  replayCount,
  mistakesMap,
  responseTimes,
  levelId,
  onRepeat,
  onNext
}) => {
  const { user, refreshXpInfo, updateXp } = useAuth();
  const { state, getCurrentLevel } = useAppState();
  const [historyAvgTimes, setHistoryAvgTimes] = useState<Record<string, number>>({});
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const resultsSaved = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [earnedXp, setEarnedXp] = useState<{ total: number, breakdown: Record<string, number> } | null>(null);
  const [levelUpEarned, setLevelUpEarned] = useState(false);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onRepeat();
      } else if (e.key === 'Enter' && completed) {
        e.preventDefault();
        onNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRepeat, onNext, completed]);
  
  // Fetch historical average times for user if logged in
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || !completed) return;
      
      setIsLoadingHistory(true);
      try {
        // Fetch previous training results data for this level
        const { data, error } = await supabase
          .from('training_results')
          .select('times')
          .eq('user_id', user.id)
          .eq('mode', state.mode) // Use the current mode (copy or send)
          .eq('level_id', levelId);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Collect all times for each character
          const historicalData: HistoricalTimes = {};
          
          data.forEach(record => {
            if (record.times) {
              Object.entries(record.times).forEach(([char, time]) => {
                if (!historicalData[char]) {
                  historicalData[char] = [];
                }
                historicalData[char].push(time as number);
              });
            }
          });
          
          // Calculate averages
          const averages: Record<string, number> = {};
          Object.entries(historicalData).forEach(([char, times]) => {
            averages[char] = times.reduce((sum, t) => sum + t, 0) / times.length;
          });
          
          setHistoryAvgTimes(averages);
        }
      } catch (err) {
        console.error('Error loading historical data:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    fetchHistory();
  }, [user, completed, levelId, state.mode]);
  
  // Save results to database if completed and user is logged in
  useEffect(() => {
    const saveResults = async () => {
      if (!user || !completed || resultsSaved.current) return;
      
      // Set this flag immediately to prevent multiple executions
      resultsSaved.current = true;
      
      try {
        // Calculate average times per character
        const avgTimes: Record<string, number> = {};
        const charTimesMap: Record<string, number[]> = {};
        
        responseTimes.forEach(rt => {
          if (!charTimesMap[rt.char]) charTimesMap[rt.char] = [];
          charTimesMap[rt.char].push(rt.time);
        });
        
        Object.entries(charTimesMap).forEach(([char, times]) => {
          avgTimes[char] = times.reduce((sum, t) => sum + t, 0) / times.length;
        });
        
        // Save training result to Supabase
        await supabase
          .from('training_results')
          .insert([{
            user_id: user.id,
            level_id: levelId,
            mode: state.mode, // Use the current mode (copy or send)
            time_sec: elapsedTime,
            tone_replays: replayCount,
            mistakes: mistakesMap,
            times: avgTimes,
          }]);
          
        // Calculate and award XP
        // 1. Calculate training session XP
        let trainingXp = { total: 0, breakdown: {} };
        let levelCompletionXp = { total: 0, breakdown: {} };
        let totalXp = 0;
        let combinedBreakdown = {};
        
        try {
          const totalMistakes = Object.values(mistakesMap).reduce((a, b) => a + b, 0);
          
          trainingXp = calculateTrainingXp(
            responseTimes.length, // Characters studied
            totalMistakes,
            responseTimes,
            completed
          );
          
          // 2. Calculate level completion XP if this is the first time completing this level
          const currentLevel = getCurrentLevel();
          levelCompletionXp = { total: 0, breakdown: {} };
          
          if (completed && currentLevel && !state.completedLevels.includes(levelId)) {
            levelCompletionXp = calculateLevelCompletionXp(
              levelId, 
              currentLevel.type === 'checkpoint'
            );
          }
          
          // 3. Combine XP from both sources
          totalXp = trainingXp.total + levelCompletionXp.total;
          combinedBreakdown = {
            ...trainingXp.breakdown,
            ...(levelCompletionXp.total > 0 ? { levelCompletion: levelCompletionXp.total } : {})
          };
          
        } catch (error) {
          console.error('Error calculating XP:', error, { 
            responseTimes, 
            mistakesMap, 
            levelId, 
            completed,
            currentLevel: getCurrentLevel(),
            completedLevels: state.completedLevels
          });
        }
        
        // 4. Save the earned XP data for local use
        try {
          setEarnedXp({ 
            total: totalXp, 
            breakdown: combinedBreakdown 
          });
        } catch (error) {
          console.error('Error setting earned XP:', error, { totalXp, combinedBreakdown });
        }
        
        // 5. Award XP to the user
        if (totalXp > 0) {
          try {
            const result = await awardXp(
              user.id,
              totalXp, 
              XpSource.TRAINING, 
              {
                level_id: levelId,
                mode: state.mode,
                completed
              }
            );
            
            if (result.success) {
              // Refresh the XP info in the auth context
              if (typeof refreshXpInfo === 'function') {
                try {
                  await refreshXpInfo();
                  
                  // If we have the result data, update the XP directly 
                  // This will trigger the animation in the XpDisplay component
                  if (result.result) {
                    // First check if user leveled up
                    if (result.leveledUp) {
                      setLevelUpEarned(true);
                    }
                    
                    // Then update the XP to trigger the animation
                    if (result.result.new_xp) {
                      updateXp(result.result.new_xp);
                    }
                  }
                  
                } catch (refreshError) {
                  console.error('Error refreshing XP info:', refreshError);
                }
              } else {
                console.error('refreshXpInfo is not a function:', { refreshXpInfo });
              }
            } else {
              console.error('Failed to award XP:', result);
            }
          } catch (error) {
            console.error('Error awarding XP:', error, { 
              userId: user.id, 
              totalXp, 
              levelId, 
              mode: state.mode 
            });
          }
        }
      } catch (err) {
        console.error('Error saving training result:', err);
      }
    };
    
    saveResults();
    
    // Only depend on completed state and user to minimize re-runs
  }, [completed, user, levelId, responseTimes, mistakesMap, state.mode, state.completedLevels, getCurrentLevel, elapsedTime, replayCount, refreshXpInfo, updateXp]);
  // Format time as MM:SS with hover tooltip for precise seconds
  const formatTime = (totalSec: number) => {
    const minutes = Math.floor(totalSec / 60);
    const secondsInt = Math.floor(totalSec % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(minutes)}:${pad(secondsInt)}`;
  };

  // Get top struggles
  const struggles = Object.entries(mistakesMap)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Compute average response time per character
  const charTimesMap: Record<string, number[]> = {};
  responseTimes.forEach((rt) => {
    if (!charTimesMap[rt.char]) charTimesMap[rt.char] = [];
    charTimesMap[rt.char].push(rt.time);
  });

  const avgTimes: Record<string, number> = {};
  Object.entries(charTimesMap).forEach(([c, timesArr]) => {
    avgTimes[c] = timesArr.reduce((sum, t) => sum + t, 0) / timesArr.length;
  });

  // Determine if a response time is fast, medium, or slow
  const getSpeedClass = (time: number) => {
    if (time < 0.8) return `${styles.bar} ${styles.fast}`;
    if (time < 3.0) return `${styles.bar} ${styles.medium}`;
    return `${styles.bar} ${styles.slow}`;
  };

  // Get mode-specific title
  const getModeTitle = () => {
    if (state.mode === 'send') {
      return 'Sending Practice Complete!';
    }
    return 'Level Complete!';
  };

  return (
    <div className={styles.resultsContainer}>
      <h2>{completed ? getModeTitle() : 'Level Incomplete'}</h2>
      
      <div className={styles.summary}>
        <p className={styles.time}>
          Time: <span title={`${elapsedTime.toFixed(2)}s`}>{formatTime(elapsedTime)}</span>
        </p>
        {state.mode === 'copy' && (
          <p className={styles.replays}>Replays: {replayCount}</p>
        )}
      </div>
      
      {struggles.length > 0 && (
        <div className={styles.strugglesSection}>
          <h3>Characters you struggled with:</h3>
          <ul className={styles.strugglesList}>
            {struggles.map(([c, count]) => (
              <li key={c}>
                {c.toUpperCase()}: {count} mistake{count > 1 ? 's' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div id="char-times" className={styles.timesSection}>
        <h3>Average Response Times</h3>
        <table className={styles.timesTable}>
          <thead>
            <tr>
              <th>Char</th>
              <th>This Test</th>
              {Object.keys(historyAvgTimes).length > 0 && <th>Your History</th>}
            </tr>
          </thead>
          <tbody>
            {Object.keys(avgTimes)
              .sort()
              .map((ch) => (
                <tr key={ch}>
                  <td>{ch.toUpperCase()}</td>
                  <td>
                    <div className={styles.timeBarContainer}>
                      <div 
                        className={getSpeedClass(avgTimes[ch])}
                        style={{ width: `${Math.min(avgTimes[ch] * 20, 100)}%` }}
                      ></div>
                      <span>{avgTimes[ch].toFixed(2)}s</span>
                    </div>
                  </td>
                  {Object.keys(historyAvgTimes).length > 0 && (
                    <td>
                      {historyAvgTimes[ch] ? (
                        <div className={styles.timeBarContainer}>
                          <div 
                            className={getSpeedClass(historyAvgTimes[ch])}
                            style={{ width: `${Math.min(historyAvgTimes[ch] * 20, 100)}%` }}
                          ></div>
                          <span>{historyAvgTimes[ch].toFixed(2)}s</span>
                        </div>
                      ) : (
                        <span className={styles.noData}>No data</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      
      {/* Keep only the level up message */}
      {levelUpEarned && (
        <div className={styles.levelUp}>
          <h4>Level Up!</h4>
          <p>You&apos;ve reached a new level!</p>
        </div>
      )}
      
      <div className={styles.actions}>
        <button 
          className={styles.repeatButton} 
          onClick={onRepeat}
        >
          Repeat Lesson
        </button>
        <button 
          className={styles.nextButton} 
          onClick={onNext}
          disabled={!completed}
        >
          Next Lesson
        </button>
      </div>
      
      <div className={styles.actionHints}>
        <span>Tab: Repeat Lesson, Enter: Next Lesson</span>
      </div>
    </div>
  );
};

export default TestResultsSummary;