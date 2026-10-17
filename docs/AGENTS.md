# Coding Agent Rules & Conventions (`AGENTS.md`)

## 1. Core Principles
1. **Inspect Before Modifying**: Always inspect existing modules (`lib/lms-logic.ts`, `lib/server-db.ts`, `lib/lms-client.ts`, `firestore.rules`) before introducing new files or changing behavior.
2. **Preserve Decoupled Business Logic**: Keep pure validation, YouTube URL extraction, access control, and progress calculations in `lib/lms-logic.ts` so they remain unit-testable via `node --test`.
3. **Never Trust Client Claims**: Role verification (`student` vs `admin`) and paid course enrollment checks must always be enforced on the server (`app/api/*`) and in `firestore.rules`.
4. **Synchronize Schema & Security Rules**: Any change to entity fields must be updated in `firebase-blueprint.json`, `firestore.rules`, `lib/lms-logic.ts`, and `/docs/DATABASE.md`, followed by running `npx eslint firestore.rules` and deploying rules.

## 2. UI & Styling Standards
- Maintain the light theme (`bg-slate-50` canvas, `bg-white` cards, `border-slate-200` borders, `bg-indigo-600` primary actions).
- Adhere to the 3-zone Top Bar Contract in `components/navbar.tsx`.
- Render static card metadata as clean unboxed text with `·` separators (`components/course-card.tsx`).
- Never introduce fake payment forms, fake testimonials, or unverified external placeholder images.

## 3. Verification Commands
- **Unit & Security Rule Tests**: `node --test lib/lms-logic.test.ts firestore.rules.test.ts`
- **Firestore Rules Lint**: `npx eslint firestore.rules`
- **Application Lint & Typecheck**: `npm run lint` and `npm run build`
