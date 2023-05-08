export type ReplicaId = string;

export class VectorClock {
  constructor(
    public senderId: ReplicaId,
    private eventsDelivered: Record<ReplicaId, number> = {}
  ) {}

  static from(obj: unknown): VectorClock {
    Object.setPrototypeOf(obj, VectorClock.prototype);
    return obj as VectorClock;
  }

  public get(replicaId: ReplicaId) {
    return this.eventsDelivered[replicaId] ?? 0;
  }

  private clone(): VectorClock {
    return new VectorClock(this.senderId, { ...this.eventsDelivered });
  }

  public tick(): VectorClock {
    const res = this.clone();
    res.eventsDelivered[this.senderId] = this.get(this.senderId) + 1;
    return res;
  }

  public update(other: VectorClock): VectorClock {
    const res = this.clone();
    for (const [id, n] of Object.entries(other.eventsDelivered)) {
      res.eventsDelivered[id] = Math.max(res.eventsDelivered[id] ?? 0, n);
    }
    return res;
  }

  public happensBefore(other: VectorClock): boolean {
    return (
      this.eventsDelivered[this.senderId] <=
      other.eventsDelivered[this.senderId]
    );
  }

  public isConcurrentWith(other: VectorClock): boolean {
    return !this.happensBefore(other) && !other.happensBefore(this);
  }

  public lessThan(other: VectorClock): boolean {
    return (
      this.happensBefore(other) ||
      (this.isConcurrentWith(other) && this.senderId < other.senderId)
    );
  }
}
