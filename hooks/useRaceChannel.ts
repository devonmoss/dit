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
  
  // Check for saved invitations when the component loads
  useEffect(() => {
    // Only try to recover if we don't already have an invitation and if we're in the browser
    if (!invitationDetails && typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedInvitation = window.localStorage.getItem('race_invitation');
        if (savedInvitation) {
          const parsedInvitation = JSON.parse(savedInvitation);
          
          // Only use if it's less than 10 minutes old
          const now = Date.now();
          const invitationTime = parsedInvitation.timestamp || 0;
          const ageInMinutes = (now - invitationTime) / (1000 * 60);
          
          if (ageInMinutes < 10) {
            setInvitationDetails({
              new_race_id: parsedInvitation.new_race_id,
              initiator_id: parsedInvitation.initiator_id,
              initiator_name: parsedInvitation.initiator_name
            });
          } else {
            // Clear old invitations
            window.localStorage.removeItem('race_invitation');
          }
        }
      } catch (e) {
        console.error('[Race Channel] Error recovering invitation from localStorage:', e);
      }
    }
  }, [invitationDetails]);
  
  // Set up and clean up the channel subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    // Function to create and set up the channel
    const setupChannel = () => {
      // Only set up a channel if we have a race ID and user ID
      if (!raceId || !userId) {
        setIsChannelReady(false);
        return null;
      }
      
      try {
        // Open a realtime channel with presence enabled and broadcast self enabled
        const newChannel = supabase.channel(`race_${raceId}`, {
          config: { 
            broadcast: { self: true },
            presence: { key: userId }
          }
        });
        
        // Handle progress updates via broadcast
        newChannel.on('broadcast', { event: 'progress_update' }, (payload) => {
          const { user_id, progress, errorCount } = payload;
          
          // Update local participant state without database calls
          setParticipants(prev => 
            prev.map(p => p.id === user_id ? { ...p, progress, errorCount } : p)
          );
        });
        
        // Listen for race redirect events
        newChannel.on('broadcast', { event: 'race_redirect' }, (event) => {
          // Extract payload safely
          const payload = event.payload || event;
          
          // Enhanced validation for the payload
          const { new_race_id, initiator_id, initiator_name } = payload;
          
          if (!new_race_id) {
            console.warn('[Race Channel] Ignoring invalid race redirect: missing new_race_id', payload);
            return;
          }
          
          // Don't redirect the initiator (they're already being redirected)
          if (initiator_id === userId) {
            return;
          }
          
          // Store the redirect information locally in case we need to recover it
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem('race_invitation', JSON.stringify({
                new_race_id,
                initiator_id,
                initiator_name,
                timestamp: Date.now()
              }));
            }
          } catch (storageError) {
            console.error('[Race Channel] Failed to save invitation to localStorage:', storageError);
          }
          
          // Set invitation details for modal and trigger UI update
          try {
            setInvitationDetails({
              new_race_id,
              initiator_id,
              initiator_name
            });
            
            // Also show browser notification if supported
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                // eslint-disable-next-line no-new
                new Notification('Race Invitation', {
                  body: `${initiator_name} has invited you to a new race!`,
                  icon: '/favicon.ico'
                });
              } catch (notificationError) {
                console.error('[Race Channel] Failed to show notification:', notificationError);
              }
            }
          } catch (setStateError) {
            console.error('[Race Channel] Failed to set invitation details:', setStateError);
          }
        });
        
        // Listen for race status changes
        newChannel.on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'races',
          filter: `id=eq.${raceId}`
        }, (payload: { new: any }) => {
          
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
        newChannel.on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'race_participants',
          filter: `race_id=eq.${raceId}`
        }, (payload: { new: any }) => {
          
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
            
            // One final deduplication step to ensure no duplicates
            return Array.from(
              new Map(updatedParticipants.map(p => [p.id, p])).values()
            ) as RaceParticipant[];
          });
        });
        
        // Handle presence events
        newChannel
          .on('presence', { event: 'sync' }, () => {
            if (!newChannel) return;
            const state = newChannel.presenceState();
            
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
        
        // Subscribe to channel with improved error handling
        newChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            
            // Register our presence
            newChannel.track({ 
              user_id: userId, 
              name: userName 
            }).then(() => {
              setIsChannelReady(true);
            }).catch(err => {
              console.error(`[Race Channel] Error tracking presence: ${err.message}`);
              setIsChannelReady(false);
            });
            
          } else if ((status === 'CHANNEL_ERROR' || status === 'SUBSCRIPTION_ERROR') && retryCount < maxRetries) {
            // Try to reconnect with exponential backoff
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            
            console.error(`[Race Channel] Subscription error (attempt ${retryCount}/${maxRetries}) - retrying in ${delay}ms`);
            
            setTimeout(() => {
              if (newChannel) {
                try {
                  // Try to resubscribe
                  newChannel.subscribe();
                } catch (e) {
                  console.error(`[Race Channel] Resubscribe attempt failed:`, e);
                }
              }
            }, delay);
            
          } else if (status === 'CHANNEL_ERROR' || status === 'SUBSCRIPTION_ERROR') {
            console.error(`[Race Channel] All subscription attempts failed (${retryCount}/${maxRetries})`);
            setIsChannelReady(false);
            
          } else if (status === 'CLOSED') {
            setIsChannelReady(false);
            
          } else if (status === 'TIMED_OUT') {
            console.error(`[Race Channel] Channel subscription timed out`);
            setIsChannelReady(false);
            
          } else {
            console.warn(`[Race Channel] Unhandled subscription status: ${status}`);
          }
        });
        
        return newChannel;
      } catch (error) {
        console.error(`[Race Channel] Error setting up channel:`, error);
        setIsChannelReady(false);
        return null;
      }
    };
    
    // Initial channel setup
    channel = setupChannel();
    channelRef.current = channel;
    
    // Clean up function
    return () => {
      if (channel) {
        // Try/catch to prevent any cleanup errors
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.error(`[Race Channel] Error removing channel:`, e);
        }
        setIsChannelReady(false);
        channelRef.current = null;
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
    if (!channelRef.current) {
      console.error('[Race Channel] Cannot broadcast redirect: channel ref is null');
      return false;
    }
    
    if (!isChannelReady) {
      console.error('[Race Channel] Cannot broadcast redirect: channel is not ready');
      
      // If channel exists but isn't ready, try to re-subscribe before sending
      try {
        await channelRef.current.subscribe();
      } catch (e) {
        console.error('[Race Channel] Re-subscribe attempt failed:', e);
        return false;
      }
    }
    
    if (!userId) {
      console.error('[Race Channel] Cannot broadcast redirect: userId is null');
      return false;
    }
    
    try {
      // Check channel state
      if (channelRef.current) {
        const channel = channelRef.current;
        // Get the actual channel state if available via internal properties
        try {
          const channelState = typeof channel.subscribe === 'function' ? 'has subscribe method' : 'no subscribe method';
        } catch (e) {
          console.error('[Race Channel] Unable to access channel state:', e);
        }
      }
      
      // Get current presence state to verify users are online
      const presenceState = channelRef.current.presenceState();
      
      const payload = {
        new_race_id: newRaceId,
        initiator_id: userId,
        initiator_name: initiatorName
      };
      
      // Make multiple attempts to broadcast the message
      let broadcastSuccess = false;
      const maxAttempts = 3;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          
          // Before each attempt, try to ensure the channel is working
          if (attempt > 1) {
            // On retries, make sure we're still subscribed
            try {
              await channelRef.current.track({
                user_id: userId,
                name: initiatorName
              });
            } catch (e) {
              console.warn(`[Race Channel] Re-tracking presence failed:`, e);
            }
          }
          
          // Use a promise to track the broadcast result
          await channelRef.current.send({
            type: 'broadcast',
            event: 'race_redirect',
            payload
          });
          
          broadcastSuccess = true;
          break;
        } catch (err) {
          console.error(`[Race Channel] Broadcast attempt ${attempt} failed:`, err);
          
          if (attempt < maxAttempts) {
            // Wait before retrying (increasing delay with each attempt)
            const delay = attempt * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (broadcastSuccess) {
        return true;
      } else {
        console.error('[Race Channel] All broadcast attempts failed');
        return false;
      }
    } catch (err) {
      console.error('[Race Channel] Error during broadcast operation:', err);
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
    
    // Also clear from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('race_invitation');
    }
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