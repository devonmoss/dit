import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import TrainingMode from '../components/TrainingMode/TrainingMode';
import SendingMode from '../components/SendingMode/SendingMode';
import RaceMode from '../components/RaceMode';
import { useAppState } from '../contexts/AppStateContext';

export default function Home() {
  const { state } = useAppState();
  const [isClient, setIsClient] = useState(false);
  
  // Only render mode-specific components after hydration is complete
  useEffect(() => {
    setIsClient(true);
  }, []);

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
    
    // Default fallback - this should rarely happen
    return null;
  };

  return (
    <Layout>
      {isClient ? renderActiveMode() : 
        <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>Loading...</div>
        </div>
      }
    </Layout>
  );
} 