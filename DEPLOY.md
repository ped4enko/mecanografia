# Deploy

## Site (this repo)

```bash
CLOUDFLARE_ACCOUNT_ID=f2009a97d898abb2157db041d3339e2a \
  npx wrangler@4 pages deploy . --project-name=mecanografiapage --branch=main
```

Always pass `--project-name=mecanografiapage` explicitly. Do not deploy to `mecanografia-cdn` from this repository.

## CDN (not this repo)

`cdn.mecanografia.info` is owned by a separate Pages project (`mecanografia-cdn`) and is filled from the Buffer / Claude SDK pipeline (`buffer-mcp`), not from here.

Full incident notes and safety rules: [HANDOFF-cdn.md](./HANDOFF-cdn.md).
