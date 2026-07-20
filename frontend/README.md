# Booking Frontend

A light, premium customer booking flow for the FastAPI Booking Backend — built with React 19 + Vite. Customers can reserve an appointment and look up its status with a confirmation ID. No login required (matches the backend: `/bookings` POST/GET are public; everything else needs staff auth).

## Local development

```bash
npm install
cp .env.example .env      # then edit VITE_API_URL to point at your backend
npm run dev
```

The backend must be running with CORS enabled for whatever origin you're developing on (see the backend's `CORS_ORIGINS` env var — the `.env` it ships with already allows all origins with `CORS_ORIGINS=*`).

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the FastAPI backend, no trailing slash | `http://localhost:8000` |
| `VITE_BUSINESS_NAME` | Shown in the header/footer | `Meridian Clinic` |

## Deploying to Vercel

1. Push this folder to a GitHub repo (or use the `vercel` CLI to deploy directly from disk).
2. In Vercel: **New Project** → import the repo. Framework preset auto-detects as **Vite** — no config needed (`npm run build`, output dir `dist`).
3. Under **Settings → Environment Variables**, add:
   - `VITE_API_URL` = the public URL of your deployed backend (e.g. `https://your-api.onrender.com`)
   - `VITE_BUSINESS_NAME` = your business name (optional)
4. Deploy.
5. On your **backend**, set `CORS_ORIGINS` to your Vercel URL (e.g. `https://your-app.vercel.app`) instead of `*` once you're ready to lock it down.

That's it — this app makes zero server-side assumptions, so any static host works, but Vercel needs no extra config beyond the env vars above.

## What's included

- **Book an appointment** — name, email, phone (optional), reason, start/end time → `POST /bookings`
- **Find my booking** — paste the confirmation ID you received → `GET /bookings/{id}`, shown as a ticket-stub card with live status (pending / confirmed / declined / cancelled)

Nothing here touches the admin-only endpoints (`/auth/*`, booking status updates, `/agent/query`) — those require staff login and are out of scope for this customer-facing flow.
