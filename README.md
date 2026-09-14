# FocusLens 👁️

> **Privacy-First AI Focus & Productivity Analytics Engine**

FocusLens is an open-source focus monitoring application designed to assist users in building deep work habits while strictly guaranteeing **100% On-Device Local Privacy**.

All computer vision inference (MediaPipe face detection, person counter, cell phone tracker, head orientation estimation), screen activity classification, and audio VAD speech-like activity detection execute **locally in the user's browser**. Raw media streams (webcam, screen, audio) NEVER leave the device.

---

## 🏗️ System Architecture

```
                                  BROWSER (Client-Side)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   Webcam Stream ─────► MediaPipe Vision (Face/Object/Pose)  ──┐                        │
│   Screen Capture ────► Canvas & Rule-based Classifier ───────┼──► Activity Analyzer    │
│   Microphone ────────► Web Audio API VAD (Audio Features) ────┘            │           │
│                                                                            ▼           │
│                                                            Derived Metadata Segments   │
└────────────────────────────────────────────────────────────────────────────┬───────────┘
                                                                             │
                                                                       REST API (JSON)
                                                                (HTTP-Only Cookie Auth)
                                                                             │
                                  BACKEND & DATABASE                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   React Frontend ───► Fastify REST API ───► Privacy Guard ───► Drizzle ORM ───► PostgreSQL│
│   (Dashboard/Auth)   (Session & RateLimit) (IDOR Protected)                            │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Strict Privacy Architecture

FocusLens is built around a non-negotiable zero-knowledge privacy constraint:

1. **Local Media Processing**: Raw webcam frames, video tracks, screen recordings, screenshots, and audio buffers are processed entirely inside browser memory.
2. **Metadata-Only Backend**: The Fastify backend API accepts derived statistical metadata only (e.g. activity timestamps, confidence levels, contributing signal labels).
3. **Backend Privacy Guard**: Fastify middleware inspects incoming JSON payloads and strictly rejects (HTTP 400) any payload containing raw media keys (`video`, `image`, `frame`, `screenshot`, `audio`, `audioBlob`, `media`).
4. **Cookie Authentication & IDOR Defense**: User sessions use server-signed HTTP-only cookies. Session ownership is verified on all endpoints (`session.userId === authenticatedUser.id`), preventing cross-user data leakage.
5. **Offline Resilience**: If the PostgreSQL backend server is offline or unreachable, focus sessions continue seamlessly. Session metadata is cached locally in `localStorage` and automatically synced via background retry worker when connection is restored.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher

### 2. Environment Configuration
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables:
```env
PORT=3001
HOST=127.0.0.1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/focuslens
SESSION_SECRET=focuslens_super_secret_session_key_32_chars_min!
VITE_API_BASE_URL=http://localhost:3001
```

---

## 🗄️ Database Setup & Migrations

FocusLens uses **Drizzle ORM** with **PostgreSQL**.

### Create Database & Apply Migrations
```bash
npm run db:migrate
```

### Inspect Database Schema with Drizzle Studio
```bash
npm run db:studio
```

---

## 💻 Running Locally

### Start Backend Server (Fastify + Drizzle)
```bash
npm run server
```
*Backend runs at `http://127.0.0.1:3001`*

### Start Frontend Dev Server (Vite + React)
```bash
npm run dev
```
*Frontend runs at `http://localhost:5173`*

---

## 🧪 Automated Testing

Execute the automated test suite verifying Fastify authentication routes, bcrypt password hashing, IDOR session authorization, and Privacy Guard media payload rejection:

```bash
npm run test
```

---

## 📦 Production Build

Validate and build the production bundle:

```bash
npm run build
```

---

## 🌐 REST API Specifications

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint reporting server & PostgreSQL connection status |
| `POST` | `/api/auth/register` | User registration (Email, Password, Name) |
| `POST` | `/api/auth/login` | User login (Establishes HTTP-only session cookie) |
| `POST` | `/api/auth/logout` | Session destruction and logout |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `DELETE` | `/api/account` | Permanently delete user account and cascaded sessions |
| `GET` | `/api/analytics/dashboard` | Fetch personal dashboard metrics (Today, Weekly 7-day, Monthly) |
| `POST` | `/api/sessions` | Create a focus session (authenticated user ownership) |
| `GET` | `/api/sessions` | Retrieve paginated history of user's focus sessions |
| `GET` | `/api/sessions/:id` | Fetch session details and activity segments (ownership verified) |
| `POST` | `/api/sessions/:id/segments` | Save derived activity segments (Privacy Guard checked) |
| `PUT` | `/api/sessions/:id` | Finalize session duration and status (`COMPLETED` / `CANCELLED`) |
| `DELETE` | `/api/sessions/:id` | Delete a focus session record |

---

## 📜 Privacy & Licensing

- 🔒 Read our detailed **[Privacy Policy & Architecture Disclosure](file:///d:/Focus%20Lens/PRIVACY.md)**.
- 🛡️ View our **[Security Policy](file:///d:/Focus%20Lens/SECURITY.md)**.
- 📄 FocusLens is open-source under the **[MIT License](file:///d:/Focus%20Lens/LICENSE)**.

