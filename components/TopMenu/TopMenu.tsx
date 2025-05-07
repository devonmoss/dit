import React, { useState, useEffect, useRef } from 'react';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  
  const [showLevels, setShowLevels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Refs for dropdown containers
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  
  // Only run client-side code after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Handle clicks outside dropdown menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close level dropdown if click is outside
      if (showLevels && 
          levelDropdownRef.current && 
          !levelDropdownRef.current.contains(event.target as Node)) {
        setShowLevels(false);
      }
      
      // Close settings dropdown if click is outside
      if (showSettings && 
          settingsDropdownRef.current && 
          !settingsDropdownRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    
    // Add event listener when dropdowns are open
    if (showLevels || showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLevels, showSettings]);
  
  // Handle mode change with proper navigation
  const handleModeChange = () => {
    // Toggle between copy and send mode
    const newMode = state.mode === 'copy' ? 'send' : 'copy';
    
    // End any active test
    if (state.testActive) {
      endTest(false);
    }
    
    // Set the new mode
    setMode(newMode);
    
    // Ensure we're in training mode
    if (state.testType !== 'training') {
      setTestType('training');
      router.push('/');
    }
  };
  
  const handleTestTypeClick = (testType: TestType) => {
    // End any active test
    if (state.testActive) {
      endTest(false);
    }
    
    // Force test reset when clicking on "training"
    // This ensures we go back to the start screen even from test results
    if (testType === 'training') {
      endTest(false);
    }
    
    setTestType(testType);
    
    // Handle navigation based on test type
    if (testType === 'race') {
      router.push('/race');
    } else if (testType === 'zen') {
      router.push('/zen');
    } else if (testType === 'training') {
      // When returning to training, just navigate to home
      // We'll keep the current level and mode
      router.push('/');
    } else if (testType === 'pota') {
      router.push('/pota');
    } else if (testType === 'words') {
      router.push('/words');
    }
  };
  
  const handleLevelClick = (id: string) => {
    // End test if active - this will reset to the start screen
    if (state.testActive) {
      endTest(false);
    }
    
    // Force the test to reset to the start screen by ending it
    // This ensures level selection works even when on the test results screen
    endTest(false);
    
    // Select the level
    selectLevel(id);
    setShowLevels(false);
    
    // Only navigate to training mode if we're not in race mode
    if (state.testType !== 'training' && state.testType !== 'race') {
      setTestType('training');
      router.push('/');
    } else if (state.testType === 'training') {
      // If already in training mode, ensure we're on the home page
      router.push('/');
    }
    // If in race mode, do nothing - just stay on the race page with the new level selected
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
            onClick={handleModeChange}
          >
            <span className={`${styles.toggleLabel} ${state.mode === 'copy' ? styles.activeLabel : ''}`}>copy</span>
            <span className={`${styles.toggleLabel} ${state.mode === 'send' ? styles.activeLabel : ''}`}>send</span>
            <div className={`${styles.toggleThumb} ${state.mode === 'send' ? styles.toggleRight : ''}`}></div>
          </div>
        </div>
        
        {/* Middle section - Test Types */}
        <div className={styles.menuSection}>
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
          <button 
            className={`${styles.menuItem} ${state.testType === 'zen' ? styles.active : ''}`}
            onClick={() => handleTestTypeClick('zen')}
          >
            zen
          </button>
          <button 
            className={`${styles.menuItem} ${state.testType === 'pota' ? styles.active : ''}`}
            onClick={() => handleTestTypeClick('pota')}
            disabled={true} // Feature not yet implemented
            title="Coming soon! Get familiar with a POTA exchange. Practice hunting and activating."
          >
            pota
          </button>
          <button 
            className={`${styles.menuItem} ${state.testType === 'words' ? styles.active : ''}`}
            onClick={() => handleTestTypeClick('words')}
            disabled={true} // Feature not yet implemented
            title="Coming soon! Identify or send words of various sizes."
          >
            words
          </button>
        </div>
        
        {/* Right section - Levels and Settings */}
        <div className={styles.menuSection}>
          {/* Level selector */}
          <div className={styles.levelSelector} ref={levelDropdownRef}>
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
          <div ref={settingsDropdownRef}>
            <button 
              className={styles.menuItem}
              onClick={() => setShowSettings(!showSettings)}
            >
              <span className={styles.menuIcon}>⚙</span>
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
                      default
                    </button>
                    <button 
                      className={`${styles.themeButton} ${state.theme === 'catppuccin-mocha' ? styles.activeTheme : ''}`}
                      onClick={() => handleThemeChange('catppuccin-mocha')}
                    >
                      catppuccin 
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
      </div>
    </nav>
      {showProgress && <ProgressDashboard onClose={() => setShowProgress(false)} />}
    </>
  );
};

export default TopMenu;