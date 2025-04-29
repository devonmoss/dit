import { type AnalyticsProps } from '@vercel/analytics/react';

// Re-export Vercel Analytics track function type for convenience
export type TrackEventProps = NonNullable<AnalyticsProps['beforeSend']>;

// Define the window.va global interface
declare global {
  interface Window {
    va?: {
      track: (
        eventName: string, 
        properties?: Record<string, string | number | boolean | null>
      ) => void;
    };
  }
}

// Create custom event categories
export enum EventCategory {
  Training = 'training',
  Race = 'race',
  User = 'user',
  Navigation = 'navigation',
  Error = 'error',
}

// Helper function to track events with structured data
export function trackEvent(
  eventName: string,
  category: EventCategory,
  properties?: Record<string, string | number | boolean | null>
) {
  // Only run on client-side
  if (typeof window === 'undefined') return;

  // Vercel analytics injects this into window
  if (typeof window.va?.track !== 'function') {
    console.warn('Vercel Analytics not available');
    return;
  }

  try {
    // Use the injected va.track function
    window.va.track(eventName, {
      category,
      ...properties,
    });
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

// Helper functions for common events
export const TrainingEvents = {
  levelStarted: (levelId: string, mode: string) => 
    trackEvent('level_started', EventCategory.Training, { levelId, mode }),
  
  levelCompleted: (levelId: string, mode: string, timeInSeconds: number, mistakeCount: number) => 
    trackEvent('level_completed', EventCategory.Training, { 
      levelId, 
      mode, 
      timeInSeconds, 
      mistakeCount 
    }),
  
  levelFailed: (levelId: string, reason?: string) => 
    trackEvent('level_failed', EventCategory.Training, { levelId, reason }),
};

export const RaceEvents = {
  raceCreated: (raceId: string, mode: string) => 
    trackEvent('race_created', EventCategory.Race, { raceId, mode }),
  
  raceJoined: (raceId: string) => 
    trackEvent('race_joined', EventCategory.Race, { raceId }),
  
  raceStarted: (raceId: string, participantCount: number) => 
    trackEvent('race_started', EventCategory.Race, { raceId, participantCount }),
  
  raceCompleted: (raceId: string, position: number, timeInSeconds: number) => 
    trackEvent('race_completed', EventCategory.Race, { 
      raceId, 
      position, 
      timeInSeconds 
    }),
};

export const UserEvents = {
  login: (method: 'email' | 'github') => 
    trackEvent('login', EventCategory.User, { method }),
  
  signup: (method: 'email' | 'github') => 
    trackEvent('signup', EventCategory.User, { method }),
  
  logout: () => 
    trackEvent('logout', EventCategory.User),
  
  profileUpdate: (fields: string[]) => 
    trackEvent('profile_update', EventCategory.User, { fields }),
  
  earnedXP: (amount: number, source: string) => 
    trackEvent('earned_xp', EventCategory.User, { amount, source }),
  
  levelUp: (newLevel: number) => 
    trackEvent('level_up', EventCategory.User, { newLevel }),
};

export const NavigationEvents = {
  pageView: (path: string) => 
    trackEvent('page_view', EventCategory.Navigation, { path }),
  
  tabChange: (from: string, to: string) => 
    trackEvent('tab_change', EventCategory.Navigation, { from, to }),
  
  modeChange: (from: string, to: string) => 
    trackEvent('mode_change', EventCategory.Navigation, { from, to }),
};

export const ErrorEvents = {
  apiError: (endpoint: string, errorMessage: string) => 
    trackEvent('api_error', EventCategory.Error, { endpoint, errorMessage }),
  
  audioError: (action: string, errorMessage: string) => 
    trackEvent('audio_error', EventCategory.Error, { action, errorMessage }),
  
  supabBaseError: (operation: string, errorMessage: string) => 
    trackEvent('supabase_error', EventCategory.Error, { operation, errorMessage }),
};

// Export a complete analytics object for convenience
export const Analytics = {
  track: trackEvent,
  Training: TrainingEvents,
  Race: RaceEvents,
  User: UserEvents,
  Navigation: NavigationEvents,
  Error: ErrorEvents,
};

export default Analytics;