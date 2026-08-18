# Museflow — Vercel deployment

This folder is a Vercel-ready React + Vite build of the Museflow UI.

## Local test

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Deploy with Vercel dashboard

1. Put this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project**.
3. Import the GitHub repository.
4. Vercel should detect **Vite** automatically.
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click **Deploy**.

No environment variables are required by the current UI.
