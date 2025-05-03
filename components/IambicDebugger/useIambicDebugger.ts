import { useEffect, useState } from 'react';
import { IambicKeyer } from '../../hooks/useIambicKeyer';

// Hook to connect to the iambic keyer's debug information
export function useIambicDebugger(keyer: IambicKeyer) {
  const [dotHeld, setDotHeld] = useState(false);
  const [dashHeld, setDashHeld] = useState(false);
  const [buffer, setBuffer] = useState('');
  const [lastSymbol, setLastSymbol] = useState<string | null>(null);
  const [wpm, setWpm] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [events, setEvents] = useState<Array<{type: string, value?: string, timestamp: number}>>([]);
  
  useEffect(() => {
    if (!keyer.debug) {
      console.warn('Iambic keyer debugger is only available in development mode');
      return;
    }
    
    // Set up interval to update state from keyer
    const updateInterval = setInterval(() => {
      if (keyer.debug) {
        setDotHeld(keyer.debug.dotHeld);
        setDashHeld(keyer.debug.dashHeld);
        setBuffer(keyer.debug.buffer);
        setLastSymbol(keyer.debug.lastSymbol);
        setWpm(keyer.debug.wpm);
        setIsActive(keyer.debug.isActive);
      }
    }, 50); // Update at 20fps
    
    // Add event listener for iambic keyer events
    const handleEvent = (event: {type: string, value?: string}) => {
      setEvents(prev => {
        const newEvent = {
          ...event,
          timestamp: Date.now()
        };
        const newEvents = [...prev, newEvent];
        // Only keep most recent 100 events
        if (newEvents.length > 100) {
          return newEvents.slice(newEvents.length - 100);
        }
        return newEvents;
      });
    };
    
    if (keyer.debug) {
      // Register our event handler
      const originalAddEvent = keyer.debug.addEvent;
      keyer.debug.addEvent = (event) => {
        handleEvent(event);
        originalAddEvent(event);
      };
    }
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [keyer]);
  
  return {
    dotHeld,
    dashHeld,
    buffer,
    lastSymbol,
    wpm,
    isActive,
    events,
    addEvent: (type: string, value?: string) => {
      const event = { type, value, timestamp: Date.now() };
      setEvents(prev => [...prev, event]);
    }
  };
}