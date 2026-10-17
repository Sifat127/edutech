# System Architecture (`ARCHITECTURE.md`)

## 1. High-Level Architecture
Lumina Academy is a full-stack **Next.js 15 (App Router)** web application written in **TypeScript**, combining:
- **Presentation Layer**: React 19 client components styled with Tailwind CSS 4.
- **Domain & Validation Layer (`lib/lms-logic.ts`)**: Pure, deterministic TypeScript functions for YouTube URL parsing, schema validation, access control checks, and progress calculations.
- **Client Integration Layer (`lib/lms-client.ts` & `lib/firebase.ts`)**: Coordinates Firebase Authentication (`signInWithPopup`, email/password), Cloud Firestore persistence (wrapped with `handleFirestoreError`), and authenticated REST calls to Next.js API routes.
- **Server Runtime Layer (`app/api/*` & `lib/server-db.ts`)**: Node.js API route handlers enforcing server-side token verification, role-based access control (RBAC), atomic cascading deletes, and persistent storage.

## 2. Module Boundaries

```
/
├── app/
│   ├── layout.tsx                 # Root layout, fonts, metadata, LmsProvider wrapper
│   ├── page.tsx                   # Public Homepage
│   ├── about/page.tsx             # Platform & Security Overview page
│   ├── courses/
│   │   ├── page.tsx               # Searchable & filterable Course Catalog
│   │   └── [id]/page.tsx          # Course Details & Curriculum preview
│   ├── login/page.tsx             # Student & Admin Login page
│   ├── register/page.tsx          # Student Registration page
│   ├── forgot-password/page.tsx   # Password Recovery page
│   ├── dashboard/page.tsx         # Protected Student Dashboard
│   ├── learn/[courseId]/page.tsx  # Protected YouTube Embedded Lesson Player
│   ├── admin/page.tsx             # Protected Administrator Console
│   └── api/                       # Server-side REST API routes
│       ├── auth/route.ts
│       ├── courses/route.ts
│       ├── courses/[id]/route.ts
│       ├── lessons/route.ts
│       ├── lessons/[id]/route.ts
│       ├── enrollments/route.ts
│       ├── progress/route.ts
│       └── admin/overview/route.ts
├── components/
│   ├── lms-provider.tsx           # Global React context for auth, courses, enrollments, toasts
│   ├── navbar.tsx                 # 3-zone responsive navigation bar
│   ├── footer.tsx                 # Site footer
│   └── course-card.tsx            # Reusable CourseCard and resilient CourseThumbnail
├── lib/
│   ├── lms-logic.ts               # Pure validation, access control, and YouTube parser
│   ├── lms-logic.test.ts          # Unit tests for pure domain logic
│   ├── firebase.ts                # Firebase App, Auth, Firestore init & handleFirestoreError
│   ├── lms-client.ts              # Client service functions calling /api/* and Firestore
│   └── server-db.ts               # Server persistence, password scrypt hashing, token auth
├── firestore.rules                # Deployed Cloud Firestore Security Rules
├── firestore.rules.test.ts        # Security rule invariant & Dirty Dozen unit tests
└── firebase-blueprint.json        # Entity and collection schema blueprint
```

## 3. Data Flow
1. **Public Browsing**: Client requests `GET /api/courses` or `GET /api/courses/[id]`. Server filters out draft courses for non-admins and strips `youtubeVideoId` from public curriculum summaries (`toPublicCurriculum`).
2. **Authentication**: User signs in via Firebase Google Sign-In (`signInWithPopup`) or Email/Password. The server verifies the token (`authenticateRequest` in `lib/server-db.ts`) and syncs the user profile (`role: 'student'` by default; `'admin'` for bootstrap admin).
3. **Authorized Lesson Playback**: When opening `/learn/[courseId]`, the client calls `GET /api/lessons?courseId=...` with its Bearer token. The server runs `getAuthorizedCourseLessons` to verify an `active` enrollment (or `admin` role) before returning `youtubeVideoId` values.
