# Cloudflare Pages — Fix "run wrangler pages deploy instead"

Your project is still using **Build command:** `npx wrangler deploy`. That is for **Workers** and fails on **Pages**. Change it as below.

## Steps (do this in Cloudflare Dashboard)

1. Open **[Cloudflare Dashboard](https://dash.cloudflare.com)** → **Workers & Pages** → project **mecanografia**.

2. Go to **Settings** → **Builds & deployments** → **Build configuration**.

3. Click **Edit configuration** (or the edit icon next to the build settings).

4. Set:
   - **Build command:** `npm run build`  
     (or leave **completely empty** if the field allows it).  
     **Remove** any `npx wrangler deploy` or `wrangler deploy` from this field.
   - **Build output directory:** `.`

5. Click **Save**.

6. Open the **Deployments** tab and click **Retry deployment** (or push a new commit to trigger a build).

After this, Cloudflare will run `npm run build` (which does nothing and exits successfully), then deploy the contents of the repo. No wrangler command is needed for Git-connected Pages.
