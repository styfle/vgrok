# vgrok

Get a secure public URL for your local web server so you can trigger webhooks, etc.

Built with [Vercel sandbox](https://vercel.com/docs/vercel-sandbox).

> [!IMPORTANT]
> vgrok is designed for quick local development. If you want quick production and preview deployments with secure public urls, [connect your repo to Vercel](https://vercel.com/new) so you can automatically deploy on `git push`.

## Usage

First,Install globally from npm

```sh
npm i -g @styfle/vgrok
```

Next, set environment variables so vgrok knows where to create the sandbox server:

```sh
export VERCEL_TEAM_ID=team_abc 
export VERCEL_PROJECT_ID=prj_123 
export VERCEL_TOKEN=mytoken
```

Then start the vgrok cli with the port of your local server, for example:

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

## Caveats

- The sandbox has a timeout of 45 min (need to spawn a new sandbox on timeout)
- Does not handle multiple connections to the same sandbox (is this useful, maybe cost?)
- Logs are really noisy right now (need to hide behind verbose flag)
