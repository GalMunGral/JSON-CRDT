import { BroadcastClient } from "./CausalBroadcast";
import { ActionId, Causality, ReplicaId, VectorClock } from "./VectorClock";
import { v4 as uuid } from "uuid";

type ChildType = keyof CFValue["union"];
type ListItemId = string;

export type PathKey = {
  type: ChildType;
  id: ListItemId;
};

export type Cursor = Array<PathKey>;

export type Mutation =
  | {
      type: "assign";
      value: any;
    }
  | {
      type: "insert";
      value: any;
    }
  | {
      type: "delete";
    };

export type Operation = {
  replicaId: ReplicaId;
  timestamp: VectorClock;
  cursor: Cursor;
  mutation: Mutation;
};

type CFListItem<ValueT = any> = {
  __virtual__: true;
  id: string;
  value: ValueT;
};

abstract class Context {
  protected presence = new Set<ActionId>();
  public get exists() {
    return this.presence.size != 0;
  }
  public access(now: VectorClock): void {
    this.presence.add(now.toActionId());
  }
  public abstract clear(now: VectorClock): Set<ActionId>;
}

abstract class Collection extends Context {
  public abstract assign(cursor: Cursor, now: VectorClock, value: any): void;
  public abstract insert(cursor: Cursor, now: VectorClock, value: any): void;
  public abstract delete(cursor: Cursor, now: VectorClock): void;
}

class CFMap extends Collection {
  private children: Record<string, CFValue> = {};

  public toJSON() {
    return this.children;
  }

  public recursiveAssign(key: string, value: any, now: VectorClock) {
    this.access(now);
    if (!this.children[key]) {
      this.children[key] = new CFValue(now);
    }
    this.children[key].recursiveAssign(value, now);
  }

  public override assign(cursor: Cursor, now: VectorClock, value: any): void {
    this.access(now);
    const key = cursor.shift()!;
    if (!cursor.length) {
      this.children[key.id].clearAndAssign(value, now);
    } else {
      this.children[key.id].union[key.type].assign(cursor, now, value);
    }
  }

  public override insert(cursor: Cursor, now: VectorClock, value: any) {
    this.access(now);
    const key = cursor.shift()!;
    if (!cursor.length) {
      throw new Error(
        `Map doesn't support 'insert'. Maybe you meant 'assign'?`
      );
    } else {
      const child = this.children[key.id].union[key.type] as Collection;
      child.insert(cursor, now, value);
    }
  }

  public override delete(cursor: Cursor, now: VectorClock) {
    const key = cursor.shift()!;
    if (!cursor.length) {
      this.children[key.id].clear(now);
    } else {
      const child = this.children[key.id].union[key.type] as Collection;
      child.delete(cursor, now);
    }
  }

  public override clear(now: VectorClock) {
    for (const actionsId of this.presence) {
      if (now.dependsOn(actionsId)) {
        this.presence.delete(actionsId);
      }
    }
    for (const value of Object.values(this.children)) {
      for (const actionId of value.clear(now)) {
        this.presence.add(actionId);
      }
    }
    return this.presence;
  }
}

class CFList extends Collection {
  private childMap: Record<ListItemId, CFValue> = {};
  private children: Array<CFValue> = [];

  public toJSON() {
    return this.children.filter(
      (item) =>
        item.union.map.exists || item.union.list.exists || item.union.reg.exists
    );
  }

  private push(child: CFValue) {
    this.childMap[child.id] = child;
    this.children.push(child);
  }

  private insertAt(i: number, child: CFValue) {
    this.childMap[child.id] = child;
    this.children.splice(i, 0, child);
  }

  public recursiveAssign(item: CFListItem, now: VectorClock) {
    this.access(now);
    if (!this.childMap[item.id]) {
      this.push(new CFValue(now));
    }
    this.childMap[item.id].recursiveAssign(item.value, now);
  }

  public override assign(cursor: Cursor, now: VectorClock, value: any): void {
    this.access(now);
    const key = cursor.shift()!;
    if (!cursor.length) {
      this.childMap[key.id].clearAndAssign(value, now);
    } else {
      this.childMap[key.id].union[key.type].assign(cursor, now, value);
    }
  }

  public override insert(cursor: Cursor, now: VectorClock, value: CFListItem) {
    this.access(now);
    const key = cursor.shift()!;
    const prev = this.childMap[key.id];
    let i = this.children.indexOf(prev);
    if (!cursor.length) {
      do {
        i++;
      } while (
        i < this.children.length &&
        this.children[i].createdAfter(now, value.id)
      );
      const newValue = new CFValue(now);
      newValue.recursiveAssign(value, now);
      this.insertAt(i, newValue);
    } else {
      const child = this.children[i].union[key.type] as Collection;
      child.insert(cursor, now, value);
    }
  }

  public override delete(cursor: Cursor, now: VectorClock) {
    const key = cursor.shift()!;
    if (!cursor.length) {
      this.childMap[key.id].clear(now);
    } else {
      const child = this.childMap[key.id].union[key.type] as Collection;
      child.delete(cursor, now);
    }
  }

  public override clear(now: VectorClock) {
    if (this.exists) {
      for (const actionsId of this.presence) {
        if (now.dependsOn(actionsId)) {
          this.presence.delete(actionsId);
        }
      }
      for (const value of this.children) {
        const presence = value.clear(now);
        for (const actionId of presence) {
          this.presence.add(actionId);
        }
      }
    }
    return this.presence;
  }
}

class CFReg extends Context {
  private values: Record<ActionId, any> = {};

  public get value() {
    return this.values;
  }

  public assign(value: any, now: VectorClock) {
    this.clear(now);
    this.access(now);
    this.values[now.toActionId()] = value;
  }

  public clear(now: VectorClock) {
    for (const actionId in this.values) {
      if (now.dependsOn(actionId)) {
        delete this.values[actionId];
      }
    }
    this.presence = new Set(Object.keys(this.values));
    return this.presence;
  }
}

class CFValue {
  public union = {
    reg: new CFReg(),
    list: new CFList(),
    map: new CFMap(),
  };
  public constructor(public createdAt: VectorClock, public id = "") {}

  public toJSON() {
    return this.union.map.exists
      ? this.union.map
      : this.union.list.exists
      ? this.union.list
      : this.union.reg;
  }

  public clear(now: VectorClock) {
    return new Set([
      ...this.union.reg.clear(now),
      ...this.union.list.clear(now),
      ...this.union.map.clear(now),
    ]);
  }

  public recursiveAssign(value: any, now: VectorClock) {
    if (typeof value == "object" && value != null) {
      for (const key of Object.keys(value)) {
        this.union.map.recursiveAssign(key, value, now);
      }
    } else if (Array.isArray(value)) {
      for (const item of value as Array<CFListItem>) {
        if (!item.__virtual__) {
          throw new Error("The object is malformatted!");
        }
        this.union.list.recursiveAssign(item, now);
      }
    }
  }

  public clearAndAssign(value: any, now: VectorClock) {
    this.clear(now);
    this.recursiveAssign(value, now);
  }

  public createdAfter(timestamp: VectorClock, itemId: string) {
    const rel = this.createdAt.compare(timestamp);
    return (
      rel == Causality.AFTER ||
      (rel == Causality.CONCURRENT && this.id > itemId)
    );
  }
}

export class JsonContext {
  private root = new CFMap();

  constructor(init: any, private client: BroadcastClient) {
    client.recv((op) => {
      this.dispatch(op);
      console.log(JSON.stringify(this.root));
    });

    client.send([{ type: "map", id: "doc" }], {
      type: "assign",
      value: assignListItemIds(init),
    });
  }

  public dispatch(op: Operation) {
    switch (op.mutation.type) {
      case "assign":
        this.root.assign(op.cursor, op.timestamp, op.mutation.value);
        break;
      case "insert":
        this.root.insert(op.cursor, op.timestamp, op.mutation.value);
        break;
      case "delete":
        this.root.delete(op.cursor, op.timestamp);
        break;
    }
  }
}

function assignListItemIds(json: any) {
  if (Array.isArray(json)) {
    return json.map<CFListItem>((value) => ({
      __virtual__: true,
      id: uuid(),
      value,
    }));
  }
  if (typeof json == "object" && json != null) {
    const res: Record<string, any> = {};
    for (const key in json) {
      res[key] = assignListItemIds(json[key]);
    }
    return res;
  }
  return json;
}
