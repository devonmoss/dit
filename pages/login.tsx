import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import styles from '../styles/Login.module.css';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { user, signIn, signUp, signInWithGithub } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!email || !password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }
    
    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!email || !password || !username) {
      setError('Email, password, and username are required');
      setLoading(false);
      return;
    }
    
    // Simple username validation
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores and hyphens');
      setLoading(false);
      return;
    }
    
    try {
      const { error: signUpError } = await signUp(email, password, username);
      
      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Successful signup will automatically log the user in
        router.push('/');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign up error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGithubLogin = async () => {
    try {
      await signInWithGithub();
      // Note: This will redirect the user away from this page
    } catch (err) {
      setError('An error occurred while signing in with GitHub');
      console.error('GitHub sign in error:', err);
    }
  };
  
  return (
    <>
      <Head>
        <title>{isSignUp ? 'Sign Up' : 'Log In'} | Morse Trainer</title>
      </Head>
      
      <div className={styles.container}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>{isSignUp ? 'Create an Account' : 'Welcome Back'}</h1>
          
          <div className={styles.toggleContainer}>
            <button 
              className={`${styles.toggleButton} ${!isSignUp ? styles.activeToggle : ''}`}
              onClick={() => setIsSignUp(false)}
            >
              Log In
            </button>
            <button 
              className={`${styles.toggleButton} ${isSignUp ? styles.activeToggle : ''}`}
              onClick={() => setIsSignUp(true)}
            >
              Sign Up
            </button>
          </div>
          
          {isSignUp ? (
            <form onSubmit={handleSignUp} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                />
              </div>
              
              {error && <div className={styles.error}>{error}</div>}
              
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                />
              </div>
              
              {error && <div className={styles.error}>{error}</div>}
              
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Logging In...' : 'Log In'}
              </button>
            </form>
          )}
          
          <div className={styles.separator}>
            <span>or</span>
          </div>
          
          <button 
            onClick={handleGithubLogin}
            className={styles.githubButton}
          >
            Continue with GitHub
          </button>
          
          <div className={styles.returnHome}>
            <a onClick={() => router.push('/')}>Return to Home</a>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage; 