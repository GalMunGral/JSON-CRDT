import { BroadcastClient } from "../crdt-json/CausalBroadcast.js";
import "../crdt-json/Operation.js";

import axios from "axios";

const client = new BroadcastClient();
client.send([], {
  type: "assign",
  value: 1,
});
