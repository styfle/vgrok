# vgrok

Get a secure public URL for your local web server so you can trigger webhooks, etc.

Built with [Vercel sandbox](https://vercel.com/docs/vercel-sandbox).

## Usage

First, set environment variables so vgrok knows where to create the sandbox server:

```sh
export VERCEL_TEAM_ID=team_abc 
export VERCEL_PROJECT_ID=prj_123 
export VERCEL_TOKEN=mytoken
```

Then start the vgrok cli with the port of your local server, for example:

```sh
./vgrok.ts 3000
```

## Caveats

- Does not reuse existing sandbox instance
- The sandbox has a timeout of 45 min
- Does not stop sandbox automatically when client disconnects
- Does not handle multiple connections to the same sandbox (I think?)
- Logs are really noisy right now
