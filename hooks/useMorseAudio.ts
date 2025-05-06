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
      const context = createAudioContext();
      setAudioContextInstance(context);
      
      // Add a one-time event listener to the document to resume the context on user interaction
      const resumeAudioContext = async () => {
        if (context.getRawContext().state === 'suspended') {
          try {
            await context.getRawContext().resume();
            console.log('AudioContext resumed by user interaction');
          } catch (err) {
            console.error('Failed to resume AudioContext:', err);
          }
        }
      };
      
      document.addEventListener('click', resumeAudioContext, { once: true });
      document.addEventListener('keydown', resumeAudioContext, { once: true });
      
      return () => {
        document.removeEventListener('click', resumeAudioContext);
        document.removeEventListener('keydown', resumeAudioContext);
      };
    }
  }, []);
  
  // Play a single character of Morse code
  const playMorseChar = useCallback(async (char: string) => {
    if (!char) {
      console.log('AUDIO DEBUG: playMorseChar called with empty character');
      return;
    }
    
    console.log(`AUDIO DEBUG: playMorseChar called for character '${char}'`, {
      hasAudioContext: !!audioContextInstance,
      audioContextState: audioContextInstance ? audioContextInstance.getRawContext().state : 'no context'
    });
    
    // Ensure audio context is initialized
    if (!audioContextInstance && isBrowser) {
      console.log('AUDIO DEBUG: Creating new audio context for playback');
      const newContext = createAudioContext();
      setAudioContextInstance(newContext);
      
      // Handle autoplay policy - we need to resume the context on user interaction
      // This is needed because browsers require user interaction before playing audio
      if (newContext.getRawContext().state === 'suspended') {
        console.log('AUDIO DEBUG: New audio context is suspended, attempting to resume');
        try {
          await newContext.getRawContext().resume();
          console.log('AUDIO DEBUG: AudioContext resumed successfully');
        } catch (err) {
          console.error('AUDIO DEBUG: Failed to resume AudioContext:', err);
          return;
        }
      }
      
      // Use the new context to play the morse
      console.log(`AUDIO DEBUG: Playing '${char}' with new audio context`);
      isPlaying.current = true;
      await newContext.playMorse(char);
      console.log(`AUDIO DEBUG: Finished playing '${char}' with new audio context`);
      return;
    }
    
    // If context exists but is suspended, try to resume it
    if (audioContextInstance && audioContextInstance.getRawContext().state === 'suspended') {
      console.log('AUDIO DEBUG: Existing audio context is suspended, attempting to resume');
      try {
        await audioContextInstance.getRawContext().resume();
        console.log('AUDIO DEBUG: AudioContext resumed successfully');
      } catch (err) {
        console.error('AUDIO DEBUG: Failed to resume AudioContext:', err);
        return;
      }
    }
    
    console.log(`AUDIO DEBUG: Playing '${char}' with existing audio context`);
    isPlaying.current = true;
    await audioContextInstance?.playMorse(char);
    console.log(`AUDIO DEBUG: Finished playing '${char}'`);
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
    console.log("[AUDIO] Stopping all audio");
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
    
    // Also try to access custom methods on the audio context if they exist
    if (audioContextInstance && audioContextInstance.getRawContext()) {
      const rawContext = audioContextInstance.getRawContext();
      // @ts-ignore - Check for custom method that might be added to the context
      if (typeof rawContext.stopAllTones === 'function') {
        try {
          console.log("[AUDIO] Calling stopAllTones");
          // @ts-ignore - Custom method
          rawContext.stopAllTones();
        } catch (err) {
          console.error('Error stopping tones:', err);
        }
      }
    }
  }, [audioContextInstance]);
  
  return {
    playMorseCode,
    playMorseChar,
    stopAudio
  };
} 