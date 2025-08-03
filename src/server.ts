import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
const { REMOTE_PORT, SOCKET_PATH } = process.env;
if (!REMOTE_PORT) {
  throw new Error('REMOTE_PORT environment variable is not set');
}
if (!SOCKET_PATH) {
  throw new Error('SOCKET_PATH environment variable is not set');
}
console.log('Starting tunnel server on port', REMOTE_PORT);
const wss = new WebSocketServer({ noServer: true });
const clients = new Map<string, import('ws').WebSocket>();
const responses = new Map<string, http.ServerResponse>();

export type TunnelRequest = {
  id: string;
  method: string | undefined;
  url: string | undefined;
  headers: Record<string, string> | undefined;
  body: string | undefined;
}

export type TunnelResponse = {
  id: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

wss.on('connection', (ws) => {
  const clientId = randomUUID();
  clients.set(clientId, ws);

  ws.on('close', () => {
    console.log('Client disconnected:', clientId);
    clients.delete(clientId);
  });

  ws.on('message', (msg) => {
    console.log('Message received from client:', msg.toString());
    const response = JSON.parse(msg.toString());
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
  console.log('HTTP request received:', req.method, req.url);
  // Send to the first connected client
  // TODO: should we broadcast to all clients?
  const [_clientId, client] = clients.entries().next().value || [];

  if (!client) {
    res.writeHead(502);
    return res.end('No tunnel client connected. Did you forget to start vgrok?');
  }
  if (client.readyState !== WebSocket.OPEN) {
    res.writeHead(502);
    return res.end(`Tunnel client socket is not open: ${client.readyState}`);
  }

  const id = randomUUID();
  responses.set(id, res);

  let chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => client.send(JSON.stringify({
    id,
    method: req.method,
    url: req.url,
    headers: req.headers as Record<string, string>,
    body: Buffer.concat(chunks).toString(), // TODO: use base64
  } satisfies TunnelRequest)));
});

server.on('upgrade', (req, socket, head) => {
  console.log('Upgrade request received:', req.url);
  if (req.url === SOCKET_PATH) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

server.listen(REMOTE_PORT, () => {
  console.log(`Tunnel server listening on :${REMOTE_PORT}`);
});