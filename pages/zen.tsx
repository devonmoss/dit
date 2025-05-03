import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout/Layout';
import Zen from '../components/Zen/Zen';
import { useAppState } from '../contexts/AppStateContext';

export default function ZenPage() {
  const router = useRouter();
  const { setTestType } = useAppState();

  // Ensure test type is 'zen' on mount
  useEffect(() => {
    setTestType('zen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout title="Zen Freestyle">
      <Zen />
    </Layout>
  );
}