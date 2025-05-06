import { useCallback } from 'react';
import { RaceMode, RaceParticipant, AnyRecord } from '../../types/raceTypes';

interface UseRacePlayStageProps {
  raceMode: RaceMode;
  raceText: string;
  userProgress: number;
  currentCharIndex: number;
  participants: RaceParticipant[];
  onlineUsers: AnyRecord[];
  currentUser: any;
  getUserIdForDisplay: (userId: string) => string;
  keyerOutput: string;
  showCorrectIndicator: boolean;
  replayCurrent: () => void;
}

interface UseRacePlayStageResult {
  raceLength: number;
  currentUserId: string;
  onlineUserIds: string[];
  handleReplayCurrent: () => void;
}

export function useRacePlayStage({
  raceMode,
  raceText,
  userProgress,
  currentCharIndex,
  participants,
  onlineUsers,
  currentUser,
  getUserIdForDisplay,
  keyerOutput,
  showCorrectIndicator,
  replayCurrent,
}: UseRacePlayStageProps): UseRacePlayStageResult {
  const handleReplayCurrent = useCallback(() => {
    replayCurrent();
  }, [replayCurrent]);

  return {
    raceLength: raceText.length,
    currentUserId: getUserIdForDisplay(currentUser?.id || ''),
    onlineUserIds: onlineUsers.map(user => user.user_id),
    handleReplayCurrent,
  };
} 