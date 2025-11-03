export function logInfo(message: string, context?: Record<string, unknown>) {
  try {
    if (context) {
      console.log(`[FILES] ${message}`, context);
    } else {
      console.log(`[FILES] ${message}`);
    }
  } catch {}
}

export function logError(err: unknown, message?: string, context?: Record<string, unknown>) {
  try {
    const base = message ? `[FILES] ${message}` : `[FILES] error`;
    if (context) {
      console.error(base, err, context);
    } else {
      console.error(base, err);
    }
  } catch {}
}
