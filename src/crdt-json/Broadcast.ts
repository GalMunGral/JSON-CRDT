import { Writable } from "stream";
import { v4 as uuid } from "uuid";
import { VectorClock } from "./VectorClock";
import axios from "axios";
import { IssuedOperation, Operation } from "./JSON";
import { CFValueHolder } from "./Value";
import { CFMap } from "./CFMap";

type ReplicaId = string;

class Replica {
  constructor(public id: ReplicaId, private stream: Writable) {}
  public send(op: Operation) {
    this.stream.write(`event:operation\ndata:${JSON.stringify(op)}\n\n`);
  }
}

export class BroadcastServer {
  private replicas: Array<Replica> = [];
  private history: Array<IssuedOperation> = [];

  public join(replicaId: string, stream: Writable) {
    const replica = new Replica(replicaId, stream);
    this.replicas.push(replica);
    for (const op of this.history) {
      if (replica.id != op.timestamp.senderId) {
        replica.send(op);
      }
    }
  }

  public publish(op: IssuedOperation) {
    this.history.push(op);
    for (const replica of this.replicas) {
      if (replica.id != op.timestamp.senderId) {
        replica.send(op);
      }
    }
  }
}

export class BroadcastClient {
  private replicaId: ReplicaId = uuid();
  private clock = new VectorClock(this.replicaId);
  private eventSource = new EventSource(
    `/broadcast?replicaId=${this.replicaId}`
  );
  private pending = new Set<IssuedOperation>();
  private root = new CFValueHolder(this.clock, "", new CFMap());
  private subscribers: Array<(state: CFValueHolder) => void> = [];
  // debugging-only
  public connected = true;

  constructor() {
    this.eventSource.addEventListener("operation", (e) => {
      const json = JSON.parse(e.data);
      const op: IssuedOperation = {
        ...json,
        timestamp: VectorClock.from(json.timestamp),
      };
      this.recv(op);
    });
  }

  private tryBroadcast(op: IssuedOperation) {
    if (this.connected) {
      axios.post("/event", op);
    } else {
      // debugging-only
      setTimeout(() => {
        this.tryBroadcast(op);
      }, 2000);
    }
  }

  public send(op: Operation) {
    this.clock = this.clock.tick();
    const issued: IssuedOperation = {
      ...op,
      timestamp: this.clock,
    };
    this.deliver(issued);
    this.tryBroadcast(issued);
  }

  private recv(op: IssuedOperation) {
    this.pending.add(op);
    while (this.tryDeliver());
  }

  private tryDeliver(): boolean {
    let success = false;
    for (const op of this.pending) {
      if (this.canDeliver(op)) {
        this.deliver(op);
        this.pending.delete(op);
        success = true;
      }
    }
    return success;
  }

  private deliver(op: IssuedOperation) {
    this.clock = this.clock.update(op.timestamp);
    switch (op.type) {
      case "assign":
        this.root.assign(op.cursor, op.value, op.timestamp);
        break;
      case "insert":
        this.root.insert(op.cursor, op.key, op.value, op.timestamp);
        break;
      case "delete":
        this.root.delete(op.cursor, op.timestamp);
        break;
    }
    this.subscribers.forEach((f) => f(this.root));
  }

  private canDeliver(op: IssuedOperation) {
    const others = Object.keys(op.timestamp).filter(
      (replicaId) => replicaId != op.timestamp.senderId
    );
    return (
      op.timestamp.get(op.timestamp.senderId) ==
        this.clock.get(op.timestamp.senderId) + 1 &&
      others.every(
        (replicaId) => op.timestamp.get(replicaId) <= this.clock.get(replicaId)
      )
    );
  }

  public subscribe(f: (state: CFValueHolder) => void) {
    this.subscribers.push(f);
    f(this.root);
  }
}
