// tunnel-server.js (remote)
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import { REMOTE_PORT } from "./shared.ts";

console.log(WebSocketServer)
const wss = new WebSocketServer({ noServer: true });
const clients = new Map<string, import('ws').WebSocket>();
const responses = new Map<string, http.ServerResponse>();

wss.on("connection", (ws) => {
  const clientId = crypto.randomUUID();
  clients.set(clientId, ws);

  ws.on("close", () => {
    clients.delete(clientId);
  });

  ws.on("message", (msg) => {
    console.log("Received message from client:", msg);
    const response = JSON.parse(msg);
    const { id, statusCode, headers, body } = response;
    const res = responses.get(id);
    if (res) {
      res.writeHead(statusCode, headers);
      res.end(body);
      responses.delete(id);
    }
  });
});


const server = http.createServer((req, res) => {
  // Send to the first connected client
  const [_clientId, client] = clients.entries().next().value || [];

  if (!client || client.readyState !== WebSocket.OPEN) {
    res.writeHead(502);
    return res.end("No tunnel client connected");
  }

  const id = crypto.randomUUID();
  responses.set(id, res);

  let chunks: Buffer[] = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => {
    client.send(JSON.stringify({
      id,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString(),
    }));
  });
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});

server.listen(REMOTE_PORT, () => {
  console.log(`Tunnel server listening on :${REMOTE_PORT}`);
});