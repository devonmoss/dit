import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AuthProvider } from '../contexts/AuthContext';
import { AppStateProvider } from '../contexts/AppStateContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AppStateProvider>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </AppStateProvider>
    </AuthProvider>
  );
} 