// Protocol 2. The client keeps its own copy of these names and shapes; the
// two repos share no code, so change both together.

export const PROTOCOL = 2;

export const Event = {
  /** client → server: join a group (again on reconnect, rename, regroup). */
  Hello: 'hello',
  /** server → client: joined; carries the member list. */
  Welcome: 'welcome',
  /** server → client: the last `hello` was invalid. */
  Rejected: 'rejected',
  /** both ways: client sends `{ emoteId }`, server relays `{ emoteId, from }`. */
  Emote: 'emote',
  /** server → group: the member list changed. */
  Members: 'members',
  /** server → sender: over the rate limit. */
  Limited: 'limited',
} as const;

export const NAME_MAX = 32;
export const GROUP_MAX = 64;
export const DEFAULT_NAME = 'Anonymous';

export interface HelloPayload {
  protocol: number;
  name: string;
  group: string;
}
export interface WelcomePayload {
  protocol: number;
  group: string;
  members: string[];
}
export interface RejectedPayload {
  reason: string;
}
export interface EmoteIn {
  emoteId: string;
}
export interface EmoteOut {
  emoteId: string;
  from: string;
}
export interface MembersPayload {
  members: string[];
}
export interface LimitedPayload {
  retryInMs: number;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface Join {
  name: string;
  /** The group code as typed (trimmed), shown back to the client. */
  group: string;
  /** Case-insensitive key that decides who is in the same group. */
  key: string;
}

// 7TV emote IDs are ULIDs: 26 characters of uppercase base32.
const EMOTE_ID = /^[0-9A-Z]{26}$/;
// Control and format characters (including bidi overrides) never belong in a name.
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Clean a display name: no invisible characters, single spaces, trimmed. */
export function cleanName(raw: string): string {
  return raw.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

export function parseHello(payload: unknown): Parsed<Join> {
  if (!isRecord(payload)) return { ok: false, reason: 'Invalid hello.' };
  if (payload.protocol !== PROTOCOL) {
    return {
      ok: false,
      reason: `This server speaks protocol ${PROTOCOL}; update Chatbox.`,
    };
  }

  const rawName = typeof payload.name === 'string' ? payload.name : '';
  const name = cleanName(rawName) || DEFAULT_NAME;
  if ([...name].length > NAME_MAX) {
    return {
      ok: false,
      reason: `Names can be at most ${NAME_MAX} characters.`,
    };
  }

  if (payload.group !== undefined && typeof payload.group !== 'string') {
    return { ok: false, reason: 'Invalid group code.' };
  }
  const group = cleanName(payload.group ?? '');
  if ([...group].length > GROUP_MAX) {
    return {
      ok: false,
      reason: `Group codes can be at most ${GROUP_MAX} characters.`,
    };
  }

  return { ok: true, value: { name, group, key: group.toLowerCase() } };
}

export function parseEmote(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const { emoteId } = payload;
  return typeof emoteId === 'string' && EMOTE_ID.test(emoteId) ? emoteId : null;
}
