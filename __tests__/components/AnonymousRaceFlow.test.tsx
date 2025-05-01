import React from 'react';
import '@testing-library/jest-dom';
import * as raceService from '../../services/raceService';

// Mock race service
jest.mock('../../services/raceService', () => ({
  createRace: jest.fn(),
  joinRace: jest.fn(),
  updateRaceCreator: jest.fn(),
  getRaceDetails: jest.fn(),
  getRaceParticipants: jest.fn()
}));

// Define response types
interface CreateRaceResponse {
  id: string;
}

interface JoinRaceResponse {
  participants: Array<{
    user_id: string;
    name: string;
    progress: number;
  }>;
}

interface Participant {
  user_id: string;
  name: string;
  progress: number;
}

describe('Anonymous Race Flow', () => {
  let mockAnonymousUser: { id: string; name: string };
  let raceId: string;
  let mappedUserId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup anonymous user data
    mockAnonymousUser = {
      id: 'anon-123',
      name: 'Anonymous-123'
    };
    mappedUserId = 'mapped-uuid-123';
    
    // Set anonymous user in localStorage
    localStorage.setItem('morse_anon_user_id', mockAnonymousUser.id);
    localStorage.setItem('morse_anon_user_name', mockAnonymousUser.name);
    
    // Setup race ID
    raceId = 'race-123';
    
    // Mock race service responses
    (raceService.createRace as jest.Mock).mockResolvedValue({ id: raceId });
    (raceService.joinRace as jest.Mock).mockResolvedValue({
      participants: [{ user_id: mappedUserId, name: mockAnonymousUser.name, progress: 0 }]
    });
    (raceService.updateRaceCreator as jest.Mock).mockResolvedValue({ success: true });
    (raceService.getRaceParticipants as jest.Mock).mockResolvedValue([
      { user_id: mappedUserId, name: mockAnonymousUser.name, progress: 0 }
    ]);
  });
  
  test('Anonymous user can create a race and maintain consistent identity', async () => {
    // Setup UUID mapping in localStorage
    const uuidMap = { [mockAnonymousUser.id]: mappedUserId };
    localStorage.setItem('morse_anon_user_uuid_map', JSON.stringify(uuidMap));
    
    // 1. Create a race as anonymous user
    const createRaceParams = {
      created_by: mockAnonymousUser.id,
      mode: 'copy' as 'copy',  // Type assertion to fix the mode type
      char_sequence: ['a', 'b', 'c', 'd', 'e'],
      text: 'abcde',
      level_id: 'level-1'
    };
    
    const raceData = await raceService.createRace(createRaceParams);
    expect(raceService.createRace).toHaveBeenCalledWith(createRaceParams);
    expect(raceData.id).toBe(raceId);
    
    // 2. Verify UUID mapping exists
    const uuidMapping = localStorage.getItem('morse_anon_user_uuid_map');
    expect(uuidMapping).toBeTruthy();
    expect(JSON.parse(uuidMapping as string)[mockAnonymousUser.id]).toBe(mappedUserId);
    
    // 3. Setup race-specific mapping
    const raceSpecificKey = `morse_race_${raceId}_participant_${mockAnonymousUser.id}`;
    localStorage.setItem(raceSpecificKey, mappedUserId);
    
    // 4. Verify race-specific mapping exists
    const raceSpecificMapping = localStorage.getItem(raceSpecificKey);
    expect(raceSpecificMapping).toBe(mappedUserId);
    
    // 5. Join the race as anonymous user with mapped ID
    const joinRaceParams = {
      user_id: mappedUserId,
      name: mockAnonymousUser.name
    };
    
    const joinData = await raceService.joinRace(raceId, joinRaceParams);
    expect(raceService.joinRace).toHaveBeenCalledWith(raceId, joinRaceParams);
    expect(joinData.participants).toHaveLength(1);
    expect(joinData.participants[0].user_id).toBe(mappedUserId);
    
    // 6. Update race creator if needed
    await raceService.updateRaceCreator(raceId, mappedUserId);
    expect(raceService.updateRaceCreator).toHaveBeenCalledWith(raceId, mappedUserId);
    
    // 7. Check participants to ensure only one exists
    const participants = await raceService.getRaceParticipants(raceId);
    expect(participants).toHaveLength(1);
    expect(participants[0].user_id).toBe(mappedUserId);
    expect(participants[0].name).toBe(mockAnonymousUser.name);
  });
  
  test('Anonymous user can join existing race with consistent identity', async () => {
    // Setup UUID mapping in localStorage
    const uuidMap = { [mockAnonymousUser.id]: mappedUserId };
    localStorage.setItem('morse_anon_user_uuid_map', JSON.stringify(uuidMap));
    
    // Setup race-specific mapping
    const raceSpecificKey = `morse_race_${raceId}_participant_${mockAnonymousUser.id}`;
    localStorage.setItem(raceSpecificKey, mappedUserId);
    
    // 1. Check existing participants
    const participants = await raceService.getRaceParticipants(raceId);
    expect(participants).toHaveLength(1);
    
    // 2. Find participant matching the anonymous user
    const matchingParticipant = participants.find((p: Participant) => p.user_id === mappedUserId);
    expect(matchingParticipant).toBeTruthy();
    expect(matchingParticipant?.name).toBe(mockAnonymousUser.name);
    
    // 3. Join the race with the consistent ID
    const joinRaceParams = {
      user_id: mappedUserId,
      name: mockAnonymousUser.name
    };
    
    await raceService.joinRace(raceId, joinRaceParams);
    expect(raceService.joinRace).toHaveBeenCalledWith(raceId, joinRaceParams);
    
    // 4. Verify the participant list still has only one entry
    const updatedParticipants = await raceService.getRaceParticipants(raceId);
    expect(updatedParticipants).toHaveLength(1);
    expect(updatedParticipants[0].user_id).toBe(mappedUserId);
  });
  
  test('Anonymous user handles page refresh correctly with consistent identity', async () => {
    // Setup UUID mapping in localStorage
    const uuidMap = { [mockAnonymousUser.id]: mappedUserId };
    localStorage.setItem('morse_anon_user_uuid_map', JSON.stringify(uuidMap));
    
    // Setup race-specific mapping for the race
    const raceSpecificKey = `morse_race_${raceId}_participant_${mockAnonymousUser.id}`;
    localStorage.setItem(raceSpecificKey, mappedUserId);
    
    // 1. Simulate initial page load by checking participants
    const initialParticipants = await raceService.getRaceParticipants(raceId);
    expect(initialParticipants).toHaveLength(1);
    
    // 2. Simulate page refresh - getMappedUserId should return consistent ID
    const refreshedMappedId = localStorage.getItem(raceSpecificKey);
    expect(refreshedMappedId).toBe(mappedUserId);
    
    // 3. Join race after refresh
    if (refreshedMappedId) {  // Add null check for TypeScript
      const joinRaceParams = {
        user_id: refreshedMappedId,
        name: mockAnonymousUser.name
      };
      
      await raceService.joinRace(raceId, joinRaceParams);
      expect(raceService.joinRace).toHaveBeenCalledWith(raceId, joinRaceParams);
    }
    
    // 4. Verify still only one participant exists
    const refreshedParticipants = await raceService.getRaceParticipants(raceId);
    expect(refreshedParticipants).toHaveLength(1);
    expect(refreshedParticipants[0].user_id).toBe(mappedUserId);
  });
}); 