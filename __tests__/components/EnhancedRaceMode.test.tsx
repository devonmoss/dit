import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnhancedRaceMode from '../../components/RaceMode/EnhancedRaceMode';
import * as raceService from '../../services/raceService';
import { useAnonymousUser } from '../../hooks/useAnonymousUser';
import { useRaceChannel } from '../../hooks/useRaceChannel';
import { useRaceProgress } from '../../hooks/useRaceProgress';
import { useRouter } from 'next/router';

// Mock the necessary hooks and services
jest.mock('../../hooks/useAnonymousUser');
jest.mock('../../hooks/useRaceChannel');
jest.mock('../../hooks/useRaceProgress');
jest.mock('next/router', () => ({
  useRouter: jest.fn()
}));
jest.mock('../../services/raceService');

// Mock local storage
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
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock the hooks
const mockGetCurrentUser = jest.fn();
const mockGetUserDisplayName = jest.fn();
const mockGetMappedUserId = jest.fn();
const mockAnonUserIdMap = {};

(useAnonymousUser as jest.Mock).mockReturnValue({
  getCurrentUser: mockGetCurrentUser,
  getUserDisplayName: mockGetUserDisplayName,
  getMappedUserId: mockGetMappedUserId,
  anonUserIdMap: mockAnonUserIdMap,
  isAnonymousUser: jest.fn().mockReturnValue(true)
});

(useRaceChannel as jest.Mock).mockReturnValue({
  isChannelReady: true,
  onlineUsers: [],
  participants: [],
  invitationDetails: null,
  broadcastProgress: jest.fn(),
  broadcastRedirect: jest.fn(),
  setInitialParticipants: jest.fn(),
  clearInvitation: jest.fn()
});

(useRaceProgress as jest.Mock).mockReturnValue({
  userProgress: 0,
  errorCount: 0,
  currentCharIndex: 0,
  latestProgressRef: { current: 0 },
  pendingUpdateRef: { current: false },
  lastActivityTimeRef: { current: Date.now() },
  updateProgress: jest.fn(),
  incrementProgress: jest.fn(),
  incrementErrorCount: jest.fn(),
  resetProgress: jest.fn(),
  checkInactivity: jest.fn().mockReturnValue(false)
});

(useRouter as jest.Mock).mockReturnValue({
  query: {},
  push: jest.fn()
});

// Mock the AppStateContext
jest.mock('../../contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      selectedLevelId: 'level-1',
      chars: ['a', 'b', 'c'],
      mode: 'copy'
    },
    selectLevel: jest.fn()
  })
}));

// Mock the Auth hooks
jest.mock('../../hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    user: null,
    refreshXpInfo: jest.fn()
  })
}));

describe('EnhancedRaceMode Component - Anonymous User Race Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Set up anonymous user mock
    const anonymousUser = {
      id: 'anon-123',
      email: 'anonymous@example.com',
      user_metadata: { full_name: 'Anonymous-123' }
    };
    mockGetCurrentUser.mockReturnValue(anonymousUser);
    mockGetUserDisplayName.mockReturnValue('Anonymous-123');
    mockGetMappedUserId.mockImplementation((userId, raceId) => {
      if (userId === 'anon-123') {
        return 'mapped-uuid-123';
      }
      return userId;
    });
    
    // Mock race service functions
    (raceService.createRace as jest.Mock).mockResolvedValue({ id: 'race-123' });
    (raceService.joinRace as jest.Mock).mockResolvedValue({
      participants: [{ user_id: 'mapped-uuid-123', name: 'Anonymous-123', progress: 0 }]
    });
    (raceService.updateRaceCreator as jest.Mock).mockResolvedValue({ success: true });
  });
  
  test('Anonymous user can create a race from the info stage', async () => {
    // Render the component
    render(<EnhancedRaceMode />);
    
    // Find and click on the create race button
    const createRaceButton = screen.getByText(/create race/i);
    fireEvent.click(createRaceButton);
    
    // Wait for race creation to complete
    await waitFor(() => {
      // Verify the race service was called with the correct anonymous user ID
      expect(raceService.createRace).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: expect.any(String)
        })
      );
    });
    
    // Verify updateRaceCreator was called with the mapped ID
    expect(raceService.updateRaceCreator).toHaveBeenCalledWith(
      'race-123',
      'mapped-uuid-123'
    );
    
    // Verify joinRace was called with the mapped ID
    expect(raceService.joinRace).toHaveBeenCalledWith(
      'race-123',
      expect.objectContaining({
        user_id: 'mapped-uuid-123',
        name: 'Anonymous-123'
      })
    );
    
    // Verify router navigation occurred
    expect(useRouter().push).toHaveBeenCalledWith(
      expect.stringContaining('race-123')
    );
  });
  
  test('Anonymous user can join an existing race', async () => {
    // Setup router with race ID in query
    (useRouter as jest.Mock).mockReturnValue({
      query: { id: 'existing-race-456' },
      push: jest.fn()
    });
    
    // Mock getRaceDetails for the existing race
    (raceService.getRaceDetails as jest.Mock).mockResolvedValue({
      id: 'existing-race-456',
      created_by: 'other-user-789',
      text: 'abc',
      mode: 'copy',
      status: 'created'
    });
    
    // Render the component
    render(<EnhancedRaceMode />);
    
    // Wait for the join race flow to complete
    await waitFor(() => {
      expect(raceService.joinRace).toHaveBeenCalledWith(
        'existing-race-456',
        expect.objectContaining({
          user_id: 'mapped-uuid-123'
        })
      );
    });
    
    // Verify getMappedUserId was called with the race ID
    expect(mockGetMappedUserId).toHaveBeenCalledWith(
      'anon-123',
      'existing-race-456'
    );
  });
}); 