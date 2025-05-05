import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { useIambicKeyer } from '../../hooks/useIambicKeyer';
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
  
  // Initialize audio WPM to match app state
  useEffect(() => {
    audio.setWpm(state.sendWpm);
  }, [audio, state.sendWpm]);
  
  // Function to get a random emoji from our list
  const getRandomEmoji = () => {
    const randomIndex = Math.floor(Math.random() * INVALID_EMOJIS.length);
    return INVALID_EMOJIS[randomIndex];
  };
  
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

  useEffect(() => {
    keyer.install();
    return () => { keyer.uninstall(); };
  }, [keyer]);

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