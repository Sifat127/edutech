# Testing & Quality Assurance (`Testing & QA.md`)

## 1. Test Strategy
Lumina Academy employs a three-tier verification strategy:
1. **Pure Domain & Validation Unit Tests (`lib/lms-logic.test.ts`)**:
   - Executed via Node's native test runner (`node --test`).
   - Covers YouTube URL extraction (`watch?v=`, `youtu.be/`, `embed/`), rejection of HTML `<iframe ...>` and invalid domains, free vs. paid course price validation, duplicate enrollment prevention, paid course access gates, and completion percentage math.
2. **Firestore Security Rule & Adversarial Payload Tests (`firestore.rules.test.ts`)**:
   - Verifies that `firestore.rules` contains all required collection match blocks and evaluates all 12 "Dirty Dozen" adversarial payloads (role escalation, PII horizontal scraping, unverified admin email spoofing, shadow field injection, free course non-zero price, draft course leaks, invalid YouTube IDs, orphaned lessons, unauthorized paid self-enrollment, composite ID bypass, and cross-student progress tampering), asserting `PERMISSION_DENIED` on every attack.
   - Linted statically via `@firebase/eslint-plugin-security-rules` (`npx eslint firestore.rules`).
3. **End-to-End Browser Verification (`playwright-cli`)**:
   - Tests rendered UI across desktop (`1440x900`) and mobile (`390x844`) viewports, verifying public catalog search/filtering, course details, student authentication, free course enrollment, embedded YouTube lesson playback, lesson completion tracking, and admin course/lesson/enrollment management.

## 2. Running the Test Suite
```bash
# 1. Run all unit & security rule tests
node --test lib/lms-logic.test.ts firestore.rules.test.ts

# 2. Lint Firestore security rules
npx eslint firestore.rules

# 3. Run Next.js production build & TypeScript check
npm run build
```
