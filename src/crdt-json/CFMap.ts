import { CFValue, CFValueHolder } from "./Value";
import { VectorClock } from "./VectorClock";

export class CFMap implements CFValue {
  private children: Record<string, CFValueHolder> = {};

  getValue(): unknown {
    throw new Error(`only registers can hold primitive values`);
  }

  getChild(key: string, timestamp: VectorClock): CFValueHolder {
    if (!this.children[key]) {
      this.children[key] = new CFValueHolder(timestamp, key);
    }
    return this.children[key];
  }

  insertChild(prev: string): CFValueHolder {
    throw new Error(`map doesn't support 'insert' operation`);
  }

  getChildren(): Array<CFValueHolder> {
    return Object.values(this.children).filter((child) => !child.deleted);
  }
}
