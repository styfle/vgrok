#!/usr/bin/env node --experimental-transform-types --disable-warning=ExperimentalWarning
import { client } from './client.js';

async function main() {
  const [firstArg, secondArg] = process.argv.slice(2);
  if (!firstArg) {
    throw new Error('Please provide a port as the first argument');
  }
  const localPort = Number(firstArg);
  if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
    throw new Error('The first argument must be a valid port number');
  }

  if (secondArg === 'stop') {
    await client.shutdown();
    return 0;
  }

  const autoShutdown = secondArg !== 'start';
  // If secondArg is 'start', autoShutdown is false (manual shutdown with 'stop' command)
  // If no secondArg or any other value, autoShutdown is true (auto shutdown on SIGINT/SIGTERM)
  
  await client({ port: localPort, autoShutdown });
}

main().catch(console.error)
