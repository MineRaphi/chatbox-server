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

### As a service on Ubuntu

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
