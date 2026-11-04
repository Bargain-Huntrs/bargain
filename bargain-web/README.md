# BargainHuntrs Web

The Next.js frontend for BargainHuntrs, an arbitrage intelligence platform.

## Required environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_API_URL` — URL of the BargainHuntrs API (e.g., `http://localhost:4040` for local development).

Optional:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key for checkout.

## Running the development server

```bash
npm install
npm run dev
```

The dev server starts on [http://localhost:3030](http://localhost:3030).

## Building for production

```bash
npm run build
```

To start the production server after building:

```bash
npm start
```

## Linting

```bash
npm run lint
```

## Deployment notes

- Make sure `NEXT_PUBLIC_API_URL` points to the deployed API before building.
- This project can be deployed to Render, Vercel, or any other Next.js-compatible host.
- Do not commit `.env.local` or any secrets to version control.
- The frontend expects the backend to expose CORS origins matching its public URL.
