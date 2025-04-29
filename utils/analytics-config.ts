import type { AnalyticsProps } from '@vercel/analytics/react';

// Configure analytics defaults
export const analyticsConfig: AnalyticsProps = {
  // Controls whether to collect and send page views automatically
  // You can still track page views manually using Analytics.Navigation.pageView()
  debug: process.env.NODE_ENV === 'development',
  
  // Configure data before it's sent
  beforeSend: (event) => {
    // Never collect personally identifiable information
    if (event.url) {
      // Remove query parameters that might contain sensitive information
      const url = new URL(event.url);
      
      // Keep only certain query parameters that aren't sensitive
      const allowedParams = ['id', 'mode', 'type', 'level'];
      const params = Array.from(url.searchParams.keys());
      
      params.forEach(param => {
        if (!allowedParams.includes(param)) {
          url.searchParams.delete(param);
        }
      });
      
      // Update the URL without the sensitive parameters
      event.url = url.toString();
    }
    
    // Filter out development environments
    if (
      event.url?.includes('localhost') ||
      event.url?.includes('127.0.0.1') ||
      event.url?.includes('192.168.')
    ) {
      // Optionally return null to completely drop events from development
      // Return null to not send the event in development (unless debug is true)
      return process.env.NODE_ENV === 'development' && !analyticsConfig.debug 
        ? null 
        : event;
    }
    
    return event;
  },
};

export default analyticsConfig;