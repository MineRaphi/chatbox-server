import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, loadConfig } from '../src/config.ts';

test('defaults when nothing is set', () => {
  assert.deepEqual(loadConfig({}), DEFAULTS);
});

test('reads PORT and RATE_LIMIT', () => {
  const config = loadConfig({ PORT: '3848', RATE_LIMIT: '0' });
  assert.equal(config.port, 3848);
  assert.equal(config.rateLimit, 0);
});

test('rejects invalid values with a clear message', () => {
  assert.throws(
    () => loadConfig({ PORT: 'abc' }),
    /PORT must be a whole number/,
  );
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT/);
  assert.throws(() => loadConfig({ RATE_LIMIT: '-1' }), /RATE_LIMIT/);
});
