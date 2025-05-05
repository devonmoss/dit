import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { useIambicKeyer, IambicKeyer } from '../../hooks/useIambicKeyer';
import { createAudioContext } from '../../utils/morse';
import styles from './Zen.module.css';

// Emoji options for invalid characters
const INVALID_EMOJIS = [
  '🤷‍♂️', // man shrugging
  '🪦', // grave headstone
  '😵', // face with x for eyes
  '💀', // skull
  '🤔', // thinking face
  '🫠', // melting face
  '🫨', // shaking face
  '🤪', // zany face
  '🙃', // upside-down face
  '❓', // question mark
  '⚠️', // warning
  '🔥', // fire
];

const Zen: React.FC = () => {
  const { state, setSendWpm } = useAppState();
  const [text, setText] = useState('');
  const audio = useMemo(() => createAudioContext(), []);
  
  // Function to get a random emoji from our list
  const getRandomEmoji = () => {
    const randomIndex = Math.floor(Math.random() * INVALID_EMOJIS.length);
    return INVALID_EMOJIS[randomIndex];
  };
  
  // Create the keyer at the top level of the component
  const keyer = useIambicKeyer({
    wpm: state.sendWpm,
    onElement: () => {},
    playElement: (sym) => { audio.playSymbol(sym); },
    onCharacter: (char) => setText(t => t + char),
    onWord: () => setText(t => t + ' '),
    onWpmChange: (newWpm) => {
      setSendWpm(newWpm);
      audio.setWpm(newWpm);
      console.log(`[Zen] WPM changed to ${newWpm}, audio timing updated`);
    },
    onInvalidCharacter: (code) => {
      console.log(`Zen received invalid code: ${code}`);
      const emoji = getRandomEmoji();
      setText(t => t + emoji);
    },
  });
  
  // Use a ref to track if we've already installed the keyer
  const isInstalledRef = useRef(false);
  
  // Initialize audio WPM to match app state
  useEffect(() => {
    audio.setWpm(state.sendWpm);
  }, [audio, state.sendWpm]);
  
  // Install keyer once on mount
  useEffect(() => {
    // Only install if not already installed
    if (!isInstalledRef.current) {
      console.log('[Zen] Installing keyer (should happen only once)');
      keyer.install();
      isInstalledRef.current = true;
    }
    
    // Cleanup function - only uninstall on unmount
    return () => {
      console.log('[Zen] Uninstalling keyer (should happen only on unmount)');
      keyer.uninstall();
      isInstalledRef.current = false;
    };
  }, []); // Empty dependency array = only run on mount and unmount

  return (
    <div className={styles.container}>
      <textarea
        className={styles.textarea}
        value={text}
        readOnly
        placeholder="Freestyle here..."
      />
    </div>
  );
};

export default Zen;