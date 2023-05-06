import { PassThrough, Writable } from "stream";
import Koa from "koa";
import Router from "@koa/router";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import { BroadcastServer } from "../crdt-json/CausalBroadcast.js";
import { Operation } from "../crdt-json/Operation.js";

const app = new Koa();
const router = new Router();
const broadcaster = new BroadcastServer();

router.get("/broadcast", (ctx) => {
  ctx.status = 200;
  ctx.set("Content-Type", "text/event-stream");
  ctx.set("Cache-Control", "no-cache");
  ctx.set("Connection", "keep-alive");
  broadcaster.join((ctx.body = new PassThrough()));
});

router.post("/event", (ctx) => {
  const event = ctx.request.body as Operation;
  broadcaster.publish(event);
  ctx.body = "";
});

app.use(bodyParser());
app.use(serve("."));
app.use(router.routes());

app.listen(3000);
