import { useCallback } from 'react';
import { RaceParticipant, AnyRecord } from '../../types/raceTypes';

interface UseRaceCountdownStageProps {
  countdownSeconds: number;
  raceText: string;
  participants: RaceParticipant[];
  onlineUsers: AnyRecord[];
  currentUser: any;
  getUserIdForDisplay: (userId: string) => string;
  startRacing: () => Promise<void>;
}

interface UseRaceCountdownStageResult {
  seconds: number;
  raceLength: number;
  currentUserId: string;
  onlineUserIds: string[];
  handleCountdownComplete: () => Promise<void>;
}

export function useRaceCountdownStage({
  countdownSeconds,
  raceText,
  participants,
  onlineUsers,
  currentUser,
  getUserIdForDisplay,
  startRacing,
}: UseRaceCountdownStageProps): UseRaceCountdownStageResult {
  const handleCountdownComplete = useCallback(async () => {
    await startRacing();
  }, [startRacing]);

  return {
    seconds: countdownSeconds,
    raceLength: raceText.length,
    currentUserId: getUserIdForDisplay(currentUser?.id || ''),
    onlineUserIds: onlineUsers.map(user => user.user_id),
    handleCountdownComplete,
  };
} 