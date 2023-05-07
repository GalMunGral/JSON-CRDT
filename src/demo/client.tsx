import { BroadcastClient } from "../crdt-json/CausalBroadcast";
import { JsonContext } from "../crdt-json/JSON";
import { createRoot } from "react-dom/client";
import React, { FC, useRef } from "react";


document.body.innerHTML = '<div id="app"></div>';
const root = createRoot(document.getElementById("app")!);

const Json: FC<{ data: any }> = ({ data }) => {
  if (Array.isArray(data)) {
    return data.map(item => )
  }
};

const json = new JsonContext({
  test: 'a',
  newTest: [1,2,3,{
    a: 4,
    b: 5,
  }]
}, new BroadcastClient())

const App : FC = () => {
  
  return <div></div>
}

root.render(
  <App
    init={json.root}
  />
);
