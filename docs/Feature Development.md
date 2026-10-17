# Feature Development Guide (`Feature Development.md`)

## 1. Feature Lifecycle
Every new feature or modification follows a 6-step engineering workflow:
1. **Inspect**: Review `lib/lms-logic.ts`, `firebase-blueprint.json`, `firestore.rules`, and existing API/UI modules.
2. **Model & Validate**: Add pure input validation and authorization functions in `lib/lms-logic.ts` before writing UI or API handlers.
3. **Unit Test**: Add deterministic test cases in `lib/lms-logic.test.ts` and `firestore.rules.test.ts`, then run `node --test`.
4. **Backend & Security Rules**: Update `app/api/*` endpoints and `firestore.rules` (if Firestore schemas change), then lint rules via `npx eslint firestore.rules`.
5. **Frontend Integration**: Connect React components via `lib/lms-client.ts` and `components/lms-provider.tsx` with loading, empty, error, and success states.
6. **End-to-End Verification**: Compile (`npm run build`), verify in headless Chromium across desktop and mobile viewports, and update `/docs/`.

## 2. Pull Request & Review Checklist
- [ ] All interactive controls (`<button>`, `<a>`, `<form>`) have working handlers and accessible labels.
- [ ] Server-side authorization (`authenticateRequest`) enforces `student` vs `admin` permissions.
- [ ] Free courses enforce `price === 0`; paid courses require active enrollment before exposing `youtubeVideoId`.
- [ ] `node --test lib/lms-logic.test.ts firestore.rules.test.ts` passes with 0 failures.
- [ ] `npx eslint firestore.rules` and `npm run build` succeed cleanly.
