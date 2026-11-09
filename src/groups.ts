import type { Join } from './protocol.ts';

interface Member {
  name: string;
  group: string;
  key: string;
}

/** Who is in which group. In memory only; nothing survives a restart. */
export class Groups {
  readonly #members = new Map<string, Member>();

  /** Socket.io room for a group key; the default group's key is ''. */
  static room(key: string): string {
    return `group:${key}`;
  }

  get(socketId: string): Member | undefined {
    return this.#members.get(socketId);
  }

  /** Join or move a socket; returns the group it left, if it changed groups. */
  set(socketId: string, join: Join): { leftKey: string | null } {
    const previous = this.#members.get(socketId);
    const leftKey = previous && previous.key !== join.key ? previous.key : null;
    // Member lists are in join order; someone moving groups joins the new
    // one last. (Map.set on an existing key would keep the old position.)
    if (leftKey !== null) this.#members.delete(socketId);
    this.#members.set(socketId, { ...join });
    return { leftKey };
  }

  /** Remove a socket; returns the key of the group it was in. */
  delete(socketId: string): string | null {
    const member = this.#members.get(socketId);
    this.#members.delete(socketId);
    return member ? member.key : null;
  }

  /** Display names in a group, in the order people joined. */
  names(key: string): string[] {
    const names: string[] = [];
    for (const member of this.#members.values()) {
      if (member.key === key) names.push(member.name);
    }
    return names;
  }

  /** Number of distinct groups with at least one member. */
  get groupCount(): number {
    return new Set([...this.#members.values()].map((m) => m.key)).size;
  }
}
