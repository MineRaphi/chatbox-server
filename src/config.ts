export interface Config {
  /** TCP port to listen on; 0 picks a free one (used by tests). */
  port: number;
  /** Emotes per connection per rate window; 0 turns the limit off. */
  rateLimit: number;
  /** Length of the rate-limit window in milliseconds. */
  rateWindowMs: number;
}

export const DEFAULTS: Config = {
  port: 3847,
  rateLimit: 30,
  rateWindowMs: 10_000,
};

function integer(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} must be a whole number from ${min} to ${max}, got "${raw}"`,
    );
  }
  return value;
}

/** Read settings from environment variables, falling back to the defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: integer('PORT', env.PORT, DEFAULTS.port, 1, 65_535),
    rateLimit: integer(
      'RATE_LIMIT',
      env.RATE_LIMIT,
      DEFAULTS.rateLimit,
      0,
      10_000,
    ),
    rateWindowMs: DEFAULTS.rateWindowMs,
  };
}
