import { createHash } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server, type Socket } from 'socket.io';
import type { Config } from './config.ts';
import { Groups } from './groups.ts';
import type { Logger } from './log.ts';
import {
  Event,
  PROTOCOL,
  parseEmote,
  parseHello,
  type EmoteOut,
  type MembersPayload,
  type RejectedPayload,
  type WelcomePayload,
} from './protocol.ts';

// Every payload in the protocol is tiny; anything bigger is not a client.
const MAX_MESSAGE_BYTES = 4 * 1024;

export interface ChatboxServer {
  /** The port actually listened on (useful when the config asked for 0). */
  port: number;
  io: Server;
  close(): Promise<void>;
}

/**
 * Group codes act like a shared password, so logs show a short fingerprint
 * instead of the code itself.
 */
function groupLabel(key: string): string {
  if (key === '') return 'default group';
  return `group #${createHash('sha256').update(key).digest('hex').slice(0, 6)}`;
}

export async function startServer(
  config: Config,
  log: Logger,
): Promise<ChatboxServer> {
  const http: HttpServer = createServer();
  const io = new Server(http, { maxHttpBufferSize: MAX_MESSAGE_BYTES });
  const groups = new Groups();

  function announceMembers(key: string): void {
    const payload: MembersPayload = { members: groups.names(key) };
    io.to(Groups.room(key)).emit(Event.Members, payload);
  }

  function onHello(socket: Socket, payload: unknown): void {
    const parsed = parseHello(payload);
    if (!parsed.ok) {
      const rejected: RejectedPayload = { reason: parsed.reason };
      socket.emit(Event.Rejected, rejected);
      log.info(`reject ${socket.id}: ${parsed.reason}`);
      return;
    }

    const join = parsed.value;
    const before = groups.get(socket.id);
    const { leftKey } = groups.set(socket.id, join);

    if (leftKey !== null) {
      void socket.leave(Groups.room(leftKey));
      announceMembers(leftKey);
    }
    void socket.join(Groups.room(join.key));

    const welcome: WelcomePayload = {
      protocol: PROTOCOL,
      group: join.group,
      members: groups.names(join.key),
    };
    socket.emit(Event.Welcome, welcome);

    // Tell everyone else when the list they see changed: a newcomer,
    // someone switching in, or a rename.
    const changed = !before || leftKey !== null || before.name !== join.name;
    if (changed) {
      const members: MembersPayload = { members: welcome.members };
      socket.to(Groups.room(join.key)).emit(Event.Members, members);
    }
    log.info(`join ${socket.id} "${join.name}" ${groupLabel(join.key)}`);
  }

  function onEmote(socket: Socket, payload: unknown): void {
    const member = groups.get(socket.id);
    if (!member) return; // no hello yet
    const emoteId = parseEmote(payload);
    if (!emoteId) return;

    const out: EmoteOut = { emoteId, from: member.name };
    socket.to(Groups.room(member.key)).emit(Event.Emote, out);
  }

  io.on('connection', (socket) => {
    log.info(`connect ${socket.id}`);

    // A malformed payload must never take the server down.
    const safely =
      (handler: (socket: Socket, payload: unknown) => void) =>
      (payload: unknown): void => {
        try {
          handler(socket, payload);
        } catch (err) {
          log.warn(`handler failed for ${socket.id}: ${String(err)}`);
        }
      };
    socket.on(Event.Hello, safely(onHello));
    socket.on(Event.Emote, safely(onEmote));

    socket.on('disconnect', (reason) => {
      const key = groups.delete(socket.id);
      if (key !== null) announceMembers(key);
      log.info(`disconnect ${socket.id} (${reason})`);
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(config.port, () => {
      http.off('error', reject);
      resolve();
    });
  });

  return {
    port: (http.address() as AddressInfo).port,
    io,
    close: () =>
      new Promise((resolve) => {
        // io.close() also closes the HTTP server.
        void io.close(() => resolve());
      }),
  };
}
