/**
 * Structured logger with environment-aware configuration.
 * Only logs in development mode by default, but always logs errors.
 */

// Determine environment
const DEBUG_MODE = process.env.NODE_ENV === 'development';

/**
 * Structured logger interface
 */
export interface ILogger {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Creates a logger instance, optionally with component name for better tracing
 */
export function createLogger(componentName?: string): ILogger {
  const prefix = componentName ? `[${componentName}]` : '';
  
  return {
    info: (...args: any[]) => DEBUG_MODE && console.log(prefix, ...args),
    warn: (...args: any[]) => DEBUG_MODE && console.warn(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args), // Always log errors
    debug: (...args: any[]) => DEBUG_MODE && console.debug(prefix, ...args),
  };
}

// Default logger
export const logger = createLogger();