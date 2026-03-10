/**
 * Professional logging utility for the application.
 * Provides consistent logging across the app with configurable levels.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  level: LogLevel
  prefix: string
  enabled: boolean
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Get log level from environment or default based on NODE_ENV
const getDefaultLevel = (): LogLevel => {
  const env = import.meta.env.MODE
  if (env === 'production') return 'error'
  if (env === 'test') return 'warn'
  return 'debug'
}

class Logger {
  private config: LoggerConfig

  constructor(prefix: string = 'App') {
    this.config = {
      level: getDefaultLevel(),
      prefix,
      enabled: import.meta.env.MODE !== 'test',
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    return `[${timestamp}] [${level.toUpperCase()}] [${this.config.prefix}] ${message}`
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args)
    }
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error, ...args)
    }
  }

  /** Create a child logger with a different prefix */
  child(prefix: string): Logger {
    const child = new Logger(`${this.config.prefix}:${prefix}`)
    child.config.level = this.config.level
    child.config.enabled = this.config.enabled
    return child
  }

  /** Set the log level */
  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  /** Enable or disable logging */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }
}

// Root logger instance
export const logger = new Logger('SocSim')

// Create module-specific loggers
export const createLogger = (prefix: string): Logger => logger.child(prefix)

export default logger
