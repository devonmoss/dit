import React from 'react';
import CountdownTimer from '../../CountdownTimer/CountdownTimer';
import RaceParticipants from '../../RaceParticipants/RaceParticipants';
import { RaceParticipant } from '../../../types/raceTypes';

interface CountdownStageProps {
  seconds: number;
  participants: RaceParticipant[];
  currentUserId: string;
  raceLength: number;
  onlineUserIds: string[];
  onComplete: () => void;
}

/**
 * Race countdown stage where users wait for the race to start
 */
const CountdownStage: React.FC<CountdownStageProps> = ({
  seconds,
  participants,
  currentUserId,
  raceLength,
  onlineUserIds,
  onComplete
}) => {
  return (
    <>
      <CountdownTimer
        seconds={seconds}
        onComplete={onComplete}
      />
      <RaceParticipants
        participants={participants}
        currentUserId={currentUserId}
        raceLength={raceLength}
        onlineUserIds={onlineUserIds}
      />
    </>
  );
};

export default CountdownStage; 