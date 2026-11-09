import { loadConfig } from './config.ts';
import { consoleLogger as log } from './log.ts';
import { startServer } from './server.ts';

let config;
try {
  config = loadConfig();
} catch (err) {
  log.warn(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const server = await startServer(config, log);
log.info(
  `chatbox-server v2 listening on port ${server.port}` +
    (config.rateLimit
      ? `, rate limit ${config.rateLimit} emotes per ${config.rateWindowMs / 1000} s`
      : ', rate limit off'),
);

async function shutdown(signal: string): Promise<void> {
  log.info(`${signal}: shutting down`);
  await server.close();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
