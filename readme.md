# chatbox-server

Relays 7TV emotes between [Chatbox](https://github.com/MineRaphi/chatbox) clients in the same group, with the sender's name.

There are no accounts and nothing is stored: a client joins a group with a display name and a group code, and emotes go to everyone else in that group. Clients without a group code share one default group.

## Running it

Requires [Node.js](https://nodejs.org) 22.18 or newer. Node runs the TypeScript sources directly, so there's no build step.

```bash
npm install --omit=dev
npm start
```

| Environment variable | Default | Meaning                                                |
| -------------------- | ------- | ------------------------------------------------------ |
| `PORT`               | `3847`  | Port to listen on                                      |
| `RATE_LIMIT`         | `30`    | Emotes per 10 seconds per connection; `0` turns it off |

```bash
PORT=3848 RATE_LIMIT=0 npm start
```

Clients connect to `<this machine's address>:<port>`. Open the port in the firewall, e.g. `sudo ufw allow 3847/tcp` on Ubuntu.

### With Docker (recommended)

The repo has a `Dockerfile` and a `compose.yaml`. On the server machine, with Docker and its Compose plugin installed:

```bash
git clone https://github.com/MineRaphi/chatbox-server.git
cd chatbox-server
docker compose up -d --build
```

That builds the image, starts the server on port 3847, and restarts it after crashes and reboots. Change the port or rate limit in `compose.yaml`.

```bash
docker compose logs -f              # follow the log
docker compose ps                   # status, including the health check
git pull && docker compose up -d --build    # update to the latest version
docker compose down                 # stop it
```

Without Compose:

```bash
docker build --network=host -t chatbox-server:2 .
docker run -d --name chatbox-server --restart unless-stopped \
  -p 3847:3847 -e RATE_LIMIT=30 --read-only chatbox-server:2
```

The build uses the host's network (`network: host` in `compose.yaml`, `--network=host` above). On some machines, for example Ubuntu with systemd-resolved and Tailscale, the build containers otherwise can't resolve `registry.npmjs.org`, and `npm ci` fails with `EAI_AGAIN`, even though normal containers resolve it fine. The running server doesn't use the host network.

The image is about 64 MB: Node 24 on Alpine, running as an unprivileged user, with only `src/` and the runtime dependencies inside. The container's filesystem can be read-only because the server stores nothing.

### As a service on Ubuntu (without Docker)

To start it on boot and restart it if it crashes, create `/etc/systemd/system/chatbox-server.service`:

```ini
[Unit]
Description=Chatbox server
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/chatbox-server
ExecStart=/usr/bin/node src/index.ts
Environment=PORT=3847
Restart=on-failure
# A user without login rights, e.g. created with: sudo useradd --system chatbox
User=chatbox

[Install]
WantedBy=multi-user.target
```

Adjust `WorkingDirectory` to where the repo is, and `ExecStart` to `which node`. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chatbox-server
journalctl -u chatbox-server -f    # follow the log
```

The log shows connects, joins and disconnects with display names. Group codes are never logged; each group shows as a short fingerprint like `group #3fa1c2`.

## The old server (v1)

The v1 server (accounts, chat, no groups) is archived at tag `v1` and branch `archive/v1`. It only works with the v1 app (tag `v1` in the Chatbox repo), not with v2 clients, and the two don't see each other's emotes.

To run it next to v2 on the same machine, check it out into its own folder. Its port is hard-coded to 3847, so v2 has to move:

```bash
git worktree add ../chatbox-server-v1 v1
cd ../chatbox-server-v1
npm install
echo '{"users":[]}' > users.json    # v1 needs this file to exist
node main.js                        # v1 on port 3847
```

and start v2 with `PORT=3848`, pointing v2 clients at that port.

## Protocol 2

| Event      | Direction                  | Payload                           |
| ---------- | -------------------------- | --------------------------------- |
| `hello`    | client → server            | `{ protocol: 2, name, group }`    |
| `welcome`  | server → client            | `{ protocol: 2, group, members }` |
| `rejected` | server → client            | `{ reason }`                      |
| `emote`    | client → server            | `{ emoteId }`                     |
| `emote`    | server → rest of the group | `{ emoteId, from }`               |
| `members`  | server → group             | `{ members }`                     |
| `limited`  | server → sender            | `{ retryInMs }`                   |

- Send `hello` after every connect, and again to rename or change group. Emotes before a `welcome` are ignored.
- Names: control and bidi characters removed, at most 32 characters, empty becomes `Anonymous`.
- Group codes: trimmed, case-insensitive, at most 64 characters, empty means the default group.
- `emoteId` must be a 7TV ULID (26 characters, `0-9A-Z`). Anything else is dropped.
- Messages over 4 KB close the connection.

The client keeps its own copy of these definitions; `src/protocol.ts` is the server's. Change both together.

## Development

```bash
npm install
npm run dev        # restarts on file changes
npm test           # integration tests with real socket.io clients
npm run check      # tsc --noEmit, oxlint, oxfmt
npm run lint:fix
```

```
src/
  index.ts       startup and shutdown
  config.ts      environment variables
  server.ts      socket.io wiring
  protocol.ts    event names, payload types, validation
  groups.ts      group membership (in memory)
  rate-limit.ts  per-connection sliding window
  log.ts
test/            node:test tests
```

## License and disclaimer

Copyright (c) 2025-2026 MineRaphi

chatbox-server is free software, licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). It's the GPL with one addition: if you run a changed version as a server that others connect to, you must offer them its source code too. You may use, change and share it, as long as you pass on the full source code, including your changes, under the same license. The copyright notice must stay, and changes must be marked.

This software is provided "as is", without warranty of any kind. Use it at your own risk; the author is not liable for any damage or loss resulting from its use, including running it on a public server.
