# Privacy Policy & Architecture Disclosure

**FocusLens** is designed from the ground up with a **privacy-first, zero-knowledge media processing architecture**. Your privacy, video streams, screen data, and audio streams remain strictly confidential and strictly local to your device.

---

## 🔒 1. Local Processing Guarantee (Zero Media Exfiltration)

FocusLens executes all computer vision and speech activity detection **100% inside your local web browser** using Client-Side Artificial Intelligence (MediaPipe & Web APIs).

### What NEVER leaves your browser:
* 📷 **Webcam Video Frames & Face Images**: Raw camera pixels are processed in browser memory and immediately discarded. No video recordings or facial snapshot files are created, saved, or transmitted.
* 🖥️ **Screen Capture Pixels**: Screen stream frames used for activity & movement inference are analyzed strictly in WebGL memory and discarded.
* 🎙️ **Microphone Audio Data**: Audio streams are analyzed locally for energy levels to infer speech activity. Audio is **NEVER recorded, saved, transcribed (no Speech-to-Text), or transmitted**.

> **Zero Cloud Vision/Audio APIs**: FocusLens does NOT send your media to OpenAI, Google Cloud, AWS, or any external machine learning services.

---

## 📊 2. What Data IS Stored

When you are logged into FocusLens, only non-sensitive, aggregated numerical metadata and timeline segment summaries are stored in the PostgreSQL database:

* 👤 **User Identity**: Email address, display name, and salted & hashed password (`scrypt` / `argon2` / `bcrypt` with unique salt).
* ⏱️ **Session Metadata**: Session start/end timestamps, selected target activity (e.g., "Coding", "Reading"), planned duration, and actual duration.
* 📈 **Aggregated Activity Segments**: Categorical activity segment classifications (e.g., `DEEP_WORK`, `PHONE_DISTRACTION`, `AWAY_FROM_DESK`), start/end relative millisecond offsets, confidence scores, and heuristic rule metrics.

---

## 🛡️ 3. Security Controls

* **Secure Authentication**: Authentication utilizes HTTP-only, `SameSite=Lax`, encrypted session cookies. JavaScript code cannot read your authentication cookie, protecting against Cross-Site Scripting (XSS) session theft.
* **Database Isolation**: All backend REST endpoints strictly enforce authorization, ensuring users can only read or modify their own session records.
* **Offline Fallback Storage**: If the backend server is unreachable, session timeline statistics are temporarily cached in your browser's `localStorage` and synchronized automatically upon reconnection.

---

## 🗑️ 4. User Rights & Data Erasure

You own your focus history data.
* **Session Deletion**: You can delete individual session records from your Personal Dashboard at any time.
* **Account Deletion**: Deleting your FocusLens user account permanently deletes all associated session records and activity segment history via cascading database erasure.

---

## 📬 Contact & Inquiries

For security disclosures or privacy inquiries regarding FocusLens, please refer to [SECURITY.md](file:///d:/Focus%20Lens/SECURITY.md) or open an issue on the repository.
