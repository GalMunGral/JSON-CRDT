import { v4 as uuid } from "uuid";
import { CFMap } from "./CFMap";
import { Atomic, Cursor } from "./JSON";
import { CFList } from "./List";
import { CFRegister } from "./Register";
import { VectorClock } from "./VectorClock";

export interface CFValue {
  getValue(): unknown;
  getChildren(): Array<CFValueHolder>;
  getChild(key: string, timestamp: VectorClock): CFValueHolder;
  insertChild(prev: string, key: string, timestamp: VectorClock): CFValueHolder;
}

export class CFValueHolder {
  public created: VectorClock;
  public lastUpdated: VectorClock;
  protected updatedBy = new Set<VectorClock>();

  public constructor(
    timestamp: VectorClock,
    public key: string,
    public content?: CFValue
  ) {
    this.created = timestamp;
    this.lastUpdated = timestamp;
    this.updatedBy.add(timestamp);
  }

  private setValue(atom: Atomic) {
    switch (atom.type) {
      case "list":
        if (this.content) {
          if (!(this.content instanceof CFList)) {
            throw new Error(`illegal: changing value type is not allowed`);
          }
        } else {
          this.content = new CFList();
        }
        break;
      case "map":
        if (this.content) {
          if (!(this.content instanceof CFMap)) {
            throw new Error(`illegal: changing value type is not allowed`);
          }
        } else {
          this.content = new CFMap();
        }
        break;
      case "register":
        if (this.content) {
          if (!(this.content instanceof CFRegister)) {
            throw new Error(`illegal: changing value type is not allowed`);
          }
          this.content.setValue(atom.value);
        } else {
          this.content = new CFRegister(atom.value);
        }
        break;
    }
  }

  public get deleted() {
    return this.updatedBy.size == 0;
  }

  public get(cursor: Cursor, timestamp: VectorClock): unknown {
    if (cursor.length == 0) {
      return this.content!.getValue();
    } else {
      const [key, ...nextCursor] = cursor;
      return this.content!.getChild(key, timestamp).get(nextCursor, timestamp);
    }
  }

  private update(timestamp: VectorClock) {
    this.updatedBy.add(timestamp);
    this.lastUpdated = timestamp;
  }

  public assign(cursor: Cursor, value: Atomic, timestamp: VectorClock): void {
    if (cursor.length == 0) {
      this.updatedBy.clear();
      this.setValue(value);
    } else {
      const [key, ...nextCursor] = cursor;
      this.content!.getChild(key, timestamp).assign(
        nextCursor,
        value,
        timestamp
      );
    }
    this.update(timestamp);
  }

  public insert(
    cursor: Cursor,
    newKey: string,
    value: Atomic,
    timestamp: VectorClock
  ): void {
    if (cursor.length == 0) {
      throw new Error(`a value can only be inserted in its parent context`);
    } else if (cursor.length == 1) {
      this.content!.insertChild(cursor[0], newKey, timestamp).assign(
        [],
        value,
        timestamp
      );
    } else {
      const [key, ...nextCursor] = cursor;
      this.content!.getChild(key, timestamp).insert(
        nextCursor,
        newKey,
        value,
        timestamp
      );
    }
    this.update(timestamp);
  }

  private clear(until: VectorClock): void {
    for (const timestamp of this.updatedBy) {
      if (timestamp.happensBefore(until)) {
        this.updatedBy.delete(timestamp);
      }
    }
    for (const child of this.content!.getChildren()) {
      child.clear(until);
    }
  }

  public delete(cursor: Cursor, timestamp: VectorClock): void {
    if (cursor.length == 0) {
      this.clear(timestamp);
    } else {
      const [key, ...nextCursor] = cursor;
      this.content!.getChild(key, timestamp).delete(nextCursor, timestamp);
    }
  }
}
