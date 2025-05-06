import { renderHook, act } from '@testing-library/react-hooks';
import { useAnonymousUser } from '../../hooks/useAnonymousUser';
import * as raceService from '../../services/raceService';

// Mock the race service
jest.mock('../../services/raceService');

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    getAllKeys: () => Object.keys(store)
  };
})();

// Mock the isBrowser utility
jest.mock('../../utils/morse', () => ({
  isBrowser: true
}));

// Setup global localStorage mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useAnonymousUser', () => {
  beforeEach(() => {
    // Clear localStorage and reset mocks before each test
    localStorageMock.clear();
    jest.clearAllMocks();
    
    // Mock the necessary race service functions
    (raceService.createRace as jest.Mock).mockResolvedValue({ id: 'race-123' });
    (raceService.joinRace as jest.Mock).mockResolvedValue({ 
      participants: [{ user_id: 'uuid-123', name: 'Anonymous-123', progress: 0 }] 
    });
    (raceService.updateRaceCreator as jest.Mock).mockResolvedValue({ success: true });
  });
  
  it('should create an anonymous user with a unique ID', () => {
    const { result } = renderHook(() => useAnonymousUser(null));
    
    // Get the current user
    act(() => {
      const user = result.current.getCurrentUser();
      expect(user).not.toBeNull();
      expect(user.id).toContain('anon-');
    });
  });
  
  it('should assign a consistent UUID mapping for an anonymous user', () => {
    const { result } = renderHook(() => useAnonymousUser(null));
    
    // Get the current user
    let anonymousId = '';
    act(() => {
      const user = result.current.getCurrentUser();
      anonymousId = user?.id || '';
      expect(anonymousId).toContain('anon-');
    });
    
    // Map the user ID
    let mappedId = '';
    act(() => {
      mappedId = result.current.getMappedUserId(anonymousId);
      expect(mappedId).not.toEqual(anonymousId);
      expect(mappedId).not.toContain('anon-');
    });
    
    // Verify it's stored in localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'morse_anon_user_uuid_map',
      expect.any(String)
    );
    
    // Verify mapping is consistent on subsequent calls
    act(() => {
      const secondMapping = result.current.getMappedUserId(anonymousId);
      expect(secondMapping).toEqual(mappedId);
    });
  });
  
  it('should use consistent IDs for specific races', () => {
    const { result } = renderHook(() => useAnonymousUser(null));
    
    // Get the current user
    let anonymousId = '';
    act(() => {
      const user = result.current.getCurrentUser();
      anonymousId = user?.id || '';
    });
    
    // Map the user ID for a specific race
    let raceSpecificId = '';
    act(() => {
      raceSpecificId = result.current.getMappedUserId(anonymousId, 'race-123');
    });
    
    // Verify race-specific mapping is stored
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `morse_race_race-123_participant_${anonymousId}`,
      expect.any(String)
    );
    
    // Mock stored race-specific ID
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === `morse_race_race-123_participant_${anonymousId}`) {
        return raceSpecificId;
      }
      return null;
    });
    
    // Verify same ID is returned on second call
    act(() => {
      const secondMapping = result.current.getMappedUserId(anonymousId, 'race-123');
      expect(secondMapping).toEqual(raceSpecificId);
    });
  });
  
  it('should allow anonymous users to create a race', async () => {
    const { result } = renderHook(() => useAnonymousUser(null));
    
    // Create a mock implementation for race services
    let capturedCreatorId = '';
    (raceService.createRace as jest.Mock).mockImplementation((data) => {
      capturedCreatorId = data.created_by;
      return Promise.resolve({ id: 'race-123' });
    });
    
    // Get the anonymous user
    let anonymousUser: any;
    act(() => {
      anonymousUser = result.current.getCurrentUser();
    });
    expect(anonymousUser).not.toBeNull();
    expect(anonymousUser.id).toContain('anon-');
    
    // Simulate creating a race with the anonymous user
    await act(async () => {
      await raceService.createRace({
        created_by: anonymousUser.id,
        mode: 'copy',
        char_sequence: ['a', 'b', 'c'],
        text: 'abc',
        level_id: 'level-1'
      });
    });
    
    expect(capturedCreatorId).toEqual(anonymousUser.id);
    expect(raceService.createRace).toHaveBeenCalledWith({
      created_by: anonymousUser.id,
      mode: 'copy',
      char_sequence: ['a', 'b', 'c'],
      text: 'abc',
      level_id: 'level-1'
    });
    
    // Verify we can join the race with the mapped ID
    let mappedId = '';
    act(() => {
      mappedId = result.current.getMappedUserId(anonymousUser.id, 'race-123');
    });
    
    await act(async () => {
      await raceService.joinRace('race-123', {
        user_id: mappedId,
        name: result.current.getUserDisplayName(anonymousUser)
      });
    });
    
    expect(raceService.joinRace).toHaveBeenCalledWith('race-123', {
      user_id: mappedId,
      name: expect.stringContaining('Anonymous-')
    });
  });
  
  it('should handle race creation flow with proper ID mapping', async () => {
    const { result } = renderHook(() => useAnonymousUser(null));
    
    // Simulate the race creation flow as done in EnhancedRaceMode
    
    // 1. Get the anonymous user
    let anonymousUser: any;
    act(() => {
      anonymousUser = result.current.getCurrentUser();
    });
    
    // 2. Create the race (initially with direct anonymous ID)
    let createdRaceId = '';
    await act(async () => {
      const raceResponse = await raceService.createRace({
        created_by: anonymousUser.id,
        mode: 'copy',
        char_sequence: ['a', 'b', 'c'],
        text: 'abc',
        level_id: 'level-1'
      });
      createdRaceId = raceResponse.id;
    });
    
    // 3. Get the mapped ID for this race
    let mappedId = '';
    act(() => {
      mappedId = result.current.getMappedUserId(anonymousUser.id, createdRaceId);
    });
    
    // 4. Update the race creator if needed
    if (mappedId !== anonymousUser.id) {
      await act(async () => {
        await raceService.updateRaceCreator(createdRaceId, mappedId);
      });
    }
    
    // 5. Join the race with the mapped ID
    await act(async () => {
      await raceService.joinRace(createdRaceId, {
        user_id: mappedId,
        name: result.current.getUserDisplayName(anonymousUser)
      });
    });
    
    // Verify all operations were called with correct parameters
    expect(raceService.createRace).toHaveBeenCalledWith({
      created_by: anonymousUser.id,
      mode: 'copy',
      char_sequence: ['a', 'b', 'c'],
      text: 'abc',
      level_id: 'level-1'
    });
    
    expect(raceService.updateRaceCreator).toHaveBeenCalledWith(createdRaceId, mappedId);
    
    expect(raceService.joinRace).toHaveBeenCalledWith(createdRaceId, {
      user_id: mappedId,
      name: expect.stringContaining('Anonymous-')
    });
  });
}); 