export type ReplicaId = string;
export type ActionId = string;

export enum Causality {
  BEFORE = -1,
  CONCURRENT = 0,
  AFTER = 1,
}

function parseActionId(s: string): [ReplicaId, number] {
  const i = s.indexOf(":");
  const replicaId = s.slice(0, i);
  const eventId = Number(s.slice(i + 1));
  return [replicaId, eventId];
}

export class VectorClock {
  constructor(
    private owner: ReplicaId,
    private lastDelivered: Record<ReplicaId, number> = {}
  ) {}

  public static fromString(s: string): VectorClock {
    const obj = JSON.parse(s);
    Object.setPrototypeOf(obj, VectorClock.prototype);
    return obj;
  }

  public toActionId(): ActionId {
    return `${this.owner}:${this.lastDelivered[this.owner]}`;
  }

  public dependsOn(actionId: ActionId) {
    const [replicaId, eventId] = parseActionId(actionId);
    return eventId <= this.lastDelivered[replicaId];
  }

  public advance(): void {
    this.lastDelivered[this.owner]++;
  }

  public get(replicaId: ReplicaId): number {
    return this.lastDelivered[replicaId] ?? 0;
  }

  public get receivedFrom(): Array<ReplicaId> {
    return Object.keys(this.lastDelivered);
  }

  public compare(other: VectorClock): Causality {
    let isBefore = true;
    let isAfter = true;

    const replicas = new Set([...this.receivedFrom, ...other.receivedFrom]);

    for (const id of replicas) {
      const received1 = this.get(id);
      const received2 = other.get(id);
      if (received1 < received2) isAfter = false;
      if (received1 > received2) isBefore = false;
    }

    if (isBefore && isAfter)
      throw new Error(`No two events can have the same vector clock!`);

    return isBefore
      ? Causality.BEFORE
      : isAfter
      ? Causality.AFTER
      : Causality.CONCURRENT;
  }
}
