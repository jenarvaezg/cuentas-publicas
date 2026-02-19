/**
 * Simple logger to centralize console output and make it testable/mockable
 */
export const logger = {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  info: (...args) => console.info(...args)
}
