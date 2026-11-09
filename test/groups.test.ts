import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import type { Socket } from 'socket.io-client';
import type {
  EmoteOut,
  MembersPayload,
  WelcomePayload,
} from '../src/protocol.ts';
import type { ChatboxServer } from '../src/server.ts';
import { connect, next, silent, startTestServer } from './helpers.ts';

const PEPE = '01GAFTZ9K80003DHH026MC7JW0';

let server: ChatboxServer;
const open: Socket[] = [];

before(async () => {
  server = await startTestServer();
});
after(() => server.close());
afterEach(() => {
  for (const s of open.splice(0)) s.disconnect();
});

/** Connect and join; resolves with the socket and its welcome. */
async function join(
  name: string,
  group = '',
): Promise<{ socket: Socket; welcome: WelcomePayload }> {
  const socket = await connect(server);
  open.push(socket);
  const welcome = next<WelcomePayload>(socket, 'welcome');
  socket.emit('hello', { protocol: 2, name, group });
  return { socket, welcome: await welcome };
}

/**
 * Join, and wait until `watchers` have seen the members update this join
 * causes, so a later `next(…, 'members')` can't catch this one by mistake.
 */
async function joinSettled(
  name: string,
  group: string,
  watchers: Socket[],
): Promise<{ socket: Socket; welcome: WelcomePayload }> {
  const seen = watchers.map((w) => next<MembersPayload>(w, 'members'));
  const joined = await join(name, group);
  await Promise.all(seen);
  return joined;
}

test('welcome lists the members, newest last', async () => {
  const a = await join('Alice', 'friends');
  assert.deepEqual(a.welcome, {
    protocol: 2,
    group: 'friends',
    members: ['Alice'],
  });
  const update = next<MembersPayload>(a.socket, 'members');
  const b = await join('Bob', 'friends');
  assert.deepEqual(b.welcome.members, ['Alice', 'Bob']);
  assert.deepEqual((await update).members, ['Alice', 'Bob']);
});

test('an emote reaches the group with the sender name, not the sender', async () => {
  const a = await join('Alice', 'friends');
  const b = await join('Bob', 'friends');
  const received = next<EmoteOut>(b.socket, 'emote');
  const echo = silent(a.socket, 'emote');
  a.socket.emit('emote', { emoteId: PEPE });
  assert.deepEqual(await received, { emoteId: PEPE, from: 'Alice' });
  assert.equal(await echo, true, 'sender must not get its own emote back');
});

test('groups are separate; codes match case-insensitively', async () => {
  const a = await join('Alice', 'Friends');
  const b = await join('Bob', 'friends ');
  const c = await join('Carol', 'other');
  const toBob = next<EmoteOut>(b.socket, 'emote');
  const toCarol = silent(c.socket, 'emote');
  a.socket.emit('emote', { emoteId: PEPE });
  assert.equal((await toBob).from, 'Alice');
  assert.equal(await toCarol, true, 'another group must not receive it');
});

test('no group code means the shared default group', async () => {
  const a = await join('Alice');
  const b = await join('Bob', '');
  const named = await join('Carol', 'friends');
  const toBob = next<EmoteOut>(b.socket, 'emote');
  const toCarol = silent(named.socket, 'emote');
  a.socket.emit('emote', { emoteId: PEPE });
  assert.equal((await toBob).from, 'Alice');
  assert.equal(await toCarol, true);
});

test('emotes before hello and invalid emote IDs are dropped', async () => {
  const b = await join('Bob');
  const stranger = await connect(server);
  open.push(stranger);
  const nothing = silent(b.socket, 'emote');
  stranger.emit('emote', { emoteId: PEPE });
  const a = await join('Alice');
  a.socket.emit('emote', { emoteId: 'not-an-emote' });
  a.socket.emit('emote', 'garbage');
  a.socket.emit('emote', null);
  assert.equal(await nothing, true);
});

test('leaving updates the members of that group', async () => {
  const a = await join('Alice', 'friends');
  const b = await joinSettled('Bob', 'friends', [a.socket]);
  const update = next<MembersPayload>(a.socket, 'members');
  b.socket.disconnect();
  assert.deepEqual((await update).members, ['Alice']);
});

test('switching groups updates both groups', async () => {
  const a = await join('Alice', 'one');
  const b = await joinSettled('Bob', 'one', [a.socket]);
  const c = await join('Carol', 'two');
  const oneUpdate = next<MembersPayload>(a.socket, 'members');
  const twoUpdate = next<MembersPayload>(c.socket, 'members');
  const welcome = next<WelcomePayload>(b.socket, 'welcome');
  b.socket.emit('hello', { protocol: 2, name: 'Bob', group: 'two' });
  assert.deepEqual((await welcome).members, ['Carol', 'Bob']);
  assert.deepEqual((await oneUpdate).members, ['Alice']);
  assert.deepEqual((await twoUpdate).members, ['Carol', 'Bob']);
});

test('renaming tells the group; a repeated hello alone does not', async () => {
  const a = await join('Alice', 'friends');
  const b = await joinSettled('Bob', 'friends', [a.socket]);
  const rename = next<MembersPayload>(a.socket, 'members');
  b.socket.emit('hello', { protocol: 2, name: 'Robert', group: 'friends' });
  assert.deepEqual((await rename).members, ['Alice', 'Robert']);

  const quiet = silent(a.socket, 'members');
  b.socket.emit('hello', { protocol: 2, name: 'Robert', group: 'friends' });
  assert.equal(await quiet, true);
});

test('an invalid hello is rejected with a reason and joins nothing', async () => {
  const socket = await connect(server);
  open.push(socket);
  const rejected = next<{ reason: string }>(socket, 'rejected');
  socket.emit('hello', { protocol: 1, name: 'Old' });
  assert.match((await rejected).reason, /protocol 2/);

  const b = await join('Bob');
  const nothing = silent(b.socket, 'emote');
  socket.emit('emote', { emoteId: PEPE });
  assert.equal(await nothing, true);
});

test('v1 events are ignored', async () => {
  const b = await join('Bob');
  const old = await connect(server);
  open.push(old);
  const nothing = silent(b.socket, '7tvEmote');
  old.emit('7tvEmote', PEPE);
  old.emit('login', { username: 'x', password: 'y' });
  assert.equal(await nothing, true);
});
