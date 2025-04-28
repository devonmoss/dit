import React, { useState, useEffect } from 'react';
import styles from './AuthPanel.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';
import XpDisplay from '../XpDisplay/XpDisplay';

const AuthPanel: React.FC = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Only run client-side code after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Close panel when clicking outside
  useEffect(() => {
    if (!isFormVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(`.${styles.authWrapper}`)) {
        setIsFormVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFormVisible]);
  
  // If not mounted yet, render a placeholder to avoid hydration mismatch
  if (!mounted) {
    return <div className={styles.authWrapper}>
      <a className={styles.authToggle}>
        Login / Sign Up
      </a>
    </div>;
  }
  
  const handleToggleForm = () => {
    if (!user) {
      // Redirect to login page if not logged in
      router.push('/login');
    } else {
      setIsFormVisible(!isFormVisible);
    }
  };
  
  const handleLogout = async () => {
    try {
      await signOut();
      setIsFormVisible(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };
  
  return (
    <div className={styles.authWrapper}>
      {/* XP Display (only shown when logged in) */}
      {user && (
        <div className={styles.xpDisplayWrapper}>
          <XpDisplay compact={true} transparent={true} onClick={() => setIsFormVisible(true)} />
        </div>
      )}
      
      {/* Toggle button to show/hide auth panel */}
      <a className={`${styles.authToggle} ${user ? styles.loggedIn : ''}`} onClick={handleToggleForm}>
        {user ? `Account (${user.user_metadata?.username || 'User'})` : 'Login / Sign Up'}
      </a>
      
      {/* User info and logout button */}
      {user && isFormVisible && (
        <div className={styles.authLoggedIn}>
          {/* Show full XP display in the dropdown */}
          {user && (
            <div className={styles.fullXpDisplay}>
              <XpDisplay compact={false} transparent={true} />
            </div>
          )}
          
          <div className={styles.userInfo}>
            Logged in as <span>{user.user_metadata?.username || 'User'}</span>
          </div>
          <button
            className={styles.button}
            onClick={handleLogout}
            data-testid="logout-button"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthPanel; 