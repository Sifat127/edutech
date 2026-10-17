# Authentication & Security Architecture (`Authentication & Security.md`)

## 1. Identity & Session Verification
Lumina Academy implements defense-in-depth authentication across client and server:
1. **Firebase Authentication (`lib/firebase.ts`)**:
   - Supports Google OAuth (`signInWithPopup`) and Email/Password authentication.
   - Server API routes verify Firebase ID tokens directly against Google's Identity Toolkit REST API (`https://identitytoolkit.googleapis.com/v1/accounts:lookup`).
2. **Server-Signed HMAC Session Tokens (`lib/server-db.ts`)**:
   - Passwords for email/password accounts are salted and hashed using Node's native `crypto.scryptSync` (`64-byte` key length) and compared using `crypto.timingSafeEqual`.
   - Sessions use HMAC-SHA256 signed tokens (`lms.<base64url-payload>.<signature>`) transmitted via `Authorization: Bearer <token>`.

## 2. Role-Based Access Control (RBAC)
- **Default Student Role**: Every self-registered account is assigned `role: "student"` on the server (`app/api/auth/route.ts`) and enforced in `firestore.rules` (`incoming().role == 'student'`).
- **Privilege Escalation Prevention**:
  - Client-supplied `role` fields during registration or profile updates are rejected (`403 Forbidden`).
  - Only the bootstrap administrator (`shefatahmed5959@gmail.com` with `email_verified == true` or `admin@lumina.edu`) and records in `/admins/{adminId}` have `admin` privileges.

## 3. Course & Video Lesson Protection
- **Draft Isolation**: Unpublished courses (`isPublished: false`) and unpublished lessons are hidden from non-admin queries at both the API and Firestore rule layers.
- **YouTube Video ID Protection**:
  - Public course detail endpoints (`GET /api/courses/[id]`) return `toPublicCurriculum(lessons)`, which strips `youtubeVideoId` from the response.
  - Full lesson records containing `youtubeVideoId` are returned by `GET /api/lessons` and `/lessons/{lessonId}` ONLY when `canAccessCourseLessons` confirms the user is an `admin` or holds an `active` enrollment.
- **YouTube Unlisted Disclosure**: YouTube Unlisted videos allow playback to anyone who possesses the direct YouTube URL. Platform access control protects lesson discovery, curriculum metadata, and progress tracking routes.

## 4. Firestore Security Rules (`firestore.rules`)
- Default-deny catch-all (`match /{document=**} { allow read, write: if false; }`).
- Strict evaluation order: Authentication (`isSignedIn()` / `isVerifiedUser()`) -> Static Blueprint Validation (`isValidId()` & `isValid[Entity]()`) -> Relational Database Lookups (`exists()` / `get()`).
- Verified against the 12 adversarial "Dirty Dozen" payloads in `firestore.rules.test.ts`.
