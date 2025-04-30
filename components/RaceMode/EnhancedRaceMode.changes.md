# Changes Required for EnhancedRaceMode.tsx

This document outlines the changes needed to convert direct database calls to API calls in EnhancedRaceMode.tsx:

## 1. Import Service Functions

Replace:
```typescript
import supabase from '../../utils/supabase';
import { awardXp, calculateRaceXp, XpSource } from '../../utils/xpSystem';
```

With:
```typescript
import supabase from '../../utils/supabase'; // Still needed for realtime channels
import { calculateRaceXp, XpSource } from '../../utils/xpSystem';
import * as raceService from '../../services/raceService';
import * as xpService from '../../services/xpService';
```

## 2. Update `updateProgressInDatabase` (Lines 167-204)

Replace:
```typescript
// Update the database with both progress and error count
supabase
  .from('race_participants')
  .update({ 
    progress,
    error_count: errorCount 
  })
  .eq('race_id', raceId)
  .eq('user_id', dbUserId)
  .then(({ error }) => {
    if (error) {
      console.error('Error updating progress:', error);
    }
  });
```

With:
```typescript
// Call API endpoint to update progress
raceService.updateProgress(raceId, dbUserId, progress, errorCount)
  .catch(error => {
    console.error('Error updating progress:', error);
  });
```

## 3. Update `joinRace` (Lines 255-351)

Replace:
```typescript
// Get race data
const { data: race, error } = await supabase
  .from('races')
  .select('*')
  .eq('id', raceId)
  .single();
  
if (error) throw error;

// ... participant checks and joining code ...
```

With:
```typescript
// Get race data from API
const race = await raceService.getRaceDetails(raceId);

// Join the race through API
const joinResult = await raceService.joinRace(raceId, {
  user_id: participantUserId,
  name: getUserDisplayName(currentUser)
});

// Set race text and mode
setRaceText(race.text || '');
setRaceMode(race.mode || 'copy');

// Set participants from the join result
setParticipants((joinResult.participants || []).map(p => ({
  id: p.user_id,
  name: p.name || 'Anonymous',
  progress: p.progress || 0,
  finished: p.finished || false,
  finishTime: p.finish_time,
  errorCount: p.error_count || 0,
  raceTime: p.race_time
})));
```

## 4. Update Race Status Completion (Lines 480-488)

Replace:
```typescript
// Update race status without waiting for response
supabase
  .from('races')
  .update({ status: 'finished' })
  .eq('id', raceId)
  .then(({ error }) => {
    if (error) {
      console.error('Error updating race status to finished:', error);
    }
  });
```

With:
```typescript
// Update race status using API
raceService.updateRaceStatus(raceId, 'finished')
  .catch(error => {
    console.error('Error updating race status to finished:', error);
  });
```

## 5. Update `createRace` (Lines 562-652)

Replace:
```typescript
// Create race in database
const { data: race, error } = await supabase
  .from('races')
  .insert([{
    id: newRaceId,
    created_by: createdById,
    mode: mode,
    status: 'waiting',
    char_sequence: text.split(''),
    text: text,
    level_id: state.selectedLevelId
  }])
  .select()
  .single();
  
if (error) throw error;

// Add creator as first participant
await supabase
  .from('race_participants')
  .insert([{
    race_id: race.id,
    user_id: participantUserId,
    name: getUserDisplayName(currentUser),
    progress: 0,
    finished: false
  }])
  .select();
```

With:
```typescript
// Create race through API
const race = await raceService.createRace({
  created_by: createdById,
  mode: mode,
  char_sequence: text.split(''),
  text: text,
  level_id: state.selectedLevelId
});

// Join race automatically through API
await raceService.joinRace(race.id, {
  user_id: participantUserId,
  name: getUserDisplayName(currentUser)
});
```

## 6. Update `startRace` (Lines 654-673)

Replace:
```typescript
// Update race status to countdown
await supabase
  .from('races')
  .update({
    status: 'countdown'
  })
  .eq('id', raceId);
```

With:
```typescript
// Update race status to countdown through API
await raceService.startRaceCountdown(raceId);
```

## 7. Update `startRacing` (Lines 675-705)

Replace:
```typescript
// Update race status to racing with start time
await supabase
  .from('races')
  .update({
    status: 'racing',
    start_time: startTime
  })
  .eq('id', raceId);
```

With:
```typescript
// Begin racing through API
await raceService.beginRacing(raceId);
```

## 8. Update `finishRace` (Lines 707-818)

Replace:
```typescript
// For race completion, we want an immediate database update - this is important state
await supabase
  .from('race_participants')
  .update({
    finished: true,
    finish_time: endTime,
    progress: raceText.length,
    error_count: errorCount,
    race_time: raceDuration
  })
  .eq('race_id', raceId)
  .eq('user_id', dbUserId);

// ... position calculation and XP award code ...
const result = await awardXp(
  user.id,
  xpResult.total,
  XpSource.RACE,
  {
    race_id: raceId,
    position: userPosition,
    total_participants: raceParticipants.length,
    mode: raceMode,
    chars_completed: raceText.length,
    mistakes: errorCount,
    race_time: raceDuration,
    xp_breakdown: xpResult.breakdown
  }
);
```

With:
```typescript
// Finish race through API
await raceService.finishRace(raceId, dbUserId, {
  finish_time: endTime,
  error_count: errorCount,
  race_time: raceDuration
});

// ... XP award code ...
const result = await xpService.awardXp(
  user.id,
  xpResult.total,
  XpSource.RACE,
  {
    race_id: raceId,
    position: userPosition,
    total_participants: raceParticipants.length,
    mode: raceMode,
    chars_completed: raceText.length, 
    mistakes: errorCount,
    race_time: raceDuration,
    xp_breakdown: xpResult.breakdown
  }
);
```

## 9. Update Race Start Progress Reset (Lines 1385-1401)

Replace:
```typescript
// Make sure our progress is set to 0 in the database when race starts
supabase
  .from('race_participants')
  .update({ 
    progress: 0,
    finished: false,
    finish_time: null
  })
  .eq('race_id', raceId)
  .eq('user_id', currentUser.id)
  .then(({ error }) => {
    if (error) {
      console.error('Error initializing progress in database:', error);
    } else {
      console.log('Initial state set in database - progress reset to 0');
    }
  });
```

With:
```typescript
// Reset progress through API
raceService.updateProgress(raceId, currentUser.id, 0, 0)
  .then(() => {
    console.log('Initial state set in database - progress reset to 0');
  })
  .catch(error => {
    console.error('Error initializing progress in database:', error);
  });
```

## 10. Update Page Unload Handler (Lines 1432-1441)

Replace:
```typescript
// For best-effort final save, use sendBeacon
if (navigator.sendBeacon) {
  const formData = new FormData();
  formData.append('progress', latestProgressRef.current.toString());
  navigator.sendBeacon(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/race_participants?race_id=eq.${raceId}&user_id=eq.${dbUserId}`,
    formData
  );
  console.log('Final progress sent via beacon before page unload');
}
```

With:
```typescript
// For best-effort final save, use sendBeacon to our API
if (navigator.sendBeacon) {
  const formData = new FormData();
  formData.append('user_id', dbUserId);
  formData.append('progress', latestProgressRef.current.toString());
  formData.append('error_count', errorCount.toString());
  navigator.sendBeacon(
    `/api/races/${raceId}/progress`,
    formData
  );
  console.log('Final progress sent via beacon before page unload');
}
```

## 11. Add New API Endpoint for Beacon Support

Create a new API endpoint at `/pages/api/races/[id]/progress-beacon.ts` to handle the FormData from sendBeacon:

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid race ID' });
  }
  
  // POST - Update participant progress from beacon
  if (req.method === 'POST') {
    try {
      const { user_id, progress, error_count } = req.body;
      
      if (!user_id || progress === undefined) {
        return res.status(400).json({ error: 'User ID and progress are required' });
      }
      
      const updateData: any = { progress: parseInt(progress, 10) };
      if (error_count !== undefined) {
        updateData.error_count = parseInt(error_count, 10);
      }
      
      await supabaseAdmin
        .from('race_participants')
        .update(updateData)
        .eq('race_id', id)
        .eq('user_id', user_id);
        
      return res.status(200).end();
    } catch (error: any) {
      console.error('Error updating progress:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
```

## Note on Realtime Channels

The Supabase client is still needed for the realtime channels functionality. The component should continue using:
```typescript
channel = supabase.channel(`race_${raceId}`, {
  config: { presence: { key: presenceUserId } }
});
```

However, all data manipulation operations should now be done through the API services instead of direct database calls.