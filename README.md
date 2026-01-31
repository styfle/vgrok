# vgrok

Get a secure public URL for your local web server so you can trigger webhooks, etc.

Built with [Vercel sandbox](https://vercel.com/docs/vercel-sandbox).

> [!IMPORTANT]
> vgrok is designed for quick local development. If you want quick production and preview deployments with secure public urls, [connect your repo to Vercel](https://vercel.com/new) so you can automatically deploy on `git push`.

## CLI Usage

First, install globally from npm:

```sh
npm i -g @styfle/vgrok
```

Next, install vercel cli from npm and login and link to a project:

```sh
npm i -g vercel
vercel login
vercel link
```

<details>
  <summary>Don't want vercel cli?</summary>
  If you don't want to install vercel cli, perhaps when disk space is constrained, you can set environment variables instead:
  
  ```sh
  export VERCEL_TEAM_ID=team_abc 
  export VERCEL_PROJECT_ID=prj_123 
  export VERCEL_TOKEN=mytoken
  ```

  This is similar to linking a project so vgrok knows where to create the sandbox.
</details>

Finally, start the vgrok cli with the port of your local server, for example:

```sh
vgrok 3000
```

This will print a unique url so that your local server on port 3000, like `next dev`, is now accessible to the world.

The default behavior is to shutdown the connection and corresponding sandbox when the vgrok process exits (CTRL+C).

If you plan to run vgrok more frequently and don't want to wait a couple seconds for the sandbox, you can reuse a sandbox, or rather not shutdown the sandbox when the vgrok process exits.

```sh
vgrok 3000 start # create a sandbox and connect the tunnel
# CTRL+C will disconnect the tunnel but not shudown the sandbox
vgrok 3000 stop  # shutdown the sandbox 
```

## Programmatic Usage

```ts
import { client } from '@styfle/vgrok';
const tunnel = await client({ port: 3000, timeout: 2_700_000 });
console.log(`Ready at ${tunnel.url}`);
process.on('SIGINT', async () => { await tunnel.shutdown(); });
process.on('SIGTERM', async () => { await tunnel.shutdown(); });
```

## Caveats

- The sandbox has a timeout of 45 min for Hobby teams (need to spawn a new sandbox on timeout)
- The sandbox only runs in the `iad1` region (might feel slow if you're outside US East)
- Does not handle multiple connections to the same sandbox (is this useful, might bring down cost?)
- Logs are really noisy right now (need to hide behind verbose flag)
