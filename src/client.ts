import { CommandFinished, Sandbox } from '@vercel/sandbox';
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TunnelRequest, TunnelResponse } from './server.js';
import { vercelCliAuth } from './vercel-cli-auth.js';

type VgrokConfig = { localPortToSandbox: Record<string, { id: string, createdAt: number}> };

const SANDBOX_PORT = 3000;
const SANDBOX_TIMEOUT = 2_700_000; // 45min
const WS_PATH = '/_ws';
const VGROK_CONFIG_PATH = join(tmpdir(), './vgrok-config.json');

export interface ClientOptions {
  port: number;
  autoShutdown?: boolean;
}

export interface Client {
  url: string;
  shutdown: () => Promise<void>;
}

// Note: Currently only one active tunnel is supported at a time
// Creating multiple tunnels concurrently may lead to unexpected behavior
let activeSandbox: Sandbox | null = null;
let activeTunnel: WebSocket | null = null;

async function writeLogs(cmd: CommandFinished) {
  for await (const log of cmd.logs()) {
    if (log.stream === 'stderr') {
      console.error('ERROR:', log.data);
    } else {
      console.log('LOG:', log.data);
    }
  }
}

async function stopSandbox(sandbox: Sandbox | null) {
  console.log('Shutting down sandbox...')
  if (sandbox) {
    await sandbox.stop();
  }
  console.log('Done.')
}

export async function client(options: ClientOptions): Promise<Client> {
  const { port: localPort, autoShutdown = true } = options;

  if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
    throw new Error('Port must be a valid port number between 1 and 65535');
  }

  const config = await readFile(VGROK_CONFIG_PATH, 'utf8')
    .then(str => JSON.parse(str) as VgrokConfig)
    .catch(() => null);
  const localPortToSandbox = config ? config.localPortToSandbox : {};
  const { token, teamId, projectId } = vercelCliAuth();
  let sandbox: Sandbox | null = null;

  if (localPortToSandbox[localPort]) {
    const { id, createdAt } = localPortToSandbox[localPort];
    console.log(`Reusing existing sandbox for port ${localPort} with ID ${id}`);
    sandbox = await Sandbox.get({ teamId, projectId, token, sandboxId: id }).catch(() => null);
    if (sandbox && sandbox.status !== 'running') {
      console.log(`Sandbox with ID ${id} is not running`);
      sandbox = null;
    }
    if (Date.now() - createdAt > SANDBOX_TIMEOUT) {
      // assume sandbox is gone now since it's past the timeout
      sandbox = null;
    }
  }

  if (!sandbox) {
    console.log(`Creating new sandbox for port ${localPort}`);
    sandbox = await Sandbox.create({
      teamId,
      projectId,
      token,
      runtime: 'node22',
      resources: {
        vcpus: 2,
      },
      ports: [SANDBOX_PORT], // TODO: allocate multiple ports to map back to local port
      timeout: SANDBOX_TIMEOUT,
    });
    localPortToSandbox[localPort] = { id: sandbox.sandboxId, createdAt: Date.now() };
    await writeFile(
      VGROK_CONFIG_PATH,
      JSON.stringify({ localPortToSandbox } satisfies VgrokConfig)
    );
    setTimeout(async () => {
      // TODO: can we spawn a new sandbox automatically when timeout reached?
      // Alternatively we can kill the ngrok process to avoid confusion.
    }, SANDBOX_TIMEOUT);
  }

  activeSandbox = sandbox;

  const sandboxUrl = sandbox.domain(SANDBOX_PORT);

  await sandbox.writeFiles([
   {
      content: Buffer.from(JSON.stringify({ private: true, type: 'module', dependencies: { ws: '8.18.3' } })),
      path: 'package.json',
    },
    {
      content: await readFile(join(import.meta.dirname, './server.js')),
      path: 'server.js',
      // TODO: can we mark a file as executable?
    },
  ]);
  
  const pnpm = await sandbox.runCommand('pnpm', ['install']);
  await writeLogs(pnpm);

  await sandbox.runCommand({
    cmd: 'node',
    args: ['server.js'],
    detached: true,
    env: {
      SANDBOX_PORT: String(SANDBOX_PORT),
      WS_PATH: WS_PATH,
    },
    //stderr: process.stderr, // TODO: hide
    //stdout: process.stdout, // TODO: hide
  });

  console.log('Starting local client...');
  const tunnel = new WebSocket(sandboxUrl + WS_PATH);
  activeTunnel = tunnel;

  // Wait for WebSocket connection to be established
  await new Promise<void>((resolve, reject) => {
    tunnel.addEventListener('open', () => resolve(), { once: true });
    tunnel.addEventListener('error', (event) => reject(new Error('Failed to establish WebSocket connection')), { once: true });
  });
  
  tunnel.addEventListener('message', async (event) => {
    const data = event.data as string;
    console.log('Message received from tunnel:', data);
    const tunnelRequest = JSON.parse(data) as TunnelRequest;
    const { id, method, url, headers, body } = tunnelRequest;
  
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
          statusCode: res.statusCode ?? 999,
          headers: res.headers as Record<string, string>,
          body: Buffer.concat(chunks).toString('base64url')
        } satisfies TunnelResponse));
      });
    });

    req.on('error', (error) => {
      console.error(`Error forwarding request to local server:`, error);
      tunnel.send(JSON.stringify({
        id,
        statusCode: 502,
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from(`Bad Gateway: ${error.message}`).toString('base64url')
      } satisfies TunnelResponse));
    });
  
    if (body) {
      req.write(Buffer.from(body, 'base64url'));
    }
    req.end();
  });

  tunnel.addEventListener('error', (event) => {
    // TODO: should this shutdown the sandbox?
    console.error('Unexpected socket error', event.error);
  });

  tunnel.addEventListener('close', (event) => {
    // TODO: should this shutdown the sandbox?
    console.error('Socket closed', event);
    if (autoShutdown) {
      // For CLI usage, exit the process
      // For programmatic usage with autoShutdown, the signal handlers will clean up
      if (typeof process !== 'undefined' && process.exit) {
        process.exit(1);
      }
    }
  });

  const shutdown = async () => {
    if (activeTunnel) {
      activeTunnel.close();
      activeTunnel = null;
    }
    await stopSandbox(activeSandbox);
    activeSandbox = null;
  };

  if (autoShutdown) {
    process.on('SIGINT', async () => { await shutdown(); process.exit(0); });
    process.on('SIGTERM', async () => { await shutdown(); process.exit(0); });
  }

  console.log(`Ready at ${sandboxUrl}`);

  return {
    url: sandboxUrl,
    shutdown,
  };
}

client.shutdown = async () => {
  if (activeTunnel) {
    activeTunnel.close();
    activeTunnel = null;
  }
  await stopSandbox(activeSandbox);
  activeSandbox = null;
};
