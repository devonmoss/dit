/* eslint-disable @typescript-eslint/no-explicit-any */
// Utility type for suppressing eslint errors
export type AnyRecord = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

// Race participant information
export interface RaceParticipant {
  id: string;
  name: string;
  progress: number;
  finished: boolean;
  finishTime?: number;
  errorCount?: number;
  raceTime?: number; // Duration in seconds
}

// Message type for WebSocket participant updates
export interface ParticipantUpdateMessage {
  type: 'progress_update' | 'finish_race';
  user_id: string;
  race_id: string;
  progress: number;
  finished?: boolean;
  finish_time?: number;
}

// Race stages
export enum RaceStage {
  INFO = 'info',
  SHARE = 'share',
  COUNTDOWN = 'countdown',
  RACING = 'racing',
  RESULTS = 'results'
}

// Type for anonymous user
export interface AnonymousUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

// User type definition
export type User = {
  id: string;
  user_metadata?: {
    username?: string;
    full_name?: string;
  };
};

// Race statistics
export interface RaceStats {
  time: number;
  wpm: number;
  errors: number;
}

// Race mode type
export type RaceMode = 'copy' | 'send';

// Invitation details
export interface InvitationDetails {
  raceId: string;
  initiatorName: string;
}

// XP earned structure
export interface XpEarned {
  total: number;
  breakdown: Record<string, number>;
} 