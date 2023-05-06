export type ReplicaId = string;

export enum Causality {
  BEFORE = -1,
  CONCURRENT = 0,
  AFTER = 1,
}

export class VectorClock {
  constructor(private events: Record<ReplicaId, number> = {}) {}

  public toJSON() {
    return this.events;
  }

  public advance(replicaId: ReplicaId) {
    this.events[replicaId]++;
  }

  public get keys(): Array<ReplicaId> {
    return Object.keys(this.events);
  }

  public get(replicaId: ReplicaId) {
    return this.events[replicaId] ?? 0;
  }

  public compare(other: VectorClock): Causality {
    let isBefore = true;
    let isAfter = true;

    const replicas = new Set([...this.keys, ...other.keys]);
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
