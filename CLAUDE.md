# FinFlow — CLAUDE.md

## Project overview
Personal finance + job-hunting web app. Indian market (₹, INR). Deployed on Render.
Monorepo: `client/` (React SPA) + `server/` (Node/Express API) + Python MCP server.

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, Recharts, socket.io-client, Axios |
| Backend | Node.js ESM, Express 4, Socket.io 4, Prisma 5, pg |
| DB | PostgreSQL (Neon) |
| Cache | Upstash Redis |
| AI | Gemini 2.5 Flash (parsing/insights/chat), Groq llama-3.3-70b (job scoring), Ollama local (qwen2.5:1.5/llava) |
| File storage | Cloudinary |
| Browser automation | Playwright (Chromium) |
| Auth | JWT (15m access) + refresh (7d) + MCP token (1y) |
| MCP server | Python FastAPI (`server/main.py`) — separate Render service |

## Dev commands (run from root)
```
npm run dev          # concurrently: server (nodemon) + client (vite)
npm run dev:server   # server only
npm run dev:client   # client only
npm run db:push      # prisma db push
npm run db:generate  # prisma generate
```
Server port: 5000. Client port: 5173.

## Directory map
```
FinFlow/
├── client/src/
│   ├── App.jsx               # routes
│   ├── pages/                # one file per page
│   ├── components/
│   │   ├── layout/Layout.jsx # nav + outlet
│   │   ├── credit-card/      # CC statement flow (multi-step)
│   │   └── jobs/             # job scraper UI
│   ├── store/authStore.js    # Zustand: accessToken, user
│   ├── services/api.js       # axios instance (VITE_API_URL base)
│   ├── services/socket.js    # socket.io client singleton
│   └── context/SocketContext.jsx
├── server/src/
│   ├── index.js              # express + socket.io bootstrap
│   ├── controllers/          # business logic
│   ├── routes/               # route definitions
│   ├── services/
│   │   ├── db.js             # prisma singleton
│   │   ├── ollamaService.js  # ollamaGenerate(), ollamaChat()
│   │   ├── textToSqlService.js # agentAnswer() — agentic Text-to-SQL
│   │   ├── jobScraperService.js # Playwright scraper (4 platforms)
│   │   ├── jobScoringService.js # scoreJobs() — Groq/Ollama
│   │   ├── cloudinaryService.js
│   │   ├── socketService.js  # JWT-authenticated socket rooms
│   │   ├── platformSessionService.js # Playwright login sessions
│   │   └── pushService.js    # web-push VAPID
│   └── middleware/auth.js    # authenticateToken (Bearer JWT)
└── server/prisma/schema.prisma
```

## DB schema (condensed)
```
User         id(cuid) email! password name
Budget       id name amount spent category month(1-12) year userId
Transaction  id description amount type(income|expense) category date source(manual|ai_parsed|credit_card) userId budgetId?
Loan         id name type(home|car|personal|education|other) principal outstanding emi interestRate tenureMonths startDate userId
PushSub      endpoint p256dh auth userId
RefreshToken token expiresAt userId
McpToken     token expiresAt userId (unique per user)
UserJobProfile userId skills[] experienceYears targetRole preferredLocations[] summary?
JobPost      title company location? url description? platform salary? postedAt? score? scoreDetails(Json)? status(new) sessionId? screenshotUrl? userId
UserPlatformSession userId platform(linkedin|naukri|indeed|glassdoor) storageState(Text) [unique userId+platform]
```
Categories: `Food | Transport | Shopping | Entertainment | Health | Utilities | Salary | Other`

## API routes (all require `Authorization: Bearer <token>` except /auth)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/mcp-token
POST   /api/auth/mcp-token/revoke
PUT    /api/auth/profile

GET    /api/budgets
POST   /api/budgets
PUT    /api/budgets/:id
DELETE /api/budgets/:id

GET    /api/transactions          ?category&type&startDate&endDate
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id
DELETE /api/transactions          (bulk delete)

POST   /api/ai/parse-statement    multipart file (Gemini PDF | Ollama image)
POST   /api/ai/parse-credit-statement  multipart up to 50MB
GET    /api/ai/insights           header x-ai-provider: gemini|ollama
POST   /api/ai/chat               {messages:[]} header x-ai-provider: gemini|ollama

GET    /api/loans
POST   /api/loans
PUT    /api/loans/:id
DELETE /api/loans/:id

GET    /api/jobs/profile
POST   /api/jobs/profile
GET    /api/jobs/platforms
POST   /api/jobs/platforms/:platform/connect
DELETE /api/jobs/platforms/:platform
POST   /api/jobs/scrape           header x-ai-provider: groq|ollama (async, fires socket events)
GET    /api/jobs                  ?sessionId&minScore&platform&status
DELETE /api/jobs                  ?sessionId&platform
GET    /api/jobs/sessions
GET    /api/jobs/:id
POST   /api/jobs/:id/screenshot   (async recapture)
PATCH  /api/jobs/:id/status
DELETE /api/jobs/sessions/:sessionId
DELETE /api/jobs/:id

GET    /api/tools/pdf-unlock      (PDF password removal)
POST   /api/push/subscribe
POST   /api/shortcuts             (Apple Shortcuts webhook)
GET    /health
```

## AI provider routing
All AI calls use `x-ai-provider` header to switch:
- `gemini` → Google Gemini 2.5 Flash (model: `gemini-2.5-flash`)
- `ollama` → Local Ollama at `http://localhost:11434` (text: `qwen2.5:1.5`, vision: `llava`)
- `groq` → Groq API (`llama-3.3-70b-versatile`) — used only for job scoring

Default per endpoint: parse-statement→gemini, insights→gemini, chat→ollama(Text-to-SQL agent), scrape→groq.

## Text-to-SQL agent (`textToSqlService.js`)
Two-step agentic loop:
1. Router prompt → Ollama returns `QUERY: <sql>` or `ANSWER: <text>`
2. If QUERY: validate (SELECT-only, userId scoped, allowed tables only), execute via `prisma.$queryRawUnsafe`, feed result back to Ollama for NL summary
Allowed tables in queries: `Transaction`, `Budget`, `Loan`. Blocked: `User`, `PushSubscription`, `RefreshToken`, `McpToken`.

## Job scraper pipeline (`POST /api/jobs/scrape`)
1. Fire-and-forget after 200 response
2. Playwright scrapes LinkedIn, Naukri, Indeed, Glassdoor (20 jobs each, 45s timeout per platform)
3. AI scores all jobs (Groq or Ollama) — rubric: skillsMatch(0-40), roleMatch(0-30), experienceMatch(0-20), locationMatch(0-10)
4. Persist to `JobPost` table
5. Background screenshot capture via Cloudinary (3 pages parallel), emit `job:screenshot_ready` per job
Socket events: `scraper:start` `scraper:platform` `scraper:status` `scraper:screenshot` `scraper:scoring` `scraper:job_scored` `scraper:complete` `scraper:error`

## Socket.io
- Server authenticates via JWT in `socket.handshake.auth.token`
- Each user joins a room keyed by their userId
- Emit to user: `io.to(userId).emit(event, data)`
- Client: socket singleton at `client/src/services/socket.js`

## Auth flow
- access token: 15m, in Zustand store (`authStore.js`)
- refresh token: 7d, via `POST /api/auth/refresh`
- MCP token: 1y JWT `{id, scope:'mcp', type:'persistent'}` — Python server does DB revocation check

## Client routing (React Router v6)
All protected routes under `<Layout>` (requires `accessToken` in Zustand):
```
/              DashboardPage
/budgets       BudgetsPage
/transactions  TransactionsPage
/upload        UploadPage          (bank statement → AI parse)
/insights      InsightsPage        (AI insights cards)
/loans         LoansPage
/profile       ProfilePage
/tools         ToolsPage           (tools hub)
/tools/pdf-unlocker    PDFUnlockerPage
/tools/connect-claude  ConnectClaudePage  (MCP token setup)
/tools/finbot          OllamaChatPage    (FinBot chat)
/tools/jobs            JobsPage          (job scraper)
/tools/jobs/:id        JobDetailPage
/credit-card   CreditCardPage      (CC statement parser, multi-step)
/login  /register  (public)
```

## Key env vars (server/.env)
```
DATABASE_URL, DIRECT_URL      Neon Postgres
JWT_SECRET, JWT_REFRESH_SECRET
GEMINI_API_KEY                Google AI
GROQ_API_KEY                  Groq (job scoring)
GROQ_SCORING_MODEL            default: llama-3.3-70b-versatile
CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET
VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT
UPSTASH_REDIS_REST_URL/TOKEN
CLIENT_URL                    CORS whitelist
```
Client env: `VITE_API_URL` (points to Express server).

## Deployment (Render)
- `finflow-server` — Docker, `server/Dockerfile`
- `finflow-client` — static, `client/dist`
- `finflow-mcp` — Python, `server/main.py` + `server/requirements.txt`
Prod client URL: `https://finflow-client-hbgk.onrender.com`
Prod server URL: `https://finflow-server-hpkb.onrender.com`

## Coding conventions
- Server: ESM (`"type":"module"`), named exports, async/await, no try-catch wrapping unless needed
- Client: functional components, Tailwind classes only, no CSS files (except `index.css`)
- State: Zustand for auth; local `useState` for everything else
- No TypeScript; no test files; no comments unless explaining non-obvious why
- Prisma client imported via `import { prisma } from '../services/db.js'`
- Rate limit: 100 req / 15 min global
- File uploads: multer memoryStorage (10MB default, 50MB for credit card statements)
