import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_NAME,
  cleanName,
  parseEmote,
  parseHello,
} from '../src/protocol.ts';

const ULID = '01GAFTZ9K80003DHH026MC7JW0';

test('hello: valid join, group key is case-insensitive and trimmed', () => {
  const parsed = parseHello({
    protocol: 2,
    name: 'Raphi',
    group: '  Friends ',
  });
  assert.deepEqual(parsed, {
    ok: true,
    value: { name: 'Raphi', group: 'Friends', key: 'friends' },
  });
});

test('hello: missing or empty group means the default group', () => {
  for (const group of [undefined, '', '   ']) {
    const parsed = parseHello({ protocol: 2, name: 'A', group });
    assert.ok(parsed.ok);
    assert.equal(parsed.value.key, '');
  }
});

test('hello: empty name becomes Anonymous', () => {
  const parsed = parseHello({ protocol: 2, name: ' ​ ', group: '' });
  assert.ok(parsed.ok);
  assert.equal(parsed.value.name, DEFAULT_NAME);
});

test('hello: rejects wrong protocol, bad shapes and long values', () => {
  const reasons = [
    parseHello({ protocol: 1, name: 'A' }),
    parseHello('hello'),
    parseHello(null),
    parseHello([]),
    parseHello({ protocol: 2, name: 'x'.repeat(33) }),
    parseHello({ protocol: 2, name: 'A', group: 'g'.repeat(65) }),
    parseHello({ protocol: 2, name: 'A', group: 42 }),
  ];
  for (const parsed of reasons) assert.equal(parsed.ok, false);
});

test('hello: 32 characters counts characters, not UTF-16 units', () => {
  const parsed = parseHello({ protocol: 2, name: '😀'.repeat(32) });
  assert.ok(parsed.ok);
});

test('cleanName strips control and bidi characters and squashes spaces', () => {
  assert.equal(cleanName('  Ra\u0000ph‮i  \t two  '), 'Raphi two');
});

test('emote: only well-formed 7TV IDs pass', () => {
  assert.equal(parseEmote({ emoteId: ULID }), ULID);
  assert.equal(parseEmote({ emoteId: ULID.toLowerCase() }), null);
  assert.equal(parseEmote({ emoteId: '../../etc/passwd' }), null);
  assert.equal(parseEmote(ULID), null);
  assert.equal(parseEmote({}), null);
});
