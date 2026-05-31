declare global {
  // eslint-disable-next-line no-var
  var __loginCleanupTimer: ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __rateLimitCleanupTimer: ReturnType<typeof setInterval> | undefined;
}

export {};
