# chatbox-server v2. Node runs the TypeScript sources directly, so the
# image needs no build step and no TypeScript compiler.
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# The official image ships an unprivileged `node` user.
USER node

ENV PORT=3847
EXPOSE 3847

# The server has no HTTP routes of its own; socket.io's polling handshake
# answers 200 when the server is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/socket.io/?EIO=4&transport=polling').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Exec form: node is PID 1 and gets SIGTERM from `docker stop` directly;
# src/index.ts shuts down cleanly on it.
CMD ["node", "src/index.ts"]
