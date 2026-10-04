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
action instead of an empty profile picker.

Run the ID regression tests with Node.js 24+:

```bash
node --test src/lib/id.test.mjs
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
