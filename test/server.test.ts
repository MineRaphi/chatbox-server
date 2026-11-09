import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { ChatboxServer } from '../src/server.ts';
import { connect, startTestServer } from './helpers.ts';

let server: ChatboxServer;
before(async () => {
  server = await startTestServer();
});
after(() => server.close());

test('accepts a socket.io connection', async () => {
  const socket = await connect(server);
  assert.equal(socket.connected, true);
  socket.disconnect();
});
