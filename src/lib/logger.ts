type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface LoggerConfig {
  enableDebug: boolean;
  enableConsole: boolean;
  prefix: string;
}

const config: LoggerConfig = {
  enableDebug: import.meta.env.DEV,
  enableConsole: true,
  prefix: '[NOID]',
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#6b7280', // gray
  info: '#3b82f6',  // blue
  warn: '#f59e0b',  // amber
  error: '#ef4444', // red
};

function formatMessage(level: LogLevel, message: string): string {
  return `${config.prefix} [${level.toUpperCase()}] ${message}`;
}

function createLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
}

function logToConsole(entry: LogEntry) {
  if (!config.enableConsole) return;
  
  const color = LOG_COLORS[entry.level];
  const formattedMessage = formatMessage(entry.level, entry.message);
  
  const style = `color: ${color}; font-weight: bold;`;
  
  switch (entry.level) {
    case 'debug':
      if (config.enableDebug) {
        console.debug(`%c${formattedMessage}`, style, entry.data || '');
      }
      break;
    case 'info':
      console.info(`%c${formattedMessage}`, style, entry.data || '');
      break;
    case 'warn':
      console.warn(`%c${formattedMessage}`, style, entry.data || '');
      break;
    case 'error':
      console.error(`%c${formattedMessage}`, style, entry.data || '');
      break;
  }
}

export const logger = {
  /**
   * Debug level - only shown in development
   */
  debug(message: string, data?: Record<string, unknown>) {
    const entry = createLogEntry('debug', message, data);
    logToConsole(entry);
    return entry;
  },

  /**
   * Info level - general information
   */
  info(message: string, data?: Record<string, unknown>) {
    const entry = createLogEntry('info', message, data);
    logToConsole(entry);
    return entry;
  },

  /**
   * Warning level - potential issues
   */
  warn(message: string, data?: Record<string, unknown>) {
    const entry = createLogEntry('warn', message, data);
    logToConsole(entry);
    return entry;
  },

  /**
   * Error level - errors and exceptions
   */
  error(message: string, data?: Record<string, unknown>) {
    const entry = createLogEntry('error', message, data);
    logToConsole(entry);
    return entry;
  },

  /**
   * Log performance timing
   */
  time(label: string) {
    if (config.enableDebug) {
      console.time(`${config.prefix} ${label}`);
    }
  },

  timeEnd(label: string) {
    if (config.enableDebug) {
      console.timeEnd(`${config.prefix} ${label}`);
    }
  },

  /**
   * Group related logs
   */
  group(label: string) {
    if (config.enableDebug) {
      console.group(`${config.prefix} ${label}`);
    }
  },

  groupEnd() {
    if (config.enableDebug) {
      console.groupEnd();
    }
  },

  /**
   * Configure logger settings
   */
  configure(newConfig: Partial<LoggerConfig>) {
    Object.assign(config, newConfig);
  },
};

export type { LogLevel, LogEntry, LoggerConfig };
