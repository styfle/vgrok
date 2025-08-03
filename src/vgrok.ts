import { CommandFinished, Sandbox } from '@vercel/sandbox';
import { readFileSync } from 'fs';
import http from 'http';
import { join } from 'path';

const PORT = 3000;
const SOCKET_PATH = '/_ws';

async function writeLogs(cmd: CommandFinished) {
  for await (const log of cmd.logs()) {
    if (log.stream === 'stderr') {
      console.error('ERROR:', log.data);
    } else {
      console.log('LOG:', log.data);
    }
  }
}

async function main() {
  const firstArg = process.argv[2];
  if (!firstArg) {
    throw new Error('Please provide a port as the first argument');
  }
  const localPort = Number(firstArg);
  if (isNaN(localPort)) {
    throw new Error('The first argument must be a valid port number');
  }
  const teamId = process.env.VERCEL_TEAM_ID || ''
  const projectId = process.env.VERCEL_PROJECT_ID || ''
  const token = process.env.VERCEL_TOKEN || ''

  const sandbox = await Sandbox.create({
    teamId,
    projectId,
    token,
    runtime: 'node22',
    resources: {
      vcpus: 2,
    },
    ports: [PORT],
    timeout: 300_000,
  });

  const whoami = await sandbox.runCommand('whoami')
  console.log(`Running as: ${await whoami.stdout()}`)

  const pwd = await sandbox.runCommand('pwd')
  console.log(`Working dir: ${await pwd.stdout()}`)

  const sandboxUrl = sandbox.domain(PORT);
  console.log(`Sandbox URL: ${sandboxUrl}`);
  console.log(`Sandbox ID: ${sandbox.sandboxId}`);

  await sandbox.writeFiles([
    /*
    {
      content: readFileSync(join(import.meta.dirname, '../package.json')),
      path: 'package.json'
    },
    {
      content: readFileSync(join(import.meta.dirname, '../pnpm-lock.yaml')),
      path: 'pnpm-lock.yaml'
    },
    */
   {
      content: Buffer.from(JSON.stringify({ private: true, type: 'module', dependencies: { ws: '8.18.3' } })),
      path: 'package.json'
    },
    {
      content: readFileSync(join(import.meta.dirname, './server.ts')),
      path: 'server.ts'
    },
  ]);
  const ls = await sandbox.runCommand('ls', ['-A']);
  await writeLogs(ls);
  
  const pnpm = await sandbox.runCommand('pnpm', ['install']);
  await writeLogs(pnpm);

  const node = await sandbox.runCommand({
    cmd: 'node',
    args: ['--experimental-strip-types', 'server.ts'],
    detached: true,
    env: {
      REMOTE_PORT: String(PORT),
      SOCKET_PATH,
    },
    stderr: process.stderr,
    stdout: process.stdout,
  });

  console.log('Server startedAt', new Date(node.startedAt));

  console.log('Starting local client...');
  const tunnel = new WebSocket(sandboxUrl + SOCKET_PATH);
  
  tunnel.addEventListener('message', async (event) => {
    console.log('Message received from tunnel:', event.data);
    const { id, method, url, headers, body } = JSON.parse(event.data);
  
    // Forward request to local server
    const req = http.request({
      hostname: 'localhost',
      port: localPort,
      path: url,
      method,
      headers,
    }, (res) => {
      let chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        tunnel.send(JSON.stringify({
          id,
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }));
      });
    });
  
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

main().catch(console.error)
