// Morse code mapping for letters and numbers
export const morseMap: { [key: string]: string } = {
  a: ".-",
  b: "-...",
  c: "-.-.",
  d: "-..",
  e: ".",
  f: "..-.",
  g: "--.",
  h: "....",
  i: "..",
  j: ".---",
  k: "-.-",
  l: ".-..",
  m: "--",
  n: "-.",
  o: "---",
  p: ".--.",
  q: "--.-",
  r: ".-.",
  s: "...",
  t: "-",
  u: "..-",
  v: "...-",
  w: ".--",
  x: "-..-",
  y: "-.--",
  z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
};

// Inverse morse mapping for decoding
export const invMorseMap = Object.fromEntries(
  Object.entries(morseMap).map(([k, v]) => [v, k])
);

// Default character set
export const defaultChars = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

// Helper function for timing
export const wait = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Check if code is running in a browser environment
export const isBrowser = typeof window !== 'undefined';

// Audio playback utility functions
export interface AudioContext {
  playMorse: (char: string) => Promise<void>;
  playSymbol: (symbol: string) => Promise<void>;
  playErrorSound: () => Promise<void>;
  playTone: (frequency: number, duration: number, volumeScale?: number) => Promise<void>;
  setVolume: (volume: number) => void;
  setWpm: (wpm: number) => void;
  getRawContext: () => globalThis.AudioContext;
}

export const createAudioContext = (): AudioContext => {
  // Initialize Web Audio API
  let audioContext: globalThis.AudioContext | null = null;
  let gainNode: GainNode | null = null;
  
  // Default values
  let wpm = 20;
  let volume = 75;
  
  // Get settings from localStorage if in browser environment
  if (isBrowser) {
    const storedWpm = localStorage.getItem("morseWpm");
    const storedVolume = localStorage.getItem("morseVolume");
    
    if (storedWpm) {
      const parsedWpm = parseInt(storedWpm, 10);
      if (!isNaN(parsedWpm) && parsedWpm > 0) {
        wpm = parsedWpm;
      }
    }
    
    if (storedVolume) {
      const parsedVolume = parseInt(storedVolume, 10);
      if (!isNaN(parsedVolume) && parsedVolume >= 0) {
        volume = parsedVolume;
      }
    }
  }
  
  // Unit duration calculation
  let unit = 1200 / wpm;

  // Initialize audio context and gain node if needed
  const initAudio = () => {
    if (!isBrowser) return;
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNode = audioContext.createGain();
      gainNode.gain.value = volume / 100;
      gainNode.connect(audioContext.destination);
    }
  };
  
  // Play a morse code symbol (dot or dash)
  const playSymbol = async (symbol: string): Promise<void> => {
    if (!isBrowser) return Promise.resolve();
    
    initAudio();
    if (!audioContext || !gainNode) return Promise.resolve();
    
    return new Promise((resolve) => {
      const osc = audioContext!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 600;
      osc.connect(gainNode!);
      
      const duration = symbol === "." ? unit : unit * 3;
      
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, duration);
    });
  };
  
  // Play a complete morse character
  const playMorse = async (char: string): Promise<void> => {
    if (!isBrowser) return Promise.resolve();
    
    const symbols = morseMap[char.toLowerCase()] || "";
    for (let i = 0; i < symbols.length; i++) {
      await playSymbol(symbols[i]);
      // Inter-element gap (1 unit)
      if (i < symbols.length - 1) await wait(unit);
    }
    // Inter-character gap (3 units, but we already waited 1 above)
    await wait(unit * 2);
  };
  
  // Play error feedback sound
  const playErrorSound = async (): Promise<void> => {
    if (!isBrowser) return Promise.resolve();
    
    initAudio();
    if (!audioContext || !gainNode) return Promise.resolve();
    
    return new Promise((resolve) => {
      const osc = audioContext!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 220;
      osc.connect(gainNode!);
      
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, 300);
    });
  };
  
  // Update volume
  const setVolume = (newVolume: number): void => {
    volume = newVolume;
    
    if (gainNode) {
      gainNode.gain.value = volume / 100;
    }
    
    if (isBrowser) {
      localStorage.setItem("morseVolume", volume.toString());
    }
  };
  
  // Update WPM
  const setWpm = (newWpm: number): void => {
    wpm = newWpm;
    unit = 1200 / wpm;
    
    if (isBrowser) {
      localStorage.setItem("morseWpm", wpm.toString());
    }
  };
  
  // Play any tone with custom parameters
  const playTone = async (frequency: number, duration: number, volumeScale: number = 1.0): Promise<void> => {
    if (!isBrowser) return Promise.resolve();
    
    initAudio();
    if (!audioContext || !gainNode) return Promise.resolve();
    
    return new Promise((resolve) => {
      const osc = audioContext!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      
      // Create temporary gain node for this specific sound
      const tempGain = audioContext!.createGain();
      tempGain.gain.value = (volume / 100) * volumeScale;
      osc.connect(tempGain);
      tempGain.connect(audioContext!.destination);
      
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, duration);
    });
  };
  
  // Get the raw audio context
  const getRawContext = (): globalThis.AudioContext => {
    initAudio();
    if (!audioContext) {
      throw new Error('Audio context not initialized');
    }
    return audioContext;
  };
  
  return {
    playMorse,
    playSymbol,
    playErrorSound,
    playTone,
    setVolume,
    setWpm,
    getRawContext
  };
}; 