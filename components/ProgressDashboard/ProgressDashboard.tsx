import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './ProgressDashboard.module.css';
import useAuth from '../../hooks/useAuth';
import supabase from '../../utils/supabase';

interface ProgressRecord {
  level_id: string;
  mode: string;
  time_sec: number;
  tone_replays: number;
  mistakes: Record<string, number>;
  times: Record<string, number>;
  created_at: string;
}

const ProgressDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('training_results')
          .select('level_id, mode, time_sec, tone_replays, mistakes, times, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setProgress(data || []);
      } catch (err) {
        console.error('Error loading progress:', err);
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProgress();
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>My Progress</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>My Progress</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.loginPrompt}>
          <p>Please log in to view your progress.</p>
          <button 
            className={styles.loginButton}
            onClick={() => router.push('/login')}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>My Progress</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.loading}>Loading progress data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>My Progress</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>My Progress</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.noData}>You haven't completed any training sessions yet.</div>
      </div>
    );
  }

  const formatTime = (totalSec: number) => {
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toFixed(2).padStart(5, '0');
    return `${mm}:${ss}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>My Progress</h2>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>
      
      <div className={styles.tableContainer}>
        <table className={styles.progressTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Level</th>
              <th>Mode</th>
              <th>Time</th>
              <th>Replays</th>
              <th>Mistakes</th>
              <th>Avg Times</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((row, index) => {
              const date = new Date(row.created_at).toLocaleString();
              const time = formatTime(row.time_sec);
              
              const mistakesList = Object.entries(row.mistakes || {})
                .map(([c, count]) => `${c.toUpperCase()}:${count}`)
                .join(', ');
              
              const timesList = Object.entries(row.times || {})
                .map(([c, t]) => `${c.toUpperCase()}:${t.toFixed(2)}s`)
                .join(', ');
              
              return (
                <tr key={index}>
                  <td>{date}</td>
                  <td>{row.level_id}</td>
                  <td>{row.mode}</td>
                  <td>{time}</td>
                  <td>{row.tone_replays}</td>
                  <td className={styles.detailCell}>{mistakesList}</td>
                  <td className={styles.detailCell}>{timesList}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProgressDashboard;