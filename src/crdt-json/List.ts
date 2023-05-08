import { CFValue, CFValueHolder } from "./Value";
import { VectorClock } from "./VectorClock";

export class CFList implements CFValue {
  private index: Record<string, CFValueHolder> = {};
  private children: Array<CFValueHolder> = [];

  getValue(): unknown {
    throw new Error(`only registers can hold primitive values`);
  }

  getChild(key: string, timestamp: VectorClock): CFValueHolder {
    if (!this.index[key]) {
      throw new Error(`key '${key}' not defined`);
      // this.index[key] = new CFValueHolder(timestamp, key);
    }
    return this.index[key];
  }

  insertChild(
    prev: string,
    key: string,
    timestamp: VectorClock
  ): CFValueHolder {
    let i = -1; //default if `prev` is not specified
    if (prev) {
      if (!this.index[prev]) {
        throw new ReferenceError(`'${prev}' is not defined`);
      }
      i = this.children.indexOf(this.index[prev]);
    }
    do {
      i++;
    } while (
      i < this.children.length &&
      timestamp.lessThan(this.children[i].created)
    );
    const child = new CFValueHolder(timestamp, key);
    this.index[key] = child;
    this.children.splice(i, 0, child);
    return child;
  }

  getChildren(): Array<CFValueHolder> {
    return this.children.filter((child) => !child.deleted);
  }
}
