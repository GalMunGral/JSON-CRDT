import { VectorClock } from "./VectorClock";
import { v4 as uuid } from "uuid";

export type Cursor = Array<string>;

export type Atomic =
  | { type: "register"; value: unknown }
  | { type: "list" }
  | { type: "map" };

export type Operation = {
  cursor: Cursor;
} & (
  | { type: "assign"; value: Atomic }
  | { type: "insert"; cursor: Cursor; key: string; value: Atomic }
  | { type: "delete"; cursor: Cursor }
);

export type IssuedOperation = Operation & {
  timestamp: VectorClock;
};

function isList(json: unknown): json is Array<unknown> {
  return Array.isArray(json);
}

function isMap(json: unknown): json is Record<string, unknown> {
  return typeof json == "object" && json !== null && !Array.isArray(json);
}

function root(json: unknown): Atomic {
  if (isMap(json)) return { type: "map" };
  if (isList(json)) return { type: "list" };
  return { type: "register", value: json };
}

export function makeOperations(
  cursor: Cursor,
  json: unknown
): Array<Operation> {
  const res: Array<Operation> = [];
  if (isList(json)) {
    let prevKey = "";
    for (const value of json) {
      const key = uuid();
      res.push(
        {
          type: "insert",
          cursor: [...cursor, prevKey],
          key,
          value: root(value),
        },
        ...makeOperations([...cursor, key], value)
      );
      prevKey = key;
    }
  } else if (isMap(json)) {
    for (const [key, value] of Object.entries(json)) {
      res.push(
        {
          type: "assign",
          cursor: [...cursor, key],
          value: root(value),
        },
        ...makeOperations([...cursor, key], value)
      );
    }
  }
  return res;
}
