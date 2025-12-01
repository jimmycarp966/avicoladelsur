/**
 * Logger utility for development-only logging
 * 
 * This utility ensures that console logs are only executed in development mode,
 * improving performance in production by eliminating unnecessary logging overhead.
 */

const isDev = process.env.NODE_ENV === 'development'

/**
 * Logs a message only in development mode
 * @param args - Arguments to log (same as console.log)
 */
export function devLog(...args: any[]): void {
  if (isDev) {
    console.log('[DEV]', ...args)
  }
}

/**
 * Logs an error only in development mode
 * @param args - Arguments to log (same as console.error)
 */
export function devError(...args: any[]): void {
  if (isDev) {
    console.error('[DEV ERROR]', ...args)
  }
}

/**
 * Logs a warning only in development mode
 * @param args - Arguments to log (same as console.warn)
 */
export function devWarn(...args: any[]): void {
  if (isDev) {
    console.warn('[DEV WARN]', ...args)
  }
}

/**
 * Logs info only in development mode
 * @param args - Arguments to log (same as console.info)
 */
export function devInfo(...args: any[]): void {
  if (isDev) {
    console.info('[DEV INFO]', ...args)
  }
}

