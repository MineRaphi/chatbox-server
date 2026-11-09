import { io, type Socket } from 'socket.io-client';
import { DEFAULTS, type Config } from '../src/config.ts';
import { silentLogger } from '../src/log.ts';
import { startServer, type ChatboxServer } from '../src/server.ts';

/** Start a server on a free port. */
export function startTestServer(
  overrides: Partial<Config> = {},
): Promise<ChatboxServer> {
  return startServer({ ...DEFAULTS, port: 0, ...overrides }, silentLogger);
}

/** Connect a real socket.io client and wait until it's connected. */
export async function connect(server: ChatboxServer): Promise<Socket> {
  const socket = io(`http://localhost:${server.port}`, {
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Wait for one event, or fail after `ms`. */
export function next<T = unknown>(
  socket: Socket,
  event: string,
  ms = 1_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no "${event}" within ${ms} ms`)),
      ms,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolve true if `event` does NOT arrive within `ms`. */
export function silent(
  socket: Socket,
  event: string,
  ms = 200,
): Promise<boolean> {
  return new Promise((resolve) => {
    const onEvent = (): void => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve(true);
    }, ms);
    socket.once(event, onEvent);
  });
}
