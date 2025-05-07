import { track as trackClient } from '@vercel/analytics';
import { track as trackServer } from '@vercel/analytics/server';

/**
 * Track a custom analytics event on the client side
 * @param eventName The name of the event to track
 * @param properties Optional properties to include with the event
 */
export function trackEvent(eventName: string, properties?: Record<string, string | number | boolean | null>) {
  trackClient(eventName, properties);
}

/**
 * Track a custom analytics event on the server side
 * @param eventName The name of the event to track
 * @param properties Optional properties to include with the event
 */
export async function trackServerEvent(eventName: string, properties?: Record<string, string | number | boolean | null>) {
  await trackServer(eventName, properties);
}

/**
 * Track when a level is completed
 * @param levelId The ID of the level that was completed
 * @param mode The mode (copy or send) that the level was completed in
 */
export function trackLevelCompleted(levelId: string, mode: 'copy' | 'send') {
  trackEvent('Level Completed', { levelId, mode });
}

/**
 * Track when a race is started
 * @param participantCount The number of connected participants
 * @param mode The mode (copy or send) of the race
 */
export function trackRaceStarted(participantCount: number, mode: 'copy' | 'send') {
  trackEvent('Race Started', { participantCount, mode });
} 