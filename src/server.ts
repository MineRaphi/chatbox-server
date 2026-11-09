import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import type { Config } from './config.ts';
import type { Logger } from './log.ts';

// Every payload in the protocol is tiny; anything bigger is not a client.
const MAX_MESSAGE_BYTES = 4 * 1024;

export interface ChatboxServer {
  /** The port actually listened on (useful when the config asked for 0). */
  port: number;
  io: Server;
  close(): Promise<void>;
}

export async function startServer(
  config: Config,
  log: Logger,
): Promise<ChatboxServer> {
  const http: HttpServer = createServer();
  const io = new Server(http, { maxHttpBufferSize: MAX_MESSAGE_BYTES });

  io.on('connection', (socket) => {
    log.info(`connect ${socket.id}`);
    socket.on('disconnect', (reason) => {
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
