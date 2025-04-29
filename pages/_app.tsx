import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AuthProvider } from '../contexts/AuthContext';
import { AppStateProvider } from '../contexts/AppStateContext';
import { analyticsConfig } from '../utils/analytics-config';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { NavigationEvents } from '../utils/analytics';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Track page views
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      NavigationEvents.pageView(url);
    };

    // Track initial page load
    NavigationEvents.pageView(window.location.pathname);

    // Track route changes
    router.events.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <AuthProvider>
      <AppStateProvider>
        <Component {...pageProps} />
        <Analytics {...analyticsConfig} />
        <SpeedInsights />
      </AppStateProvider>
    </AuthProvider>
  );
} 