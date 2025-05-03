import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { useIambicKeyer } from '../../hooks/useIambicKeyer';
import { createAudioContext } from '../../utils/morse';
import styles from './Zen.module.css';

const Zen: React.FC = () => {
  const { state, setSendWpm } = useAppState();
  const [text, setText] = useState('');
  const audio = useMemo(() => createAudioContext(), []);
  const keyer = useIambicKeyer({
    wpm: state.sendWpm,
    onElement: () => {},
    playElement: (sym) => { audio.playSymbol(sym); },
    onCharacter: (char) => setText(t => t + char),
    onWord: () => setText(t => t + ' '),
    onWpmChange: (newWpm) => setSendWpm(newWpm),
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