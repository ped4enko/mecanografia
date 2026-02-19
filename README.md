# Mecanografía — Touch typing for Spanish learners

Web app for practicing touch typing (mecanografía) in Spanish at **mecanografia.info**. Built for high readability, clear progress, and a distraction-free interface.

## Features

- **Spanish-focused**: Practice texts include ñ, á, é, í, ó, ú, ü, ¿, ¡, and common vocabulary.
- **Live stats**: PPM (palabras por minuto), accuracy, elapsed time, and level (Principiante → Experto).
- **Virtual keyboard**: Spanish ISO layout with highlighted next key.
- **Accessibility**: Skip link, ARIA labels, reduced-motion-friendly cursor, keyboard navigation.
- **Theme**: Light/dark mode with system preference detection; toggle in header.
- **Progress**: Best PPM saved in `localStorage`.

## Deploy to Cloudflare Pages

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/):
   ```bash
   npm install -g wrangler
   ```

2. From this directory, deploy:
   ```bash
   cd mecanografia
   wrangler pages deploy . --project-name=mecanografia
   ```

3. In Cloudflare Dashboard → Pages → your project → **Custom domains**, add **mecanografia.info**.

4. In your domain registrar, set the DNS for mecanografia.info to the Cloudflare nameservers (or add a CNAME to the Pages URL if already on Cloudflare).

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
