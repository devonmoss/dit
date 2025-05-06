// Race-related API functions

// Create a new race
export async function createRace(raceData: {
  created_by: string;
  mode: 'copy' | 'send';
  char_sequence: string[];
  text: string;
  level_id?: string;
}) {
  const response = await fetch('/api/races', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(raceData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create race');
  }
  
  return response.json();
}

// Join an existing race
export async function joinRace(raceId: string, userData: {
  user_id: string;
  name: string;
}) {
  const response = await fetch(`/api/races/${raceId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to join race');
  }
  
  return response.json();
}

// Get race details
export async function getRaceDetails(raceId: string) {
  const response = await fetch(`/api/races/${raceId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get race details');
  }
  
  return response.json();
}

// Get race participants
export async function getRaceParticipants(raceId: string) {
  const response = await fetch(`/api/races/${raceId}/participants`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get race participants');
  }
  
  return response.json();
}

// Update participant progress
export async function updateProgress(raceId: string, userId: string, progress: number, errorCount: number) {
  const response = await fetch(`/api/races/${raceId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: userId, 
      progress, 
      error_count: errorCount 
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update progress');
  }
  
  return response.json();
}

// Update race status
export async function updateRaceStatus(raceId: string, status: string) {
  const response = await fetch(`/api/races/${raceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update race status');
  }
  
  return response.json();
}

// Start race countdown
export async function startRaceCountdown(raceId: string) {
  const response = await fetch(`/api/races/${raceId}/start`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start race countdown');
  }
  
  return response.json();
}

// Begin racing after countdown
export async function beginRacing(raceId: string) {
  const response = await fetch(`/api/races/${raceId}/begin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_time: Date.now() })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to begin racing');
  }
  
  return response.json();
}

// Finish race for participant
export async function finishRace(raceId: string, userId: string, data: {
  finish_time: number;
  error_count: number;
  race_time: number;
}) {
  const response = await fetch(`/api/races/${raceId}/finish`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: userId,
      ...data
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to finish race');
  }
  
  return response.json();
}

// Update race creator
export async function updateRaceCreator(raceId: string, creatorId: string) {
  const response = await fetch(`/api/races/${raceId}/creator`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creator_id: creatorId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update race creator');
  }
  
  return response.json();
}