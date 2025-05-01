import { useRef, useEffect, useCallback, useState } from 'react';
import supabase from '../utils/supabase';
import { User, RaceParticipant } from '../types/raceTypes';

interface ProgressUpdate {
  user_id: string;
  progress: number;
  errorCount: number;
}

interface RaceRedirectInfo {
  new_race_id: string;
  initiator_id: string;
  initiator_name: string;
}

interface PresenceUser {
  user_id: string;
  name: string;
}

/**
 * Custom hook for managing Supabase realtime channel for race updates and presence
 * 
 * @param raceId - The ID of the current race
 * @param userId - The ID of the current user
 * @param userName - The display name of the current user
 */
export const useRaceChannel = (
  raceId: string | null, 
  userId: string | null,
  userName: string
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  const [isChannelReady, setIsChannelReady] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<RaceRedirectInfo | null>(null);
  
  // Set up and clean up the channel subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    // Only set up a channel if we have a race ID and user ID
    if (!raceId || !userId) {
      setIsChannelReady(false);
      return;
    }
    
    console.log('Setting up realtime channel for race:', raceId, 'user:', userId);
    
    // Open a realtime channel with presence enabled
    channel = supabase.channel(`race_${raceId}`, {
      config: { 
        broadcast: { self: true },
        presence: { key: userId }
      }
    });
    
    // Set up event handlers
    
    // Handle progress updates via broadcast
    channel.on('broadcast', { event: 'progress_update' }, (payload) => {
      const { user_id, progress, errorCount } = payload;
      
      // Update local participant state without database calls
      setParticipants(prev => 
        prev.map(p => p.id === user_id ? { ...p, progress, errorCount } : p)
      );
    });
    
    // Listen for race redirect events
    channel.on('broadcast', { event: 'race_redirect' }, (event) => {
      console.log('Received race_redirect broadcast:', event);
      
      // Make sure we're accessing the payload correctly
      const payload = event.payload || event;
      const { new_race_id, initiator_id, initiator_name } = payload;
      
      if (!new_race_id) {
        console.warn('Ignoring invalid race redirect: missing new_race_id', payload);
        return;
      }
      
      // Don't redirect the initiator (they're already being redirected)
      if (initiator_id === userId) {
        console.log('Not redirecting - user is the initiator');
        return;
      }
      
      console.log(`Received redirect to new race: ${new_race_id} from ${initiator_name}`);
      
      // Set invitation details for modal
      setInvitationDetails({
        new_race_id,
        initiator_id,
        initiator_name
      });
    });
    
    // Listen for race status changes
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'races',
      filter: `id=eq.${raceId}`
    }, (payload: { new: any }) => {
      console.log('Race update received:', payload);
      
      // We don't directly update the race status here
      // Instead, emit a race status changed event that the component can listen to
      const race = payload.new;
      if (race && race.status) {
        const event = new CustomEvent('race-status-changed', { 
          detail: { status: race.status, startTime: race.start_time } 
        });
        window.dispatchEvent(event);
      }
    });
    
    // Listen for participant changes via database
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'race_participants',
      filter: `race_id=eq.${raceId}`
    }, (payload: { new: any }) => {
      console.log('Participant database change:', payload);
      
      const changedParticipant = payload.new;
      if (!changedParticipant) return;
      
      // Update participants state directly from the payload data
      setParticipants(prev => {
        // Check if this participant exists in our state
        const participantExists = prev.some(p => p.id === changedParticipant.user_id);
        
        let updatedParticipants;
        
        if (participantExists) {
          // Update existing participant
          updatedParticipants = prev.map(p => {
            if (p.id === changedParticipant.user_id) {
              return {
                ...p,
                progress: changedParticipant.progress || 0,
                finished: changedParticipant.finished || false,
                finishTime: changedParticipant.finish_time,
                errorCount: changedParticipant.error_count || 0,
                raceTime: changedParticipant.race_time
              };
            }
            return p;
          });
        } else {
          // This is a new participant, add them to the array
          updatedParticipants = [
            ...prev,
            {
              id: changedParticipant.user_id,
              name: changedParticipant.name || 'Anonymous',
              progress: changedParticipant.progress || 0,
              finished: changedParticipant.finished || false,
              finishTime: changedParticipant.finish_time,
              errorCount: changedParticipant.error_count || 0,
              raceTime: changedParticipant.race_time
            }
          ];
        }
        
        return updatedParticipants;
      });
    });
    
    // Handle presence events
    channel
      .on('presence', { event: 'sync' }, () => {
        if (!channel) return;
        const state = channel.presenceState();
        
        // state values are arrays of metadata objects
        type PresenceState = Record<string, any[]>;
        const typedState = state as PresenceState;
        
        const users: PresenceUser[] = [];
        
        // Loop through the state keys and values to extract users
        Object.keys(typedState).forEach(key => {
          const presences = typedState[key];
          if (Array.isArray(presences) && presences.length > 0) {
            users.push(presences[0] as PresenceUser);
          }
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: Array<PresenceUser> }) => {
        // newPresences is an array of metadata objects
        setOnlineUsers((prev: PresenceUser[]) => [...prev, ...newPresences]);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<PresenceUser> }) => {
        // leftPresences is an array of metadata objects
        setOnlineUsers((prev: PresenceUser[]) => 
          prev.filter(u => !leftPresences.some((l: PresenceUser) => l.user_id === u.user_id))
        );
      });
    
    // Subscribe to channel and then announce ourselves
    channel.subscribe((status: string) => {
      console.log('Channel subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Channel subscribed, tracking presence for user:', userId);
        channel?.track({ 
          user_id: userId, 
          name: userName 
        });
        setIsChannelReady(true);
      } else if (status === 'SUBSCRIPTION_ERROR') {
        console.error('Channel subscription error - check Supabase credentials and connection');
        setIsChannelReady(false);
      } else if (status === 'CLOSED') {
        console.log('Channel closed');
        setIsChannelReady(false);
      } else if (status === 'TIMED_OUT') {
        console.error('Channel subscription timed out');
        setIsChannelReady(false);
      }
    });
    
    // Store channel in ref for later use
    channelRef.current = channel;
    
    // Clean up function
    return () => {
      if (channel) {
        console.log('Removing channel for race:', raceId);
        supabase.removeChannel(channel);
        setIsChannelReady(false);
      }
    };
  }, [raceId, userId, userName]);
  
  // Broadcast a progress update
  const broadcastProgress = useCallback((progress: number, errorCount: number) => {
    if (!channelRef.current || !isChannelReady || !userId) return;
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'progress_update',
      payload: {
        user_id: userId,
        progress,
        errorCount
      }
    });
  }, [isChannelReady, userId]);
  
  // Broadcast a race redirect
  const broadcastRedirect = useCallback(async (newRaceId: string, initiatorName: string) => {
    if (!channelRef.current || !isChannelReady || !userId) {
      console.warn('Cannot broadcast redirect: channel not ready', { 
        isChannelReady, 
        hasChannel: !!channelRef.current,
        userId
      });
      return false;
    }
    
    try {
      console.log('Broadcasting redirect to new race:', newRaceId);
      
      // Get current presence state to verify users are online
      const presenceState = await channelRef.current.presenceState();
      console.log('Current online users:', presenceState);
      
      // Use a promise to track the broadcast result
      await channelRef.current.send({
        type: 'broadcast',
        event: 'race_redirect',
        payload: {
          new_race_id: newRaceId,
          initiator_id: userId,
          initiator_name: initiatorName
        }
      }).then(() => {
        console.log('Broadcast sent successfully with new_race_id:', newRaceId);
      }).catch(err => {
        console.error('Error sending broadcast:', err);
        return false;
      });
      
      return true;
    } catch (err) {
      console.error('Error during broadcast operation:', err);
      return false;
    }
  }, [isChannelReady, userId]);
  
  // Initialize participants from backend data
  const setInitialParticipants = useCallback((initialParticipants: RaceParticipant[]) => {
    setParticipants(initialParticipants);
  }, []);
  
  // Clear any pending invitation
  const clearInvitation = useCallback(() => {
    setInvitationDetails(null);
  }, []);
  
  // Return the necessary data and functions
  return {
    isChannelReady,
    onlineUsers,
    participants,
    invitationDetails,
    broadcastProgress,
    broadcastRedirect,
    setInitialParticipants,
    clearInvitation
  };
}; 