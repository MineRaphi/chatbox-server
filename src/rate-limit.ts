export type Take = { ok: true } | { ok: false; retryInMs: number };

/**
 * Sliding-window limiter for one connection: at most `limit` events in any
 * `windowMs`. A limit of 0 means no limit.
 */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #times: number[] = [];

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  take(): Take {
    if (this.#limit === 0) return { ok: true };
    const now = this.#now();
    while (this.#times.length && now - this.#times[0]! >= this.#windowMs) {
      this.#times.shift();
    }
    if (this.#times.length >= this.#limit) {
      return { ok: false, retryInMs: this.#times[0]! + this.#windowMs - now };
    }
    this.#times.push(now);
    return { ok: true };
  }
}
