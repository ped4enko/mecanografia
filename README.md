# Mecanografía — Touch typing for Spanish learners

Web app for practicing touch typing (mecanografía) in Spanish at **mecanografia.info**. Built for high readability, clear progress, and a distraction-free interface.

**Repository:** [github.com/ped4enko/mecanografia](https://github.com/ped4enko/mecanografia)

## Version control (GitHub)

If the repo does not exist yet on GitHub, from this directory run:

```bash
# Log in to GitHub (browser or token)
gh auth login

# Create the repo and push
gh repo create ped4enko/mecanografia --public --source=. --remote=origin --push --description "Touch typing (mecanografía) web app for Spanish learners — mecanografia.info"
```

If the repo already exists, just push:

```bash
git push -u origin main
```

## Features

- **Spanish-focused**: Practice texts include ñ, á, é, í, ó, ú, ü, ¿, ¡, and common vocabulary.
- **Live stats**: PPM (palabras por minuto), accuracy, elapsed time, and level (Principiante → Experto).
- **Virtual keyboard**: Spanish ISO layout with highlighted next key.
- **Accessibility**: Skip link, ARIA labels, reduced-motion-friendly cursor, keyboard navigation.
- **Theme**: Light/dark mode with system preference detection; toggle in header.
- **Progress**: Best PPM saved in `localStorage`.

## Deploy to Cloudflare Pages

**Important:** This is a **Pages** project. Use `wrangler pages deploy`, not `wrangler deploy`.

### Option A: Deploy from Git (recommended)

1. In [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choose **ped4enko/mecanografia**.

2. Build settings (static site, no build step):
   - **Framework preset:** None
   - **Build command:** leave **empty**, or `npm run build` (no-op in this repo).
   - **Build output directory:** `.` or root.
   - Save and deploy. Each push to `main` will trigger a new deploy.

3. Add custom domain **mecanografia.info** in the project’s **Custom domains** and set DNS at your registrar.

### Option B: Deploy from CLI

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`

2. From this directory run:
   ```bash
   npx wrangler pages deploy . --project-name=mecanografia
   ```

3. Add **mecanografia.info** in Pages → your project → **Custom domains** and configure DNS.

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open http://localhost:3000 (or 8080).

## Tech

- Single HTML file (Tailwind CDN, no build step).
- Vanilla JS; no framework.
- `wrangler.toml` and `404.html` for Cloudflare Pages.
