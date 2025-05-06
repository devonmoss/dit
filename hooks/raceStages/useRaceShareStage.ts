import { useCallback } from 'react';
import { RaceMode, RaceParticipant, AnyRecord } from '../../types/raceTypes';

interface UseRaceShareStageProps {
  raceId: string | null;
  raceText: string;
  raceMode: RaceMode;
  raceStatus: string;
  selectedLevelId: string;
  currentUser: any;
  participants: RaceParticipant[];
  onlineUsers: AnyRecord[];
  startRace: () => Promise<void>;
  isRaceCreator: () => boolean;
  getCreatorDisplayName: () => string;
  getUserIdForDisplay: (userId: string) => string;
}

interface UseRaceShareStageResult {
  raceLength: number;
  chars: string[];
  isHost: boolean;
  hostName: string;
  currentUserId: string;
  onlineUserIds: string[];
  handleStartRace: () => Promise<void>;
}

export function useRaceShareStage({
  raceId,
  raceText,
  raceMode,
  raceStatus,
  selectedLevelId,
  currentUser,
  participants,
  onlineUsers,
  startRace,
  isRaceCreator,
  getCreatorDisplayName,
  getUserIdForDisplay,
}: UseRaceShareStageProps): UseRaceShareStageResult {
  const handleStartRace = useCallback(async () => {
    await startRace();
  }, [startRace]);

  return {
    raceLength: raceText.length,
    chars: raceText.split(''),
    isHost: isRaceCreator(),
    hostName: getCreatorDisplayName(),
    currentUserId: getUserIdForDisplay(currentUser?.id || ''),
    onlineUserIds: onlineUsers.map(user => user.user_id),
    handleStartRace,
  };
} 