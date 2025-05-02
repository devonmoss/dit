import { useCallback } from 'react';
import { RaceParticipant, RaceStats, AnyRecord } from '../../types/raceTypes';

interface UseRaceResultsStageProps {
  stats: RaceStats | null;
  errorCount: number;
  raceText: string;
  participants: RaceParticipant[];
  onlineUsers: AnyRecord[];
  currentUser: any;
  getUserIdForDisplay: (userId: string) => string;
  isCreatingRace: boolean;
  navigateHome: () => void;
  handleRaceAgain: () => Promise<void>;
}

interface UseRaceResultsStageResult {
  raceLength: number;
  currentUserId: string;
  onlineUserIds: string[];
  handleNavigateHome: () => void;
  handleRaceAgain: () => Promise<void>;
}

export function useRaceResultsStage({
  stats,
  errorCount,
  raceText,
  participants,
  onlineUsers,
  currentUser,
  getUserIdForDisplay,
  isCreatingRace,
  navigateHome,
  handleRaceAgain,
}: UseRaceResultsStageProps): UseRaceResultsStageResult {
  const handleNavigateHome = useCallback(() => {
    navigateHome();
  }, [navigateHome]);

  return {
    raceLength: raceText.length,
    currentUserId: getUserIdForDisplay(currentUser?.id || ''),
    onlineUserIds: onlineUsers.map(user => user.user_id),
    handleNavigateHome,
    handleRaceAgain,
  };
} 