import { PassThrough, Writable } from "stream";
import { v4 as uuid } from "uuid";
import { Cursor, Mutation, Operation } from "./Operation";
import { VectorClock } from "./VectorClock";
import axios from "axios";

type ReplicaId = string;

class Replica {
  constructor(public id: ReplicaId, private stream: Writable) {
    stream.write(`event:connect\ndata:${id}\n\n`);
  }
  public send(op: Operation) {
    this.stream.write(`event:operation\ndata:${JSON.stringify(op)}\n\n`);
  }
}

export class BroadcastServer {
  private replicas: Array<Replica> = [];
  private history: Array<Operation> = [];

  public join(stream: Writable) {
    const replicaId = uuid();
    const replica = new Replica(replicaId, stream);
    this.replicas.push(replica);
    for (const op of this.history) {
      replica.send(op);
    }
  }

  public publish(op: Operation) {
    this.history.push(op);
    for (const replica of this.replicas) {
      if (replica.id != op.replicaId) {
        replica.send(op);
      }
    }
  }
}

export class BroadcastClient {
  private eventSource = new EventSource("/broadcast");
  private replicaId: ReplicaId = "";
  private clock = new VectorClock();
  private pending = new Set<Operation>();
  private subscribers = new Set<(op: Operation) => void>();

  constructor() {
    this.eventSource.addEventListener("connect", (e) => {
      this.replicaId = e.data;
    });
    this.eventSource.addEventListener("operation", (e) => {
      const json = JSON.parse(e.data);
      const op: Operation = {
        ...json,
        timestamp: new VectorClock(json.timestamp),
      };
      this.receive(op);
    });
  }

  public recv(cb: (op: Operation) => void) {
    this.subscribers.add(cb);
  }

  public send(cursor: Cursor, mutation: Mutation) {
    this.clock.advance(this.replicaId);
    const op: Operation = {
      replicaId: this.replicaId,
      timestamp: this.clock,
      cursor: cursor,
      mutation: mutation,
    };
    axios.post("/event", op);
  }

  private receive(op: Operation) {
    this.pending.add(op);
    while (this.deliverNext());
  }

  private deliver(op: Operation) {
    for (const f of this.subscribers) {
      f(op);
    }
  }

  private deliverNext(): boolean {
    for (const op of this.pending) {
      if (this.canDeliver(op)) {
        this.deliver(op);
        return true;
      }
    }
    return false;
  }

  private canDeliver(op: Operation) {
    if (op.timestamp.get(op.replicaId) != this.clock.get(op.replicaId) + 1)
      return false;
    for (const replicaId of Object.keys(op.timestamp)) {
      if (
        replicaId != op.replicaId &&
        op.timestamp.get(replicaId) > this.clock.get(replicaId)
      )
        return false;
    }
    return true;
  }
}
