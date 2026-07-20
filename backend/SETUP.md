# Setup Instructions for Agent Backend

## Hospital AI Assistant (Terminal-based Chat)

### Prerequisites
- Python 3.8+ installed
- Groq API Key (get from https://console.groq.com/keys)

### Setup Steps
1. Extract Hospital_AI_Assistant.zip
2. Open terminal/command prompt
3. cd hospital_assistant
4. python -m venv venv
5. Activate:
   - Windows: venv\Scripts\activate
   - Mac/Linux: source venv/bin/activate
6. pip install -r requirements.txt
7. Copy .env.example to .env
8. Edit .env and add your Groq API key:
   GROQ_API_KEY=gsk_your_actual_key_here
9. python app.py
10. Try queries like:
    - "Book appointment with Dr. Aditi Sharma tomorrow at 8 PM"
    - "What medicine for a headache?"
    - "Show me available doctors"
    - Type "exit" to quit

---

## FastAPI Booking Backend (Web API)

### Prerequisites
- Python 3.8+
- Groq API Key (from https://console.groq.com/keys)
- Gmail App Password (optional, only if using email)

### Setup Steps
1. Extract FastAPI_Booking_Backend.zip
2. Open terminal/command prompt
3. cd booking_project
4. python -m venv venv_api
5. Activate:
   - Windows: venv_api\Scripts\activate
   - Mac/Linux: source venv_api/bin/activate
6. pip install -r requirements.txt
7. Copy .env.example to .env
8. Edit .env and fill in your secrets:
   - GROQ_API_KEY=gsk_your_key
   - SMTP_PASSWORD=your_gmail_password
   - JWT_SECRET_KEY=any_random_string
   - ADMIN_KEY=any_secret_key
9. uvicorn main:app --reload
10. Open browser: http://localhost:8000/docs
11. Click "Authorize" button, enter admin key, click Authorize
12. Test endpoints in Swagger:
    - POST /auth/signup (create user with admin key)
    - POST /auth/login (login, get JWT token)
    - POST /bookings (create booking)
    - POST /agent/query (natural language booking)
    - GET /bookings (list bookings)