const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// Set to true to enable logging in production builds for debugging
const FORCE_DEBUG = false;

export const logDebug = (...args: unknown[]) => {
  if (isDev || FORCE_DEBUG) {
    console.log('[DEBUG]', ...args);
  }
};

export const logWarn = (...args: unknown[]) => {
  if (isDev || FORCE_DEBUG) {
    console.warn('[WARN]', ...args);
  }
};

export const logError = (...args: unknown[]) => {
  // Always log errors
  console.error('[ERROR]', ...args);
};
