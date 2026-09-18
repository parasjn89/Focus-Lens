# Google Calendar Integration Setup Guide (FocusLens)

This guide walks you through setting up Google Cloud credentials for the read-only Google Calendar integration in FocusLens.

---

## 1. Create or Select a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select an existing project or click **"New Project"**.
3. Name your project (e.g., `FocusLens`) and click **"Create"**.

---

## 2. Enable the Google Calendar API

1. In the Google Cloud Console, navigate to **APIs & Services > Library**.
2. In the search bar, search for **Google Calendar API**.
3. Select **Google Calendar API** from the results and click **"Enable"**.

---

## 3. Configure the OAuth Consent Screen

1. In the left navigation, go to **APIs & Services > OAuth consent screen**.
2. Select **User Type**:
   - For personal testing / development, select **External** and click **Create**.
3. Fill in the App Information:
   - **App name**: `FocusLens`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Search for and select the following read-only scopes:
     - `https://www.googleapis.com/auth/calendar.readonly` (See and download any calendar you can access using Google Calendar)
     - `https://www.googleapis.com/auth/userinfo.email` (See your primary Google Account email address)
   - Click **Update** and then **Save and Continue**.
6. **Test Users** (Required while the OAuth app is in "Testing" mode):
   - Under **Test users**, click **+ Add Users**.
   - Enter the Google email address(es) you will use to log in and test Google Calendar in FocusLens.
   - Click **Save and Continue**.

---

## 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Set **Name** to `FocusLens Web Client`.
5. Under **Authorized redirect URIs**, click **+ Add URI**:
   - For local development:
     `http://localhost:3001/api/integrations/google-calendar/callback`
   - For production deployment:
     `https://your-domain.com/api/integrations/google-calendar/callback`
6. Click **Create**.
7. A dialog will appear displaying your **Client ID** and **Client Secret**. Copy both values.

---

## 5. Configure Environment Variables

In your local `.env` file (copy from `.env.example` if not already present), set:

```env
# Google Calendar Integration (Read-Only)
GOOGLE_CLIENT_ID=your_google_client_id_from_step_4
GOOGLE_CLIENT_SECRET=your_google_client_secret_from_step_4
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google-calendar/callback

# Optional: 32-byte key for AES-256-GCM token encryption at rest
# If omitted, FocusLens derives a secure key from SESSION_SECRET automatically
GOOGLE_TOKEN_ENCRYPTION_KEY=your_optional_32_byte_key
```

> [!CAUTION]
> Never commit your real Google Client Secret or OAuth credentials to Git. Keep them strictly in your untracked `.env` file.

---

## 6. Verification & Usage

1. Start the FocusLens backend (`npm run server`) and frontend (`npm run dev`).
2. Log into your FocusLens account.
3. Navigate to the **Calendar** page from the sidebar.
4. In the right panel, find the **Google Calendar** card and click **Connect Google Calendar**.
5. Grant read-only access on the Google consent screen.
6. You will be redirected back to the FocusLens Calendar page with a `Connected` status badge and your account email.
7. Scheduled events for any selected date will now appear under **Google Calendar Events**, where you can click **Start Focus Session** to prefill a session with event context.
