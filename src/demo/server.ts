import { PassThrough, Writable } from "stream";
import Koa from "koa";
import Router from "@koa/router";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import { BroadcastServer } from "../crdt-json/Broadcast";
import { IssuedOperation, Operation } from "../crdt-json/JSON";

const app = new Koa();
const router = new Router();
const broadcaster = new BroadcastServer();

router.get("/broadcast", (ctx) => {
  ctx.status = 200;
  ctx.set("Content-Type", "text/event-stream");
  ctx.set("Cache-Control", "no-cache");
  ctx.set("Connection", "keep-alive");
  const stream = new PassThrough();
  broadcaster.join(ctx.query["replicaId"] as string, stream);
  ctx.body = stream;
});

router.post("/event", (ctx) => {
  const event = ctx.request.body as IssuedOperation;
  broadcaster.publish(event);
  ctx.body = "";
});

app.use(bodyParser());
app.use(serve("."));
app.use(router.routes());

app.listen(3000);
