import React, { useState, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { trainingLevels } from '../../utils/levels';
import ProgressDashboard from '../ProgressDashboard/ProgressDashboard';
import styles from './TopMenu.module.css';
import { useRouter } from 'next/router';
import useAuth from '../../hooks/useAuth';

// Import TestType from AppStateContext
import type { AppState } from '../../contexts/AppStateContext';
type TestType = AppState['testType'];
type Theme = AppState['theme'];

const TopMenu: React.FC = () => {
  const { 
    state, 
    selectLevel, 
    setMode, 
    setTestType, 
    setWpm, 
    setVolume, 
    setSendWpm,
    setTheme,
    endTest
  } = useAppState();
  
  const router = useRouter();
  const { user } = useAuth();
  
  const [showLevels, setShowLevels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Only run client-side code after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMode(event.target.value as 'copy' | 'send');
  };
  
  const handleTestTypeClick = (testType: TestType) => {
    setTestType(testType);
    
    // Handle navigation based on test type
    if (testType === 'race') {
      router.push('/race');
    } else if (testType === 'training') {
      router.push('/');
    } else if (testType === 'time') {
      router.push('/time');
    } else if (testType === 'words') {
      router.push('/words');
    }
  };
  
  const handleLevelClick = (id: string) => {
    // End test if active - this will reset to the start screen
    if (state.testActive) {
      endTest(false);
    }
    
    selectLevel(id);
    setShowLevels(false);
  };
  
  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWpm(parseInt(event.target.value, 10));
  };
  
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(event.target.value, 10));
  };
  
  const handleSendSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSendWpm(parseInt(event.target.value, 10));
  };
  
  const handleThemeChange = (theme: Theme) => {
    setTheme(theme);
    setShowSettings(false);
  };

  // If not mounted yet, render a minimal placeholder version without interactive elements
  if (!mounted) {
    return (
      <nav className={styles.topMenu}>
        <div className={styles.menuWrapper}>
          <div className={styles.menuSection}></div>
          <div className={styles.menuSection}></div>
          <div className={styles.menuSection}></div>
        </div>
      </nav>
    );
  }
  
  const currentLevel = trainingLevels.find(level => level.id === state.selectedLevelId);

  return (
    <>
      <nav className={styles.topMenu}>
        <div className={styles.menuWrapper}>
        {/* Left section - Mode Selection */}
        <div className={styles.menuSection}>
          <div 
            className={styles.toggleTrack} 
            onClick={() => setMode(state.mode === 'copy' ? 'send' : 'copy')}
          >
            <span className={`${styles.toggleLabel} ${state.mode === 'copy' ? styles.activeLabel : ''}`}>copy</span>
            <span className={`${styles.toggleLabel} ${state.mode === 'send' ? styles.activeLabel : ''}`}>send</span>
            <div className={`${styles.toggleThumb} ${state.mode === 'send' ? styles.toggleRight : ''}`}></div>
          </div>
        </div>
        
        {/* Middle section - Test Types */}
        <div className={styles.menuSection}>
          <button 
            className={`${styles.menuItem} ${state.testType === 'time' ? styles.active : ''}`}
            onClick={() => handleTestTypeClick('time')}
            disabled={true} // Feature not yet implemented
            title="Coming soon! Complete as many characters as possible in a set amount of time."
          >
            time
          </button>
          <button 
            className={`${styles.menuItem} ${state.testType === 'words' ? styles.active : ''}`}
            onClick={() => handleTestTypeClick('words')}
            disabled={true} // Feature not yet implemented
            title="Coming soon! Identify or send words of various sizes."
          >
            words
          </button>
          <button 
            className={`${styles.menuItem} ${state.testType === 'training' ? styles.active : ''}`}
            onClick={() => handleTestTypeClick('training')}
          >
            training
          </button>
          <button 
            className={`${styles.menuItem} ${state.testType === 'race' ? styles.active : ''} ${styles.raceMenuItem}`}
            onClick={() => handleTestTypeClick('race')}
            data-mode="race"
          >
            race
          </button>
        </div>
        
        {/* Right section - Levels and Settings */}
        <div className={styles.menuSection}>
          {/* Level selector */}
          <div className={styles.levelSelector}>
            <button 
              className={`${styles.menuItem} ${styles.active}`} 
              onClick={() => setShowLevels(!showLevels)}
            >
              {currentLevel?.name || 'Select Level'}
            </button>
            
            {showLevels && (
              <ul className={styles.levelDropdown}>
                {trainingLevels.map(level => (
                  <li 
                    key={level.id}
                    className={`${styles.levelItem} ${state.completedLevels.includes(level.id) ? styles.completed : ''} ${state.selectedLevelId === level.id ? styles.selected : ''}`}
                    onClick={() => handleLevelClick(level.id)}
                  >
                    {level.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Settings gear icon */}
          <button 
            className={styles.menuItem}
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙
          </button>
          
          {showSettings && (
            <ul className={styles.settingsDropdown}>
              <li>
                <label>
                  Speed: <span>{state.wpm}</span> WPM
                  <input 
                    type="range" 
                    min="5" 
                    max="40" 
                    step="1" 
                    value={state.wpm} 
                    onChange={handleSpeedChange} 
                  />
                </label>
              </li>
              <li>
                <label>
                  Volume: <span>{state.volume}</span>%
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1" 
                    value={state.volume} 
                    onChange={handleVolumeChange} 
                  />
                </label>
              </li>
              <li>
                <label>
                  Send Speed: <span>{state.sendWpm}</span> WPM
                  <input 
                    type="range" 
                    min="5" 
                    max="40" 
                    step="1" 
                    value={state.sendWpm} 
                    onChange={handleSendSpeedChange} 
                  />
                </label>
              </li>
              <li>
                <label>Theme:</label>
                <div className={styles.themeOptions}>
                  <button 
                    className={`${styles.themeButton} ${state.theme === 'default' ? styles.activeTheme : ''}`}
                    onClick={() => handleThemeChange('default')}
                  >
                    Default
                  </button>
                  <button 
                    className={`${styles.themeButton} ${state.theme === 'catppuccin-mocha' ? styles.activeTheme : ''}`}
                    onClick={() => handleThemeChange('catppuccin-mocha')}
                  >
                    Catppuccin Mocha
                  </button>
                </div>
              </li>
              <li>
                <button 
                  className={styles.settingsItem}
                  onClick={() => {
                    setShowSettings(false);
                    setShowProgress(true);
                  }}
                >
                  My Progress
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </nav>
      {showProgress && <ProgressDashboard onClose={() => setShowProgress(false)} />}
    </>
  );
};

export default TopMenu; 