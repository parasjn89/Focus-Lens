# FocusLens Security Policy 🛡️

FocusLens is committed to protecting user privacy and ensuring robust open-source security across all software components.

---

## 🔒 Zero-Knowledge Privacy Model

FocusLens enforces a strict architectural boundary between local computer-vision inference and persistent server storage:

### What FocusLens Stores (Metadata Only)
- User Account Credentials: Email address, display name, and salted password hashes (`bcrypt`).
- Focus Session Records: Selected target activity, planned duration, actual duration, paused duration, status (`COMPLETED` / `CANCELLED`), and timestamps.
- Derived Activity Segments: Anonymized signal classification labels (`CODING`, `STUDY_LIKE`, `PHONE_ACTIVITY`, `MULTIPLE_PEOPLE`, `AWAY_OR_NOT_VISIBLE`, `UNKNOWN`), interval timestamps, confidence scores, and heuristic explanations.

### What FocusLens NEVER Stores or Transmits
- **NO Webcam Video**: Live camera streams are processed exclusively in browser memory via MediaPipe vision tasks.
- **NO Camera Frames or Images**: No raw JPEG/PNG images or canvas buffers are uploaded to backend servers.
- **NO Screen Recordings or Screenshots**: Screen content classification runs 100% locally in the user's browser.
- **NO Raw Microphone Audio**: Web Audio API VAD computes volume/spectral feature statistics locally. Audio is never recorded, saved, or uploaded.

---

## 🛡️ Security Protections

1. **Authentication & Session Security**:
   - Server-managed HTTP-only signed cookies (`@fastify/cookie` & `@fastify/session`).
   - Passwords hashed using `bcrypt` with 10 salt rounds. Plaintext passwords are never logged or stored.
   - Rate limiting on authentication endpoints (`@fastify/rate-limit`) to prevent brute-force attacks.

2. **Authorization & IDOR Defense**:
   - Every session endpoint (`/api/sessions/*`) verifies ownership (`session.userId === authenticatedUser.id`).
   - Cross-user session access attempts return `HTTP 404 Not Found` to prevent resource enumeration.

3. **Backend Privacy Guard**:
   - PreValidation hook recursively inspects JSON request bodies. Any request containing forbidden raw media fields (`video`, `image`, `frame`, `screenshot`, `audio`, `audioBlob`, `media`) is immediately rejected with `HTTP 400 Bad Request`.

---

## 📩 Reporting a Vulnerability

If you discover a potential security vulnerability in FocusLens, please do NOT create a public issue on GitHub.

Instead, please report security concerns directly to the project maintainers via email at:
**security@focuslens.dev**

Include:
- Summary of the vulnerability.
- Steps to reproduce or proof-of-concept payload.
- Expected vs. actual behavior.

We appreciate your assistance in keeping FocusLens secure for everyone!
