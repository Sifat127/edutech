# Debugging & Troubleshooting Guide (`Debugging.md`)

## 1. Diagnostics & Structured Error Handling

### 1.1 Firestore Permission & Network Errors (`handleFirestoreError`)
All client-side Firestore operations in `lib/firebase.ts` and `lib/lms-client.ts` wrap errors using `handleFirestoreError(error, operationType, path)`, which logs and throws a structured `FirestoreErrorInfo` JSON payload containing:
- `error`: Original error message
- `operationType`: `'create' | 'update' | 'delete' | 'list' | 'get' | 'write'`
- `path`: Target collection/document path
- `authInfo`: Current `userId`, `email`, `emailVerified`, and `providerInfo`

### 1.2 Startup Connection Probe
When the client boots (`lib/firebase.ts`), `testFirestoreConnection()` calls `getDocFromServer(doc(db, 'test', 'connection'))`. If the client is offline or misconfigured, it logs `"Please check your Firebase configuration."`

## 2. Common Issues & Resolutions

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| `400 Bad Request` when adding a lesson | Administrator pasted full `<iframe>` HTML or a non-YouTube URL | Paste a standard `https://www.youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID` URL. |
| `400 Bad Request` when saving a Free course | Course `price` was greater than `0` while `courseType` was `'free'` | Set `price` to `0` for free courses (the Admin Course form automatically resets price to `0` when switching to Free). |
| `403 Forbidden` when opening `/learn/[courseId]` | Student is not enrolled, or enrollment `accessStatus` is `'revoked'` | For free courses, click **Enroll Now**. For paid courses, grant active access in **Admin Dashboard → Enrollments**. |
| `409 Conflict` when enrolling | Student already has an active enrollment for `{userId}_{courseId}` | Navigate directly to `/learn/[courseId]` to watch lessons. |
| Stale UI in AI Studio preview (`DISABLE_HMR=true`) | Hot Module Replacement is disabled in the container | Restart the dev server after code edits and reload the page. |
