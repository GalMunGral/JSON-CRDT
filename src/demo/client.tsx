import React, { FC, useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { v4 as uuid } from "uuid";
import { BroadcastClient } from "../crdt-json/Broadcast";
import { CFMap } from "../crdt-json/CFMap";
import { Atomic, Cursor, makeOperations } from "../crdt-json/JSON";
import { CFList } from "../crdt-json/List";
import { CFRegister } from "../crdt-json/Register";
import { CFValueHolder } from "../crdt-json/Value";

const client = ((window as any).client = new BroadcastClient());

const ops = makeOperations([], {
  test: "a",
  newTest: [
    1,
    {
      a: 2,
      c: 3,
    },
    3,
    {
      a: 4,
      b: 5,
    },
  ],
});

for (const op of ops) {
  client.send(op);
}

function useBroadcast() {
  const [_, dispatch] = useReducer((s) => s + 1, 0);
  const stateRef = useRef<CFValueHolder>();
  useEffect(() => {
    client.subscribe((s) => {
      stateRef.current = s;
      dispatch();
    });
  }, []);
  return stateRef.current;
}

const AddKey: FC<{ cursor: Cursor }> = ({ cursor }) => {
  const [key, setKey] = useState("");
  const addKey = (value: Atomic) => {
    client.send({
      type: "assign",
      cursor: [...cursor, key],
      value,
    });
  };
  return (
    <div>
      <input value={key} onChange={(e) => setKey(e.target.value)} />
      <button onClick={() => addKey({ type: "register", value: "" })}>
        add reg
      </button>
      <button onClick={() => addKey({ type: "map" })}>add map</button>
      <button onClick={() => addKey({ type: "list" })}>add list</button>
    </div>
  );
};

const InsertKey: FC<{ cursor: Cursor }> = ({ cursor }) => {
  const [prev, setPrev] = useState("");
  const insertKey = (value: Atomic) => {
    client.send({
      type: "insert",
      cursor: [...cursor, prev],
      key: uuid(),
      value,
    });
  };
  return (
    <div>
      <input value={prev} onChange={(e) => setPrev(e.target.value)} />
      <button onClick={() => insertKey({ type: "register", value: "" })}>
        add reg
      </button>
      <button onClick={() => insertKey({ type: "map" })}>add map</button>
      <button onClick={() => insertKey({ type: "list" })}>add list</button>
    </div>
  );
};

const Json: FC<{ cursor: Cursor; value: CFValueHolder }> = ({
  cursor,
  value,
}) => {
  if (value.content instanceof CFList) {
    return (
      <div style={{ padding: 5 }}>
        <pre>key:{value.key}</pre>
        <div style={{ marginLeft: 10, border: "1px solid green" }}>
          {value.content.getChildren().map((child) => (
            <Json
              key={child.key}
              cursor={[...cursor, child.key]}
              value={child}
            />
          ))}
          <InsertKey cursor={cursor} />
        </div>
      </div>
    );
  }
  if (value.content instanceof CFMap) {
    return (
      <div style={{ padding: 5 }}>
        <pre>key: {value.key}</pre>
        <div style={{ marginLeft: 10, border: "1px solid blue" }}>
          {value.content.getChildren().map((child) => (
            <Json
              key={child.key}
              cursor={[...cursor, child.key]}
              value={child}
            />
          ))}
          <AddKey cursor={cursor} />
        </div>
      </div>
    );
  }
  if (value.content instanceof CFRegister) {
    return (
      <div style={{ padding: 5 }}>
        <pre>key: {value.key}</pre>
        <input
          style={{ marginLeft: 10 }}
          value={String(value.content.getValue())}
          onChange={(e) => {
            client.send({
              type: "assign",
              cursor,
              value: {
                type: "register",
                value: e.target.value,
              },
            });
          }}
        />
      </div>
    );
  }
  return null;
};

const App: FC<{ client: BroadcastClient }> = ({ client }) => {
  const state = useBroadcast();
  return state ? <Json cursor={[]} value={state} /> : null;
};

document.body.innerHTML = '<div id="app"></div>';
createRoot(document.getElementById("app")!).render(<App client={client} />);
