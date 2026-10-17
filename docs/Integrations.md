# Third-Party Integrations (`Integrations.md`)

## 1. Active Integrations

### 1.1 Firebase Authentication & Google Identity Toolkit
- **Purpose**: User authentication (`signInWithPopup` with Google, email/password authentication) and server-side ID token verification.
- **Configuration**: Loaded from `/firebase-applet-config.json` (`projectId: "second-gist-57c1c"`).
- **Server Verification Endpoint**: `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}` called in `lib/server-db.ts`.

### 1.2 Cloud Firestore
- **Purpose**: Document database for `users`, `admins`, `courses`, `lessons`, `enrollments`, and `lessonProgress`.
- **Database ID**: `ai-studio-a90bd914-6b7d-4917-9203-78b80a477218`.
- **Error Handling**: All client-side Firestore calls in `lib/lms-client.ts` are wrapped with `handleFirestoreError` (`lib/firebase.ts`) to emit structured `FirestoreErrorInfo` JSON diagnostics on permission or network failures.

### 1.3 YouTube Official IFrame Embed Player
- **Purpose**: Streams authorized course lessons directly inside `/learn/[courseId]`.
- **Supported Input Formats**:
  - `https://www.youtube.com/watch?v=VIDEO_ID`
  - `https://youtu.be/VIDEO_ID`
  - `https://www.youtube.com/embed/VIDEO_ID`
- **Validation**: `extractYouTubeVideoId` (`lib/lms-logic.ts`) validates the hostname (`youtube.com`, `youtu.be`, `youtube-nocookie.com`) and extracts the strict 11-character video ID (`^[a-zA-Z0-9_-]{11}$`), rejecting raw `<iframe>` HTML or third-party domains.
- **Embed URL Format**: `https://www.youtube.com/embed/VIDEO_ID?rel=0`.

## 2. Planned Future Integrations
- **Payment Gateway Webhook (TODO)**: Server-side payment confirmation webhook (`/api/webhooks/payments`) to automatically create or activate paid course enrollments in `enrollments/{userId}_{courseId}` after verified payment.
