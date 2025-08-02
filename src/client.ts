// vgrok.js (local client)
import http from "http";
//import NodeWebSocket from "ws";

import { LOCAL_PORT, REMOTE_PORT, TUNNEL_URL } from "./shared.ts";
console.log("vgrok.js: Starting local client...");
console.log({LOCAL_PORT, REMOTE_PORT, TUNNEL_URL});

// Connect to remote tunnel server
const tunnel = new WebSocket(TUNNEL_URL);

tunnel.addEventListener("message", async (event) => {
  console.log("Received message from tunnel:", event);
  const { id, method, url, headers, body } = JSON.parse(event.data);

  // Forward request to local server
  const req = http.request({
    hostname: "localhost",
    port: LOCAL_PORT, // port of the local server
    path: url,
    method,
    headers,
  }, (res) => {
    let chunks: Buffer[] = [];
    res.on("data", chunk => chunks.push(chunk));
    res.on("end", () => {
      tunnel.send(JSON.stringify({
        id,
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString(),
      }));
    });
  });

  if (body) req.write(body);
  req.end();
});