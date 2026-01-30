#!/usr/bin/env node
// Example of using vgrok programmatically
import { client } from '@styfle/vgrok';

async function example() {
  console.log('Starting vgrok client...');
  
  // Create a tunnel for port 3000
  const tunnel = await client({ port: 3000 });
  
  console.log(`Tunnel created! URL: ${tunnel.url}`);
  console.log('Press Ctrl+C to stop...');
  
  // Keep the process running
  await new Promise(() => {});
}

example().catch(console.error);
