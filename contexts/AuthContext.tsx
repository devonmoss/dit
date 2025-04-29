import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '../utils/supabase';
import { UserEvents, ErrorEvents } from '../utils/analytics';

// XP information type
interface XpInfo {
  xp: number;
  level: number;
  nextLevelXp: number;
  progress: number;
  tier: string; // Added to match XpDisplay component
}

// Define the auth context type
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  xpInfo: XpInfo | null;
  loadingXp: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any, user: User | null }>;
  signOut: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  updateUsername: (username: string) => Promise<{ error: any }>;
  refreshXpInfo: () => Promise<void>;
  updateXp: (newXp: number) => void;
}

// Create context with default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Import the XP utility functions
import { getUserXpInfo } from '../utils/xpSystem';

// Auth provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [xpInfo, setXpInfo] = useState<XpInfo | null>(null);
  const [loadingXp, setLoadingXp] = useState(false);

  // Check and handle GitHub user's username if needed
  const handleGitHubUsername = async (user: User) => {
    try {
      // Check if the user already has a username in metadata
      if (user.user_metadata?.username) {
        return;
      }
      
      // Check if the user has a profile in the database
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      // Skip if we can't fetch the profile
      if (!profile) return;
      
      // If the username is auto-generated (starts with user_)
      if (profile.username.startsWith('user_')) {
        // Extract GitHub username from user metadata
        const githubUsername = user.user_metadata?.user_name || 
                               user.user_metadata?.preferred_username;
        
        if (githubUsername) {
          // Check if this GitHub username is already taken
          const { data: existingUser, error: usernameCheckError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', githubUsername)
            .neq('id', user.id)
            .single();
          
          // Only update if the username is not taken by another user
          if (usernameCheckError && usernameCheckError.code === 'PGRST116') {
            // Update the user metadata with the username
            await supabase.auth.updateUser({
              data: { username: githubUsername }
            });
            
            // Update the profile record
            await supabase
              .from('profiles')
              .update({ username: githubUsername })
              .eq('id', user.id);
          }
        }
      }
    } catch (error) {
      console.error('Error processing GitHub username:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        if (session?.user) {
          setUser(session.user);
          
          // Check and handle GitHub user's username
          if (session.user.app_metadata.provider === 'github') {
            await handleGitHubUsername(session.user);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          setUser(session.user);
          
          // For GitHub sign-ins, handle username
          if (event === 'SIGNED_IN' && session.user.app_metadata.provider === 'github') {
            await handleGitHubUsername(session.user);
          }
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (!error) {
        // Track successful login
        UserEvents.login('email');
      } else {
        // Track login error
        ErrorEvents.supabBaseError('login', error.message);
      }
      
      return { error };
    } catch (error: any) {
      console.error('Error signing in:', error);
      ErrorEvents.supabBaseError('login', error?.message || 'Unknown error');
      return { error };
    }
  };

  // Sign up with email/password and username
  const signUp = async (email: string, password: string, username: string) => {
    try {
      // Check if username already exists
      const { data: existingUsers, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
      
      if (lookupError && lookupError.code !== 'PGRST116') {
        // An error occurred (not the "no rows returned" error)
        ErrorEvents.supabBaseError('signUp-usernameCheck', lookupError.message);
        return { error: lookupError, user: null };
      }
      
      if (existingUsers) {
        // Username already exists
        return { 
          error: { message: 'Username already taken' }, 
          user: null 
        };
      }
      
      // Create the user with username in metadata
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            username
          }
        }
      });
      
      if (data.user && !error) {
        // Create a profile record with the username
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username
          });
          
        if (profileError) {
          console.error('Error creating profile:', profileError);
          ErrorEvents.supabBaseError('signUp-createProfile', profileError.message);
          return { error: profileError, user: data.user };
        }
        
        // Track successful signup
        UserEvents.signup('email');
      } else if (error) {
        ErrorEvents.supabBaseError('signUp', error.message);
      }
      
      return { error, user: data.user };
    } catch (error: any) {
      console.error('Error signing up:', error);
      ErrorEvents.supabBaseError('signUp', error?.message || 'Unknown error');
      return { error, user: null };
    }
  };

  // Update username
  const updateUsername = async (username: string) => {
    if (!user) {
      return { error: { message: 'No user is logged in' } };
    }
    
    try {
      // Check if username already exists
      const { data: existingUsers, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', user.id)
        .single();
      
      if (lookupError && lookupError.code !== 'PGRST116') {
        // An error occurred (not the "no rows returned" error)
        return { error: lookupError };
      }
      
      if (existingUsers) {
        // Username already exists
        return { error: { message: 'Username already taken' } };
      }
      
      // Update the user metadata with the new username
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { username }
      });
      
      if (metadataError) {
        return { error: metadataError };
      }
      
      // Update the profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', user.id);
      
      return { error: profileError };
    } catch (error) {
      console.error('Error updating username:', error);
      return { error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Track logout before actual sign-out
      UserEvents.logout();
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
      ErrorEvents.supabBaseError('signOut', error?.message || 'Unknown error');
    }
  };

  // Sign in with GitHub
  const signInWithGithub = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      // Track GitHub sign in attempt
      // The actual successful login will be tracked in the onAuthStateChange handler
      UserEvents.login('github');
    } catch (error: any) {
      console.error('Error signing in with GitHub:', error);
      ErrorEvents.supabBaseError('signInWithGithub', error?.message || 'Unknown error');
    }
  };

  // Refresh XP information for the current user
  const refreshXpInfo = async () => {
    if (!user) {
      setXpInfo(null);
      return;
    }
    
    setLoadingXp(true);
    try {
      const { success, xp, level, nextLevelXp, progress, tier, error } = await getUserXpInfo(user.id);
      
      if (success && xp !== undefined) {
        const newXpInfo = {
          xp,
          level: level || 1,
          nextLevelXp: nextLevelXp || 100,
          progress: progress || 0,
          tier: tier || 'Novice'
        };
        
        // Check if user leveled up by comparing with previous level
        if (xpInfo && newXpInfo.level > xpInfo.level) {
          // Track level up event
          UserEvents.levelUp(newXpInfo.level);
        }
        
        setXpInfo(newXpInfo);
      } else if (error) {
        console.error('Error fetching XP info:', error);
        ErrorEvents.supabBaseError('getUserXpInfo', error);
      }
    } catch (error: any) {
      console.error('Error in refreshXpInfo:', error);
      ErrorEvents.supabBaseError('refreshXpInfo', error?.message || 'Unknown error');
    } finally {
      setLoadingXp(false);
    }
  };
  
  // Add a function to manually update XP (useful for animations)
  const updateXp = (newXp: number) => {
    if (!xpInfo) return;
    
    // Create a copy of the current xpInfo with updated XP
    setXpInfo(prevInfo => {
      if (!prevInfo) return null;
      return {
        ...prevInfo,
        xp: newXp
      };
    });
  };

  // Load XP info when user changes
  useEffect(() => {
    refreshXpInfo();
  }, [user]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    xpInfo,
    loadingXp,
    signIn,
    signUp,
    signOut,
    signInWithGithub,
    updateUsername,
    refreshXpInfo,
    updateXp
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 