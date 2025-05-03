import React, { useEffect, useState, useRef } from 'react';
import styles from './IambicDebugger.module.css';

interface IambicDebugEvent {
  type: 'key_down' | 'key_up' | 'dot' | 'dash' | 'char' | 'word' | 'squeeze' | 'cycle';
  value?: string;
  timestamp: number;
}

interface IambicDebuggerProps {
  // Exposed state from useIambicKeyer
  dotHeld: boolean;
  dashHeld: boolean;
  buffer: string;
  lastSymbol: string | null;
  wpm: number;
  isActive: boolean;
  // Optional callback to add events
  onEvent?: (event: IambicDebugEvent) => void;
}

export const IambicDebugger: React.FC<IambicDebuggerProps> = ({ 
  dotHeld, 
  dashHeld, 
  buffer, 
  lastSymbol, 
  wpm, 
  isActive,
  onEvent 
}) => {
  const [events, setEvents] = useState<IambicDebugEvent[]>([]);
  const eventsRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll events to bottom
  useEffect(() => {
    if (eventsRef.current) {
      eventsRef.current.scrollTop = eventsRef.current.scrollHeight;
    }
  }, [events]);

  // Add a new event to the log
  const addEvent = (event: IambicDebugEvent) => {
    setEvents(prev => {
      // Keep last 100 events only
      const newEvents = [...prev, event];
      if (newEvents.length > 100) {
        return newEvents.slice(newEvents.length - 100);
      }
      return newEvents;
    });
    
    // Pass the event to parent component if callback exists
    if (onEvent) {
      onEvent(event);
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  };

  // Get event class name based on type
  const getEventClass = (type: string) => {
    switch (type) {
      case 'dot': return styles.dotEvent;
      case 'dash': return styles.dashEvent;
      case 'char': return styles.charEvent;
      case 'key_down':
      case 'key_up': return styles.keyEvent;
      default: return styles.otherEvent;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>Iambic Keyer Debugger {isActive ? '(Active)' : '(Inactive)'}</div>
      
      <div className={styles.states}>
        <div className={styles.paddle}>
          <div className={`${styles.indicator} ${dotHeld ? styles.active : ''}`}></div>
          <span>DOT (←)</span>
        </div>
        
        <div className={styles.paddle}>
          <div className={`${styles.indicator} ${dashHeld ? styles.active : ''}`}></div>
          <span>DASH (→)</span>
        </div>
        
        <div>WPM: {wpm}</div>
      </div>
      
      <div className={styles.buffer}>
        <div>Buffer: {buffer || '(empty)'}</div>
        <div>Last Symbol: {lastSymbol || 'none'}</div>
      </div>
      
      <div className={styles.events} ref={eventsRef}>
        {events.map((event, index) => (
          <div key={index} className={`${styles.event} ${getEventClass(event.type)}`}>
            [{formatTime(event.timestamp)}] {event.type.toUpperCase()}
            {event.value ? `: ${event.value}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IambicDebugger;