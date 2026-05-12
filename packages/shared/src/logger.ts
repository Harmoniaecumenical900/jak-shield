type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const ACTIVE_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';
const ACTIVE_RANK = LEVEL_RANK[ACTIVE_LEVEL] ?? 30;

export interface Logger {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
}

function emit(level: LogLevel, namespace: string, args: unknown[]): void {
  if (LEVEL_RANK[level] < ACTIVE_RANK) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [${namespace}]`;
  if (level === 'error' || level === 'fatal') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    // Use stderr for stdio-MCP compatibility — stdout is reserved for protocol traffic.
    process.stderr.write(`${prefix} ${args.map(stringify).join(' ')}\n`);
  }
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function createLogger(namespace: string): Logger {
  return {
    trace: (...args) => emit('trace', namespace, args),
    debug: (...args) => emit('debug', namespace, args),
    info: (...args) => emit('info', namespace, args),
    warn: (...args) => emit('warn', namespace, args),
    error: (...args) => emit('error', namespace, args),
    fatal: (...args) => emit('fatal', namespace, args),
  };
}
