#!/usr/bin/env node
import { client } from './client.js';

const timeout = 2_700_000; // 45 min

async function main() {
  const [firstArg, secondArg] = process.argv.slice(2);
  if (!firstArg) {
    throw new Error('Please provide a port as the first argument');
  }
  const localPort = Number(firstArg);
  if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
    throw new Error('The first argument must be a valid port number');
  }
  const tunnel = await client({ port: localPort, timeout });

  if (secondArg === 'start') {
    // The `start` command means we expect a `stop` command later to shutdown.
    // For example, `vgrok 8000 start` and later `vgrok 8000 stop`.
    console.log(`Started at ${tunnel.url}`);
  } else if (secondArg === 'stop') {
    await tunnel.shutdown();
    console.log(`Stopped at ${tunnel.url}`);
  } else {
    // If no `start` command provided, that means automatically shutdown when vgrok exits.
    // For example, `vgrok 8000` and then later CTRL+C.
    process.on('SIGINT', async () => { await tunnel.shutdown(); process.exit(0); });
    process.on('SIGTERM', async () => { await tunnel.shutdown(); process.exit(0); });
    console.log(`Ready at ${tunnel.url}`);
  }
}

main().catch(console.error)
