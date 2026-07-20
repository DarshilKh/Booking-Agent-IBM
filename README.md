# Booking Project

Quickstart below. For full documentation — features, API reference, environment variables, deployment, and known fixes — see **[SETUP.md](./SETUP.md)**.

```bash
# Terminal 1 — backend
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Everything works immediately except the AI assistant, which needs a free Groq API key — see [SETUP.md](./SETUP.md#3-setup--backend) for the 4-step guide.
