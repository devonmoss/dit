import React, { useState, useEffect } from 'react';
import styles from './AuthPanel.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { isBrowser } from '../../utils/morse';

const AuthPanel: React.FC = () => {
  const { user, signIn, signUp, signOut, signInWithGithub } = useAuth();
  
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
    setIsFormVisible(!isFormVisible);
    // Clear form and errors when toggling
    setEmail('');
    setPassword('');
    setError('');
  };
  
  const handleSignUp = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    try {
      const { error: signUpError } = await signUp(email, password);
      
      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Account created successfully, clear form
        setEmail('');
        setPassword('');
        setError('');
        setIsFormVisible(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign up error:', err);
    }
  };
  
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError.message);
      } else {
        // Logged in successfully, clear form
        setEmail('');
        setPassword('');
        setError('');
        setIsFormVisible(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign in error:', err);
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
  
  const handleGithubLogin = async () => {
    try {
      await signInWithGithub();
    } catch (err) {
      setError('An error occurred while signing in with GitHub');
      console.error('GitHub sign in error:', err);
    }
  };
  
  return (
    <div className={styles.authWrapper}>
      {/* Toggle button to show/hide auth panel */}
      <a className={`${styles.authToggle} ${user ? styles.loggedIn : ''}`} onClick={handleToggleForm}>
        {user ? `Account (${user.email?.split('@')[0] || 'User'})` : 'Login / Sign Up'}
      </a>
      
      {/* Authentication form */}
      {!user && isFormVisible && (
        <div className={styles.authForm}>
          <input
            id="email-input"
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            id="password-input"
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className={styles.button}
            onClick={handleSignUp}
          >
            Sign Up
          </button>
          <button
            className={styles.button}
            onClick={handleLogin}
          >
            Log In
          </button>
          <button
            className={styles.githubButton}
            onClick={handleGithubLogin}
          >
            Sign In with GitHub
          </button>
          {error && <div className={styles.authError}>{error}</div>}
        </div>
      )}
      
      {/* User info and logout button */}
      {user && isFormVisible && (
        <div className={styles.authLoggedIn}>
          <div className={styles.userInfo}>
            Logged in as <span>{user.email}</span>
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