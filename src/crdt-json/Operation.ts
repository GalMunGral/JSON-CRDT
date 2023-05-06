import { ReplicaId, VectorClock } from "./VectorClock";

export type Cursor = Array<string | number>;

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
