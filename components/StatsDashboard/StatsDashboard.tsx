import React, { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import supabase from '../../utils/supabase';
import styles from './StatsDashboard.module.css';

interface ProgressRecord {
  mistakes: Record<string, number>;
  times: Record<string, number>;
  created_at: string;
  time_sec: number; // duration of session in seconds
}

const StatsDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // toggles for showing full lists
  const [showAllBest, setShowAllBest] = useState(false);
  const [showAllWorst, setShowAllWorst] = useState(false);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('training_results')
          .select('mistakes, times, created_at, time_sec')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setProgress(data || []);
      } catch (err) {
        console.error('Error loading stats:', err);
        setError('Failed to load stats data');
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) {
      fetchProgress();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return <div className={styles.loading}>Loading stats...</div>;
  }
  if (!user) {
    return <div className={styles.message}>Please log in to view stats.</div>;
  }
  if (error) {
    return <div className={styles.error}>{error}</div>;
  }
  if (progress.length === 0) {
    return <div className={styles.message}>No training data available.</div>;
  }

  // Heatmap data for last 30 days
  const dateCounts: { [key: string]: number } = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dateCounts[key] = 0;
  }
  progress.forEach((row) => {
    const date = row.created_at.slice(0, 10);
    if (date in dateCounts) {
      dateCounts[date]++;
    }
  });
  const maxCount = Math.max(...Object.values(dateCounts));
  const heatmapDates = Object.keys(dateCounts);

  // Character stats
  type CharStat = { char: string; mistakes: number; avgTime: number };
  const charMap: { [key: string]: { mistakes: number; times: number[] } } = {};
  progress.forEach((row) => {
    const { mistakes = {}, times = {} } = row;
    Object.entries(mistakes).forEach(([c, count]) => {
      if (!charMap[c]) charMap[c] = { mistakes: 0, times: [] };
      charMap[c].mistakes += count;
    });
    Object.entries(times).forEach(([c, t]) => {
      if (!charMap[c]) charMap[c] = { mistakes: 0, times: [] };
      charMap[c].times.push(t);
    });
  });
  const charStats: CharStat[] = Object.entries(charMap).map(([c, v]) => ({
    char: c.toUpperCase(),
    mistakes: v.mistakes,
    avgTime: v.times.length > 0 ? v.times.reduce((a, b) => a + b, 0) / v.times.length : 0,
  }));
  const bestChars = [...charStats].sort((a, b) => a.avgTime - b.avgTime);
  const worstChars = [...charStats].sort((a, b) => b.mistakes - a.mistakes);

  // Summary metrics
  const trainingsCount = progress.length;
  const totalTimeSec = progress.reduce((sum, row) => sum + (row.time_sec || 0), 0);
  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}h ${m}m ${s}s`;
  };
  
  // Character error mastery heatmap data
  const allChars = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase().split('');
  const maxMistakes = Math.max(...Object.values(charMap).map(v => v.mistakes), 1);


  return (
    <div className={styles.container}>
      <h1>User Stats</h1>
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          Trainings completed: <strong>{trainingsCount}</strong>
        </div>
        <div className={styles.summaryItem}>
          Total time spent: <strong>{formatDuration(totalTimeSec)}</strong>
        </div>
      </div>
      <section className={styles.section}>
        <h2>Activity Heatmap (Last 30 days)</h2>
        <div className={styles.heatmapContainer}>
          {heatmapDates.map((date) => {
            const count = dateCounts[date];
            const intensity = maxCount > 0 ? count / maxCount : 0;
            const color = `rgba(56,179,0,${0.2 + intensity * 0.8})`;
            return (
              <div
                key={date}
                className={styles.heatmapCell}
                title={`${date}: ${count} session${count !== 1 ? 's' : ''}`}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
      </section>
      <section className={styles.section}>
        <h2>Best Characters (Fastest)</h2>
        <ul className={styles.charList}>
          {(showAllBest ? bestChars : bestChars.slice(0, 5)).map((item) => (
            <li key={item.char} className={styles.charItem}>
              {item.char}: {item.avgTime.toFixed(2)}s
            </li>
          ))}
        </ul>
        {bestChars.length > 5 && (
          <button className={styles.toggleButton} onClick={() => setShowAllBest(!showAllBest)}>
            {showAllBest ? 'Show Top 5' : 'Show All'}
          </button>
        )}
      </section>
      <section className={styles.section}>
        <h2>Worst Characters (Most Mistakes)</h2>
        <ul className={styles.charList}>
          {(showAllWorst ? worstChars : worstChars.slice(0, 5)).map((item) => (
            <li key={item.char} className={styles.charItem}>
              {item.char}: {item.mistakes} mistake{item.mistakes !== 1 ? 's' : ''}
            </li>
          ))}
        </ul>
        {worstChars.length > 5 && (
          <button className={styles.toggleButton} onClick={() => setShowAllWorst(!showAllWorst)}>
            {showAllWorst ? 'Show Top 5' : 'Show All'}
          </button>
        )}
      </section>
      {/* Character Mastery Heatmap */}
      <section className={styles.section}>
        <h2>Character Mastery Heatmap</h2>
        <div className={styles.charHeatmapContainer}>
          {allChars.map((char) => {
            const count = charMap[char.toLowerCase()]?.mistakes || 0;
            const ratio = count / maxMistakes;
            return (
              <div
                key={char}
                className={styles.charHeatmapCell}
                title={`${char}: ${count} mistake${count !== 1 ? 's' : ''}`}
                style={{ '--heatmap-ratio': ratio } as React.CSSProperties}
              >
                {char}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default StatsDashboard;