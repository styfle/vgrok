import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('client module', () => {
  it('should export client function', async () => {
    const { client } = await import('./client.js');
    assert.strictEqual(typeof client, 'function', 'client should be a function');
  });

  it('should export client.shutdown function', async () => {
    const { client } = await import('./client.js');
    assert.strictEqual(typeof client.shutdown, 'function', 'client.shutdown should be a function');
  });

  it('should throw error for invalid port values', async () => {
    const { client } = await import('./client.js');
    
    const invalidPorts = [-1, 0, 70000, NaN];
    
    for (const port of invalidPorts) {
      await assert.rejects(
        async () => await client({ port }),
        {
          name: 'Error',
          message: /Port must be a valid port number/
        },
        `Should reject port ${port}`
      );
    }
  });

  it('should accept ClientOptions type correctly', async () => {
    const { client } = await import('./client.js');
    
    // Test that the function signature accepts the expected options
    // We won't actually call it with valid auth since we're in a test environment
    const validOptions = [
      { port: 3000 },
      { port: 8080, autoShutdown: true },
      { port: 9000, autoShutdown: false },
    ];
    
    for (const options of validOptions) {
      // Just verify the function can be called with these options
      // without throwing a TypeError about arguments
      try {
        await client(options);
      } catch (error: any) {
        // We expect authentication/connection errors, not argument errors
        assert.ok(
          !error.message.includes('Port must be a valid'),
          `Port ${options.port} should be valid`
        );
      }
    }
  });

  it('should have correct return type interface', async () => {
    const { client } = await import('./client.js');
    
    try {
      const result = await client({ port: 3000 });
      
      // If we somehow get a result (unlikely in test environment),
      // verify it has the expected shape
      assert.strictEqual(typeof result, 'object', 'Result should be an object');
      assert.strictEqual(typeof result.url, 'string', 'Result should have url string');
      assert.strictEqual(typeof result.shutdown, 'function', 'Result should have shutdown function');
    } catch (error: any) {
      // Expected to fail in test environment due to missing credentials
      // Just verify we didn't fail on type/argument issues
      assert.ok(
        error.message.includes('Vercel') || 
        error.message.includes('token') ||
        error.message.includes('team') ||
        error.message.includes('project') ||
        error.message.includes('WebSocket'),
        'Should fail with authentication or connection error, not type error'
      );
    }
  });

  it('should allow calling client.shutdown without active client', async () => {
    const { client } = await import('./client.js');
    
    // Should not throw when called without an active client
    await assert.doesNotReject(
      async () => await client.shutdown(),
      'client.shutdown should not throw when no active client'
    );
  });
});

