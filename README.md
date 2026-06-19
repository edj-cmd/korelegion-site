# Kore Legion — Website

The official site for Kore Legion. Pure static site — HTML, CSS, JS with a
Three.js 3D hero and GSAP scroll choreography. No build step.

```
korelegion-site/
├── index.html         # All sections / markup
├── css/styles.css     # Full design system + responsive
├── js/
│   ├── agents.js      # Agent data (cards + drawer)
│   └── main.js        # 3D scene + scroll animation + UI
├── render.yaml        # Render static-site config
└── assets/            # Logo files
```

## Run locally
```bash
python3 -m http.server 4178
# open http://localhost:4178
```

## Deploy to Render + korelegion.com

1. Push this folder to a new GitHub repo (e.g. `korelegion-site`).
2. In Render → **New** → **Static Site** → connect the repo.
   - Publish directory: `.`
   - Build command: *(leave empty)*
3. Render gives you `korelegion-site.onrender.com` — confirm it looks right.
4. In Render → the site → **Settings → Custom Domains** → add `korelegion.com`
   and `www.korelegion.com`. Render shows the DNS records to set.
5. In GoDaddy → **Domain → DNS** → add the records Render gives you
   (an `ALIAS`/`A` record for the apex and a `CNAME` for `www`). Remove the
   GoDaddy parking/forwarding records.
6. Wait for DNS to propagate (usually < 1 hour). HTTPS is automatic on Render.
