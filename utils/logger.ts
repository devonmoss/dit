/**
 * Structured logger with environment-aware configuration.
 * Only logs in development mode by default, but always logs errors.
 */

// Determine environment
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Log levels to control verbosity
export enum LogLevel {
  NONE = 0,    // No logging except for errors
  ERROR = 1,   // Only errors
  WARN = 2,    // Errors and warnings
  INFO = 3,    // Errors, warnings, and info messages
  DEBUG = 4    // All messages
}

// Default log level (can be adjusted at runtime)
let globalLogLevel = DEBUG_MODE ? LogLevel.DEBUG : LogLevel.ERROR;

// Components that should have logging disabled/reduced
const quietComponents: string[] = ['SendingMode'];

/**
 * Set the global log level
 */
export function setLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

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
  
  // Determine component-specific log level
  const isQuietComponent = componentName && quietComponents.includes(componentName);
  const componentLogLevel = isQuietComponent ? LogLevel.WARN : globalLogLevel;
  
  return {
    info: (...args: any[]) => 
      DEBUG_MODE && componentLogLevel >= LogLevel.INFO && console.log(prefix, ...args),
    
    warn: (...args: any[]) => 
      DEBUG_MODE && componentLogLevel >= LogLevel.WARN && console.warn(prefix, ...args),
    
    error: (...args: any[]) => 
      componentLogLevel >= LogLevel.ERROR && console.error(prefix, ...args),
    
    debug: (...args: any[]) => 
      DEBUG_MODE && componentLogLevel >= LogLevel.DEBUG && console.debug(prefix, ...args),
  };
}

// Default logger
export const logger = createLogger();