# AI-based Book Recommendation System (Full Stack)

Monorepo with:

- `frontend/`: React web app (modern UI, dark/light, skeleton loaders, pages)
- `backend/`: Node.js + Express REST API (MongoDB, JWT auth, books, activity, ratings/reviews)
- `ml-service/`: Python FastAPI microservice (TF‑IDF + cosine similarity hybrid recommendations)

## Prerequisites

- Node.js 18+ (recommended 20+)
- Python 3.10+
- MongoDB (local) **or** Docker Desktop (optional, for `docker-compose`)

## Quick start (recommended: Docker for MongoDB)

1. Create environment files (these files do **not** exist by default — you must create them):

### `backend/.env`

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/bookrec
JWT_SECRET=change_me_in_production
ML_SERVICE_URL=http://127.0.0.1:8000
OPENAI_API_KEY=
```

### `ml-service/.env`

```
PORT=8000
BACKEND_URL=http://127.0.0.1:5000
```

### `frontend/.env`

```
VITE_API_BASE_URL=http://127.0.0.1:5000/api
VITE_CHAT_ENABLED=true
```

2. Start MongoDB (choose one):

- Local MongoDB: ensure it’s running at `mongodb://localhost:27017`
- Docker:

```bash
docker compose up -d mongodb
```

3. Install dependencies:

```bash
cd backend && npm install
cd ../ml-service && python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt
cd ../frontend && npm install
```

4. Seed sample data:

```bash
cd backend && npm run seed
```

5. Run services (3 terminals):

```bash
cd backend && npm run dev
```

```bash
cd ml-service && .venv\\Scripts\\activate && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
cd frontend && npm run dev
```

Open the app at `http://127.0.0.1:5173`.

## Where is the frontend?

- The frontend lives in the `frontend/` folder.
- You run it with `cd frontend` then `npm run dev` (after `npm install`).

## Windows / PowerShell run commands (copy/paste)

In **three separate PowerShell terminals** from the repo root (`se project`):

Terminal 1 (backend):

```powershell
cd .\backend
npm install
npm run seed
npm run dev
```

Terminal 2 (ml-service):

```powershell
cd ..\ml-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 3 (frontend):

```powershell
cd ..\frontend
npm install
npm run dev
```

## Accounts

After seeding, you can login with:

- Email: `demo@demo.com`
- Password: `Password123!`

## Features implemented

- Auth (JWT): register/login/me
- Books: list, search (autocomplete), details, trending
- User activity: search history, purchases (simulation), ratings/reviews
- Recommendations: hybrid (content + collaborative + trending + activity signals) using ML microservice
- Chatbot (bonus): optional OpenAI-powered natural language suggestions (backend endpoint)

## Production notes

- Set strong `JWT_SECRET`
- Configure CORS for your domain
- Use HTTPS and secure cookies if switching to cookie auth
- Consider indexing Mongo collections and adding rate limiting

