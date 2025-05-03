import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout/Layout';
import { useIambicKeyer } from '../hooks/useIambicKeyer';

const IambicSimplePage: React.FC = () => {
  const [output, setOutput] = useState<string>('');
  const [wpm, setWpm] = useState(18);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  // Initialize audio on first render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;
      
      console.log('Audio context initialized');
    }
    
    return () => {
      stopSound();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  const stopSound = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      } catch (e) {
        // Ignore errors
      }
    }
  };
  
  const playElement = (symbol: '.' | '-') => {
    console.log(`Playing ${symbol}`);
    
    if (!audioContextRef.current || !gainNodeRef.current) {
      console.error('Audio context not initialized');
      return;
    }
    
    // Stop any current sound
    stopSound();
    
    // Calculate duration based on WPM
    const unitMs = 1200 / wpm;
    const duration = symbol === '.' ? unitMs : unitMs * 3;
    
    // Create oscillator
    const osc = audioContextRef.current.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;
    osc.connect(gainNodeRef.current);
    
    // Save reference and start
    oscillatorRef.current = osc;
    osc.start();
    
    // Schedule stop
    setTimeout(() => {
      if (oscillatorRef.current === osc) {
        stopSound();
      }
    }, duration);
  };
  
  const logElement = (sym: '.' | '-') => {
    setOutput(prev => prev + sym);
  };
  
  const logChar = (char: string) => {
    setOutput(prev => prev + ' ' + char + ' ');
  };
  
  const logWord = () => {
    setOutput(prev => prev + ' / ');
  };
  
  // Initialize keyer
  const keyer = useIambicKeyer({
    wpm,
    onElement: logElement,
    playElement: playElement,
    onCharacter: logChar,
    onWord: logWord,
    onWpmChange: setWpm,
  });
  
  // Install on mount
  useEffect(() => {
    console.log('Installing keyer');
    keyer.install();
    return () => {
      console.log('Uninstalling keyer');
      keyer.uninstall();
    };
  }, [keyer]);
  
  return (
    <Layout>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Simple Iambic Keyer</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <p>Use the left and right arrow keys as iambic paddles:</p>
          <ul>
            <li>Left arrow (←) = DOT paddle</li>
            <li>Right arrow (→) = DASH paddle</li>
            <li>Up/Down arrows = Speed control</li>
            <li>Press Tab to clear</li>
          </ul>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
          <span>Speed: {wpm} WPM</span>
          <input 
            type="range" 
            min="5" 
            max="40" 
            value={wpm} 
            onChange={(e) => setWpm(parseInt(e.target.value))}
            style={{ width: '200px' }}
          />
        </div>
        
        <div style={{ 
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '15px',
          minHeight: '200px',
          fontFamily: 'monospace',
          fontSize: '18px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: '1.5',
          marginBottom: '20px'
        }}>
          {output || <span style={{ color: '#999' }}>Output will appear here...</span>}
        </div>
        
        <button 
          onClick={() => setOutput('')}
          style={{ padding: '8px 16px' }}
        >
          Clear Output
        </button>
      </div>
    </Layout>
  );
};

export default IambicSimplePage;