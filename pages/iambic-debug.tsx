import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import { useIambicKeyer } from '../hooks/useIambicKeyer';
import { IambicDebugger, useIambicDebugger } from '../components/IambicDebugger';
import { useMorseAudio } from '../hooks/useMorseAudio';

const IambicDebugPage: React.FC = () => {
  const [output, setOutput] = useState<string[]>([]);
  const [wpm, setWpm] = useState(18);
  
  // Initialize audio system for playing sounds
  const { playMorseChar, stopAudio } = useMorseAudio();
  
  // Audio context and nodes
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [oscillator, setOscillator] = useState<OscillatorNode | null>(null);
  
  // Initialize audio context on first render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(ctx.destination);
      
      setAudioCtx(ctx);
      setGainNode(gain);
    }
    
    return () => {
      if (oscillator) {
        try {
          oscillator.stop();
          oscillator.disconnect();
        } catch (e) {
          // Ignore errors if already stopped
        }
      }
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }, []);
  
  // Function to play dot/dash with proper timing
  const playElement = async (sym: '.' | '-') => {
    if (!audioCtx || !gainNode) return;
    
    try {
      // If there's already an oscillator playing, stop it
      if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
      }
      
      // Create a new oscillator
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 600; // Standard CW tone
      osc.connect(gainNode);
      
      // Save oscillator reference
      setOscillator(osc);
      
      // Start the oscillator
      osc.start();
      
      // Calculate duration based on WPM
      const unit = 1200 / wpm;
      const duration = sym === '.' ? unit : unit * 3;
      
      // Schedule stop after duration
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Ignore errors if already stopped
        }
      }, duration);
    } catch (err) {
      console.error('Error playing element:', err);
    }
  };
  
  // Callback for when a character is decoded
  const onCharacter = (char: string) => {
    setOutput(prev => [...prev, char]);
    // We're NOT playing the character sound here anymore
    // since the keyer itself will play the individual elements
  };
  
  // Initialize iambic keyer
  const keyer = useIambicKeyer({
    wpm,
    onElement: (sym) => {
      // Just for display
      console.log(`Element: ${sym}`);
    },
    playElement, // Use our play function
    onCharacter,
    onWord: () => {
      setOutput(prev => [...prev, ' ']);
    },
    onWpmChange: (newWpm) => setWpm(newWpm),
  });
  
  // Connect debugger to keyer
  const debugInfo = useIambicDebugger(keyer);
  
  // Install/uninstall keyer on mount/unmount
  useEffect(() => {
    keyer.install();
    return () => {
      keyer.uninstall();
      stopAudio(); // Ensure all audio is stopped on unmount
    };
  }, [keyer, stopAudio]);
  
  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <h1>Iambic Keyer Debugger</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <p>Use the left and right arrow keys as iambic paddles:</p>
          <ul>
            <li>Left arrow (←) = DOT paddle</li>
            <li>Right arrow (→) = DASH paddle</li>
            <li>Press Tab to clear the current buffer</li>
          </ul>
        </div>
        
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px',
          border: '1px solid #ccc',
          minHeight: '100px',
          fontFamily: 'monospace',
          fontSize: '24px',
          lineHeight: '1.5'
        }}>
          {output.join('')}
        </div>
        
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setOutput([])}
            style={{ padding: '8px 16px' }}
          >
            Clear Output
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>WPM:</span>
            <input 
              type="range" 
              min="5" 
              max="40" 
              value={wpm} 
              onChange={(e) => setWpm(parseInt(e.target.value))}
              style={{ width: '150px' }}
            />
            <span>{wpm}</span>
          </div>
        </div>
        
        {/* Render the debug UI */}
        <IambicDebugger
          dotHeld={debugInfo.dotHeld}
          dashHeld={debugInfo.dashHeld}
          buffer={debugInfo.buffer}
          lastSymbol={debugInfo.lastSymbol}
          wpm={debugInfo.wpm}
          isActive={debugInfo.isActive}
          onEvent={debugInfo.addEvent}
        />
      </div>
    </Layout>
  );
};

export default IambicDebugPage;