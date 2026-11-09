import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { RateLimiter } from '../src/rate-limit.ts';
import type { ChatboxServer } from '../src/server.ts';
import { connect, next, startTestServer } from './helpers.ts';

const PEPE = '01GAFTZ9K80003DHH026MC7JW0';

test('limiter: allows the limit, then blocks until the window slides', () => {
  let now = 0;
  const limiter = new RateLimiter(3, 10_000, () => now);
  for (const t of [0, 1_000, 2_000]) {
    now = t;
    assert.deepEqual(limiter.take(), { ok: true });
  }
  now = 4_000; // oldest event (t=0) leaves the window at 10 s
  assert.deepEqual(limiter.take(), { ok: false, retryInMs: 6_000 });

  now = 10_000; // t=0 has left; t=1 s and t=2 s are still in
  assert.deepEqual(limiter.take(), { ok: true });
  assert.deepEqual(limiter.take(), { ok: false, retryInMs: 1_000 });
});

test('limiter: 0 means unlimited', () => {
  const limiter = new RateLimiter(0, 10_000);
  for (let i = 0; i < 1_000; i++) assert.equal(limiter.take().ok, true);
});

const servers: ChatboxServer[] = [];
after(() => Promise.all(servers.map((s) => s.close())));

async function pair(rateLimit: number) {
  const server = await startTestServer({ rateLimit });
  servers.push(server);
  const sender = await connect(server);
  const receiver = await connect(server);
  for (const [socket, name] of [
    [sender, 'Spammer'],
    [receiver, 'Bob'],
  ] as const) {
    const welcome = next(socket, 'welcome');
    socket.emit('hello', { protocol: 2, name, group: 'g' });
    await welcome;
  }
  // Bob's join sends Spammer a members update; let it arrive first.
  await new Promise((r) => setTimeout(r, 50));
  return { sender, receiver };
}

/** Count emotes arriving at `socket` for `ms`. */
function countEmotes(
  socket: ReturnType<typeof connect> extends Promise<infer S> ? S : never,
  ms: number,
) {
  let count = 0;
  const onEmote = (): void => {
    count++;
  };
  socket.on('emote', onEmote);
  return new Promise<number>((resolve) =>
    setTimeout(() => {
      socket.off('emote', onEmote);
      resolve(count);
    }, ms),
  );
}

test('over the limit, emotes are dropped and the sender is told', async () => {
  const { sender, receiver } = await pair(3);
  const received = countEmotes(receiver, 300);
  const limited = next<{ retryInMs: number }>(sender, 'limited');
  for (let i = 0; i < 5; i++) sender.emit('emote', { emoteId: PEPE });

  const { retryInMs } = await limited;
  assert.ok(retryInMs > 0 && retryInMs <= 10_000, `retryInMs=${retryInMs}`);
  assert.equal(await received, 3);
  sender.disconnect();
  receiver.disconnect();
});

test('RATE_LIMIT=0 lets everything through', async () => {
  const { sender, receiver } = await pair(0);
  const received = countEmotes(receiver, 400);
  for (let i = 0; i < 100; i++) sender.emit('emote', { emoteId: PEPE });
  assert.equal(await received, 100);
  sender.disconnect();
  receiver.disconnect();
});
