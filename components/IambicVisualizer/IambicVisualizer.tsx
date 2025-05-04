import React, { useEffect, useRef, useState } from 'react';
import styles from './IambicVisualizer.module.css';

interface IambicEvent {
  type: string;
  value?: string;
  timestamp: number;
}

interface IambicVisualizerProps {
  dotPressed: boolean;
  dashPressed: boolean;
  playingDot: boolean;
  playingDash: boolean;
  squeeze: boolean;
  queuedElements: boolean;
  events: IambicEvent[];
}

const IambicVisualizer: React.FC<IambicVisualizerProps> = ({
  dotPressed,
  dashPressed,
  playingDot,
  playingDash,
  squeeze,
  queuedElements,
  events
}) => {
  const eventsRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll the events list to the bottom
  useEffect(() => {
    if (eventsRef.current) {
      eventsRef.current.scrollTop = eventsRef.current.scrollHeight;
    }
  }, [events]);
  
  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.title}>Iambic Keyer Visualizer</div>
      
      <div className={styles.row}>
        <div className={`${styles.indicator} ${dotPressed ? styles.active : ''}`}></div>
        <div className={styles.label}>Left Arrow (Dot Paddle)</div>
      </div>
      
      <div className={styles.row}>
        <div className={`${styles.indicator} ${dashPressed ? styles.active : ''}`}></div>
        <div className={styles.label}>Right Arrow (Dash Paddle)</div>
      </div>
      
      <div className={styles.row}>
        <div className={`${styles.indicator} ${playingDot ? styles.active + ' ' + styles.dot : ''}`}></div>
        <div className={styles.label}>Playing Dot (·)</div>
      </div>
      
      <div className={styles.row}>
        <div className={`${styles.indicator} ${playingDash ? styles.active + ' ' + styles.dash : ''}`}></div>
        <div className={styles.label}>Playing Dash (-)</div>
      </div>
      
      <div className={styles.row}>
        <div className={`${styles.indicator} ${squeeze ? styles.active + ' ' + styles.squeeze : ''}`}></div>
        <div className={styles.label}>Squeeze Mode (Both Paddles)</div>
      </div>
      
      <div className={styles.row}>
        <div className={`${styles.indicator} ${queuedElements ? styles.active + ' ' + styles.queue : ''}`}></div>
        <div className={styles.label}>Queued Elements</div>
      </div>
      
      <div className={styles.events} ref={eventsRef}>
        {events.slice(-20).map((event, index) => (
          <div key={index} className={styles.event}>
            <span className={styles.timestamp}>[{formatTime(event.timestamp)}]</span>
            <span className={styles.type}>{event.type}</span>
            {event.value && <span className={styles.value}> - {event.value}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IambicVisualizer;