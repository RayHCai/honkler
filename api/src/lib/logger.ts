import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const minLevel: LogLevel = env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function truncate(str: string, maxLen = 500): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `... (${str.length - maxLen} chars truncated)`;
}

function formatData(data: unknown): string {
  if (data === undefined || data === null) return '';
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return truncate(str, 1000);
  } catch {
    return String(data);
  }
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const color = LEVEL_COLORS[level];
  const ts = formatTimestamp();
  const prefix = `${DIM}${ts}${RESET} ${color}${BOLD}[${level.toUpperCase()}]${RESET} ${color}[${context}]${RESET}`;
  const formattedData = data !== undefined ? `\n${DIM}${formatData(data)}${RESET}` : '';

  console.log(`${prefix} ${message}${formattedData}`);
}

export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', context, message, data),
    info: (message: string, data?: unknown) => log('info', context, message, data),
    warn: (message: string, data?: unknown) => log('warn', context, message, data),
    error: (message: string, data?: unknown) => log('error', context, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
