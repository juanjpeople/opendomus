This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing on a phone

Connect the phone and computer to the same Wi-Fi and open the Network URL printed by
`next dev` (currently `http://192.168.1.37:3000`). If the IP changes, update
`allowedDevOrigins` in `next.config.ts` and restart the dev server.

Test with the actual Network URL, not only `localhost`: HTTP LAN addresses are not
secure contexts. Local data IDs use `createId` from `src/lib/id.ts`, which supports
both environments using cryptographic randomness. PIN hashing and biometrics still
require HTTPS (or localhost); do not weaken their cryptography for HTTP.

Profiles and household data are stored locally in each browser's IndexedDB.
Different devices, browsers, and origins do not share data automatically.
Schema v6 recovers completely empty databases left by an interrupted initial setup,
without replacing existing household data. Database loading errors show a reload
action instead of an empty profile picker. Schema changes are declared in
`declareSchema()` (`src/lib/db.ts`); the same chain upgrades old JSON exports on import
(Settings → Data → Import).

### Tests and checks

Unit tests cover the pure logic (permissions, domain rules, translator). Node.js runs
the TypeScript directly; `scripts/test-hooks.mjs` resolves the `@/` alias and
extensionless imports. End-to-end tests (Playwright) run against the static build.
Requires Node.js 24+. CI (`.github/workflows/ci.yml`) runs all of this on every PR.

```bash
npm run check     # typecheck + lint + unit tests
npm run build     # static site in out/
npm run e2e       # Playwright on out/ (desktop + phone); uses the installed Chrome locally
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions.

### Static site, offline and installable (PWA)

`npm run build` produces a fully static site in `out/` (`output: "export"`): no Next.js
server is needed. Pages that show one record take the id in the query string
(`/inventario/ver?id=…`, `/recetas/ver?id=…`); printed QR labels keep pointing to
`/c/<code>`, which `public/_redirects` (Cloudflare Pages/Netlify) and, on any other host,
`src/app/not-found.tsx` translate to `/c?code=…`.

The build also emits the manifest (`/manifest.webmanifest`), generated icons (`/icons/*`)
and a service worker (`/sw.js`, versioned per build). The service worker is only
registered in production builds, so `next dev` never caches stale files. Once installed,
every page works without a connection; data already lives in IndexedDB. New versions wait
for the user to click "Update". Installing requires HTTPS (or `localhost`).

Preview the build locally with `npx serve out`.

### Deploy (Cloudflare)

`wrangler.jsonc` deploys `out/` as static assets (no server code, so Cloudflare doesn't try
to build a Next.js server with OpenNext). In the Cloudflare dashboard, connect the GitHub
repo (Workers & Pages → Create → Import a repository) and set:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Environment variable: `NODE_VERSION=24`

Every push to `main` deploys. `public/_redirects` sends printed QR links (`/c/<code>`) to
`/c?code=…`, and unknown paths get `404.html`. Check the config locally with
`npm run build && npx wrangler dev`.

Any static host works the same way (Netlify, GitHub Pages, nginx/Caddy on a NAS): serve
`out/`. Household data stays on each device until sync exists (see `OPENDOMUS_PLAN.md`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## License

OpenDomus is free software under the [GNU AGPL v3](LICENSE) (or later): you can use,
study, modify and share it. If you run a modified version as a service for others, you
must offer them its source code too.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
