# Booking System — Setup & Documentation

A full-stack appointment booking system: a FastAPI backend with two AI agents (a customer-facing conversational booker and a staff quick-action assistant), and a React 19 frontend covering the chat-first customer flow and an admin dashboard.

```
booking-project/
├── backend/     FastAPI + SQLite API
├── frontend/    React 19 + Vite UI
└── SETUP.md     ← you are here
```

---

## 1. What it does

**Customers** (no account needed):
- Land on a chat by default — the AI assistant greets them, asks what they need, checks whether a time slot is free, gathers name/email/reason, and books it once they confirm a specific time. Real multi-turn conversation, not a form dressed up as a chat.
- A manual form is available as a second tab for anyone who'd rather just fill in fields.
- Either way, they get a confirmation ID back immediately, styled as a ticket-stub card.
- A third tab lets them look up any booking's status later using that ID (pending / confirmed / declined / cancelled).

**Admin** (sign in required — see the roles note below):
- Dashboard with live counts per status (Total / Pending / Accepted / Rejected / Cancelled)
- Filter the booking list by status
- Accept, reject, cancel, or delete any booking — this is the "someone reviews what the AI booked" step
- Create additional admin accounts (protected by an admin key)
- A **separate** AI assistant for quick text-based actions ("is 3pm Friday free?") — distinct from the customer chat, since it's a different tool for a different audience (staff managing existing bookings vs. customers making new ones)

**A note on roles:** the backend supports both "admin" and "staff" as account roles, but only "admin" JWTs are actually granted access to the dashboard endpoints (list/accept/reject/delete) — a "staff" login can authenticate but can't do anything useful here. Rather than offer a role picker that leads to a dead end, this frontend's signup only creates admin accounts. A real staff-vs-admin split (e.g. staff can view but not delete) would be a backend permissions change.

**Deliberately out of scope:** both AI assistants recognize medical questions ("what medicine for a headache?") but always decline to answer them — the backend returns an honest "not available" message instead of letting an LLM improvise medical advice. This is a booking tool, not a diagnostic one, and that boundary is intentional.

---

## 2. Tech stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy (async), SQLite, JWT auth (`python-jose`), `bcrypt` for password hashing |
| AI agent | Groq (`openai/gpt-oss-120b` by default) for intent classification + entity extraction |
| Frontend | React 19, Vite, `framer-motion`, `lucide-react` |
| Email | Optional SMTP notifications on booking created/accepted/rejected |

No database server to install — SQLite is a single file (`backend/bookings.db`), created automatically on first run.

---

## 3. Setup — Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows (PowerShell): venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs at **http://localhost:8000**. Interactive API docs (Swagger) at **http://localhost:8000/docs**.

`backend/.env` ships pre-filled with working local defaults — SQLite path, open CORS, a default admin key — so it runs immediately with no edits required. The one thing that needs a real value to actually work is the AI assistant (next section); everything else (booking, auth, admin panel) works out of the box.

### Getting the AI assistant working (Groq API key)

1. Go to **[console.groq.com/keys](https://console.groq.com/keys)**, sign up or log in.
2. Click **Create API Key**, name it anything, copy the key (starts with `gsk_...`) — you only see it once.
3. Open `backend/.env` and replace:
   ```
   GROQ_API_KEY=gsk_your-groq-key-here
   ```
   with your real key.
4. Restart the backend.

Without this step, everything else still works — the chat widget just replies "The AI agent is temporarily unavailable" instead of erroring out.

### Environment variables (`backend/.env`)

| Variable | Purpose | Required? |
|---|---|---|
| `BUSINESS_NAME` | Shown in email notifications | No — defaults to "My Clinic" |
| `ADMIN_KEY` | Password-like secret needed to create the *first* staff/admin account via signup | Yes, keep it secret in production |
| `DATABASE_URL` | SQLite connection string | No — default works |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Email notifications on booking events | No — booking still works without email, it just won't send confirmations |
| `JWT_SECRET_KEY` | Signs staff/admin login tokens | Yes — change from the placeholder before deploying anywhere real |
| `JWT_ALGORITHM` / `JWT_EXPIRE_MINUTES` | Token config | No — defaults are fine |
| `GROQ_API_KEY` | Powers the AI assistant | Only if you want the AI assistant |
| `GROQ_MODEL` | Which Groq model the assistant uses | No — defaults to a current model |
| `CORS_ORIGINS` | Comma-separated list of origins allowed to call this API from a browser | Set to your real frontend domain before deploying; `*` is fine for local dev |

---

## 4. Setup — Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:5173**. Its `.env` already points at `http://localhost:8000`, so it talks to the backend above with no extra config.

### Environment variables (`frontend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Backend base URL, no trailing slash | `http://localhost:8000` |
| `VITE_BUSINESS_NAME` | Shown in the header/footer | `Meridian Clinic` |

---

## 5. Try it end to end

1. Open **http://localhost:5173** — you land in the chat tab by default (needs the Groq key from section 3; without it you'll see a "having trouble connecting" message instead of a real reply).
2. Say hi, tell it you want an appointment, give it a time — it'll check availability, ask for your name/email/reason if it doesn't have them yet, confirm the slot with you, then book it and show a ticket-stub right in the chat.
3. Switch to **"Find my booking"**, paste the confirmation ID, see its status.
4. Click **"Admin sign in"** (top right) → **"Create an admin account instead"** → enter the `ADMIN_KEY` from `backend/.env` (`changeme123` by default) to make your own login. No need to touch Swagger for this.
5. Sign in → you land on the admin dashboard. Accept the booking the chat just created.
6. Go back to the customer side and look that booking up again — status is now "Confirmed."
7. In the admin panel, click the sparkle button bottom-right — that's the *other* assistant, for staff quick-actions like *"is 2pm to 2:30pm tomorrow free?"*.

---

## 6. API reference

All routes live on the backend (default `http://localhost:8000`). Full interactive docs at `/docs`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| POST | `/auth/signup` | admin key | Create a staff/admin account |
| POST | `/auth/login` | none | Get a JWT |
| GET | `/auth/me` | JWT | Current user info |
| POST | `/bookings` | none | Customer creates a booking |
| GET | `/bookings` | JWT | List all bookings (staff) |
| GET | `/bookings/{id}` | none | Public status lookup by ID |
| PATCH | `/bookings/{id}/status` | JWT | Accept / reject / cancel |
| DELETE | `/bookings/{id}` | JWT | Delete a booking |
| POST | `/agent/query` | JWT | Staff natural-language agent action |
| POST | `/public/chat` | none | Customer-facing conversational booking chat |

Every one of these has a matching UI flow — nothing here is Swagger-only.

---

## 7. Deployment

**Backend** → any Python host (Render, Railway, Fly.io, etc.).
- Set `CORS_ORIGINS` to your real frontend domain (not `*`) once you have one.
- Set a real `JWT_SECRET_KEY` and `ADMIN_KEY`, don't ship the placeholders.

**Frontend** → Vercel.
- Framework preset auto-detects as Vite, no config needed.
- Set `VITE_API_URL` to your deployed backend's URL under Project Settings → Environment Variables.
- Set `VITE_BUSINESS_NAME` if you want to rebrand.

---

## 8. Bugs found & fixed along the way

Worth knowing about if you're presenting this or building on it further:

1. **Password hashing crashed on signup.** `passlib` 1.7.4 (the original hashing library) breaks against `bcrypt>=4.1` due to a removed internal attribute it depends on for version detection — a guaranteed crash on any fresh `pip install`. Fixed by calling `bcrypt` directly instead of going through `passlib`.
2. **Booking times displayed hours off from what was entered.** SQLite doesn't preserve timezone info even on a column declared `DateTime(timezone=True)` — timestamps came back from the DB with no timezone tag, so the API returned them without a `Z`/offset suffix, and browsers silently interpreted those as *local* time instead of UTC (e.g. a 1pm IST booking rendered as ~7:30am). Fixed by tagging naive datetimes as UTC before they're serialized in every booking response.
3. **`.env` corruption.** `GROQ_MODEL` and `CORS_ORIGINS` had gotten merged onto one line with no newline between them, so `GROQ_MODEL` was literally set to `llama-3.3-70b-versatilelCORS_ORIGINS=*` — meaningless. Fixed the file formatting.
4. **Deprecated AI model.** The default model (`llama-3.3-70b-versatile`) was deprecated by Groq on June 17, 2026. Swapped the default to `openai/gpt-oss-120b`, their recommended replacement.

None of these require any action from you — they're already fixed in this codebase — but good to know if something like this ever resurfaces after you make your own changes.

---

## 9. Troubleshooting

- **"Couldn't reach the booking service"** in the frontend → backend isn't running, or `VITE_API_URL` doesn't match where it's running.
- **CORS error in browser console** → backend's `CORS_ORIGINS` doesn't include the origin the frontend is served from. `*` fixes it for local dev.
- **Signup says "Invalid admin key"** → check `ADMIN_KEY` in `backend/.env` matches exactly what you're typing.
- **AI assistant says "temporarily unavailable"** → `GROQ_API_KEY` is missing, invalid, or still the placeholder. See section 3.
- **`source: command not found` on Windows** → use `venv\Scripts\Activate.ps1` in PowerShell instead of `source venv/bin/activate` (that's a Mac/Linux command).
