import { useRef, useCallback, useEffect, useState } from 'react';
import { createAudioContext, wait, isBrowser } from '../utils/morse';

export function useMorseAudio() {
  // Use state instead of ref for SSR compatibility
  const [audioContextInstance, setAudioContextInstance] = useState<ReturnType<typeof createAudioContext> | null>(null);
  const currentOscillators = useRef<OscillatorNode[]>([]);
  const isPlaying = useRef(false);
  
  // Initialize audio context on client-side only
  useEffect(() => {
    if (isBrowser) {
      setAudioContextInstance(createAudioContext());
    }
  }, []);
  
  // Play a single character of Morse code
  const playMorseChar = useCallback(async (char: string) => {
    if (!char || !audioContextInstance) return;
    
    isPlaying.current = true;
    await audioContextInstance.playMorse(char);
  }, [audioContextInstance]);
  
  // Play an entire text string as Morse code
  const playMorseCode = useCallback(async (text: string) => {
    if (!text || !audioContextInstance) return;
    
    // Stop any current audio
    stopAudio();
    isPlaying.current = true;
    
    // Start playing each character in sequence
    for (let i = 0; i < text.length; i++) {
      if (!isPlaying.current) break; // Allow stopping mid-playback
      await audioContextInstance.playMorse(text[i]);
      // Inter-character gap (already handled within playMorse)
    }
  }, [audioContextInstance]);
  
  // Stop all audio
  const stopAudio = useCallback(() => {
    isPlaying.current = false;
    
    // Stop any current oscillators
    currentOscillators.current.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Ignore errors if oscillator already stopped
      }
    });
    
    // Clear the array
    currentOscillators.current = [];
  }, []);
  
  return {
    playMorseCode,
    playMorseChar,
    stopAudio
  };
} 