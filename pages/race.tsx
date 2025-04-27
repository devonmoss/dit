import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout/Layout';
import RaceMode from '../components/RaceMode';
import { useAppState } from '../contexts/AppStateContext';

export default function RacePage() {
  // Save router for future use
  const router = useRouter();
  // These variables are used for future implementation
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { id } = router.query;
  const { setMode, setTestType } = useAppState();
  /* eslint-enable @typescript-eslint/no-unused-vars */
  
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