import React, { useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import RaceMode from '../components/RaceMode';
import { useAppState } from '../contexts/AppStateContext';

export default function RacePage() {
  const { setTestType } = useAppState();
  
  // When loading the race page, ensure test type is set to race
  // but preserving the current copy/send mode
  useEffect(() => {
    // Ensure test type is set to 'race' once on mount
    setTestType('race');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <Layout title="Morse Code Race">
      <RaceMode />
    </Layout>
  );
} 