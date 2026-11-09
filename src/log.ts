/** Minimal timestamped logging; `silent` is for tests. */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export const consoleLogger: Logger = {
  info: (message) => console.log(`${new Date().toISOString()} ${message}`),
  warn: (message) =>
    console.warn(`${new Date().toISOString()} WARN ${message}`),
};

export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
};
