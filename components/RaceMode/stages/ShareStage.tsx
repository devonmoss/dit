import React from 'react';
import RaceShareUI from '../../RaceShareUI/RaceShareUI';
import RaceParticipants from '../../RaceParticipants/RaceParticipants';
import { RaceMode, RaceParticipant } from '../../../types/raceTypes';

interface ShareStageProps {
  raceId: string;
  raceMode: RaceMode;
  raceStatus: string;
  raceLength: number;
  chars: string[];
  levelId: string;
  isHost: boolean;
  hostName: string;
  participants: RaceParticipant[];
  currentUserId: string;
  onlineUserIds: string[];
  onStartRace: () => void;
}

/**
 * Race share stage where users can share the race URL and the host can start the race
 */
const ShareStage: React.FC<ShareStageProps> = ({
  raceId,
  raceMode,
  raceStatus,
  raceLength,
  chars,
  levelId,
  isHost,
  hostName,
  participants,
  currentUserId,
  onlineUserIds,
  onStartRace
}) => {
  return (
    <>
      <RaceShareUI
        raceId={raceId}
        onStartRace={onStartRace}
        raceStatus={raceStatus}
        isHost={isHost}
        hostName={hostName}
        raceMode={raceMode}
        raceLength={raceLength}
        chars={chars}
        levelId={levelId}
      />
      <RaceParticipants
        participants={participants}
        currentUserId={currentUserId}
        raceLength={raceLength}
        onlineUserIds={onlineUserIds}
        showPlacement={true}
      />
    </>
  );
};

export default ShareStage; 