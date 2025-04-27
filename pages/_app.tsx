import React from 'react';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { AppStateProvider } from '../contexts/AppStateContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AppStateProvider>
        <Component {...pageProps} />
      </AppStateProvider>
    </AuthProvider>
  );
} 