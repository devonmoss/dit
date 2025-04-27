import React from 'react';
import Layout from '../components/Layout/Layout';
import TrainingMode from '../components/TrainingMode/TrainingMode';
import SendingMode from '../components/SendingMode/SendingMode';
import RaceMode from '../components/RaceMode';
import { useAppState } from '../contexts/AppStateContext';

export default function Home() {
  const { state } = useAppState();

  const renderActiveMode = () => {
    // Race mode - check test type first
    if (state.testType === 'race') {
      return <RaceMode />;
    }
    
    // Copy mode (listening)
    if (state.mode === 'copy' && state.testType === 'training') {
      return <TrainingMode />;
    }
    
    // Send mode (keying)
    if (state.mode === 'send') {
      return <SendingMode />;
    }
    
    // Placeholder for other modes
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Feature Coming Soon</h2>
        <p>This mode is not yet implemented in the Next.js version.</p>
      </div>
    );
  };

  return (
    <Layout>
      {renderActiveMode()}
    </Layout>
  );
} 