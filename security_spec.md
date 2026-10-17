# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default Deny & Path Hardening**: Every unmatched path is denied (`allow read, write: if false;`). Every document ID parameter (`{userId}`, `{courseId}`, `{lessonId}`, `{enrollmentId}`, `{progressId}`) is validated with `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
2. **Role & Privilege Escalation Guard**:
   - Admin status (`isAdmin()`) is granted only if the authenticated user has a verified email matching the bootstrapped admin (`shefatahmed5959@gmail.com` with `email_verified == true`) OR exists in `/admins/$(request.auth.uid)`.
   - When a user registers their own `/users/{userId}` document, `userId == request.auth.uid`, and unless `isAdmin()`, `incoming().role == 'student'`.
   - Updating `/users/{userId}` by a non-admin can ONLY modify `['displayName', 'updatedAt']`, preserving `uid`, `email`, `role`, and `createdAt`.
3. **PII Isolation**:
   - `/users/{userId}` contains `email`. Read (`get` and `list`) is strictly limited to `isOwner(userId)` or `isAdmin()`. Blanket `isSignedIn()` reads are forbidden.
4. **Course Integrity & Publication Gate**:
   - Only `isAdmin()` can create, update, or delete `/courses/{courseId}`.
   - Free courses must have `price == 0`. Paid courses must have `price >= 0`.
   - Public users can `get` or `list` `/courses/{courseId}` ONLY when `resource.data.isPublished == true` (or `isAdmin()`). Draft courses are never exposed to non-admins.
5. **Lesson Protection & Master Gate**:
   - Only `isAdmin()` can create, update, or delete `/lessons/{lessonId}`.
   - Every lesson write verifies `exists(/databases/$(database)/documents/courses/$(incoming().courseId))` and validates `youtubeVideoId` matches `^[a-zA-Z0-9_\-]{11}$`.
   - Reading (`get`) a lesson requires `isAdmin()` OR (`resource.data.isPublished == true` AND the user has an active enrollment `/enrollments/$(request.auth.uid + '_' + resource.data.courseId)` with `accessStatus == 'active'`).
   - Listing (`list`) lessons requires `isAdmin()` OR `resource.data.isPublished == true` (for curriculum display on published courses).
6. **Enrollment Duplicate & Paid-Course Gate**:
   - Enrollment document ID must equal `incoming().userId + '_' + incoming().courseId` to prevent duplicate enrollments for the same user and course.
   - A student (`userId == request.auth.uid`) can self-enroll (`create`) ONLY if the target course exists, has `isPublished == true`, `courseType == 'free'`, and `incoming().accessStatus == 'active'`.
   - Paid course enrollments or enrollment status modifications (`active` / `revoked`) can ONLY be created or updated by `isAdmin()`.
7. **Lesson Progress Ownership & Relational Sync**:
   - Progress document ID must equal `incoming().userId + '_' + incoming().lessonId`.
   - Only the owning student (`request.auth.uid == incoming().userId`) with an active enrollment in `incoming().courseId` (or `isAdmin()`) can create or update their progress.
   - `get` and `list` on `/lessonProgress/{progressId}` require `resource.data.userId == request.auth.uid || isAdmin()`.
8. **Temporal Integrity**:
   - Every `create` requires `createdAt == request.time` (or `enrolledAt == request.time` / `completedAt == request.time`) and `updatedAt == request.time`.
   - Every `update` requires `updatedAt == request.time` and preserves immutable creation timestamps and foreign keys.

---

## 2. The "Dirty Dozen" Payloads (Adversarial Test Cases)

1. **Payload 1 (Self-Role Escalation on Create)**: Authenticated student creates `/users/student_1` with `{ uid: "student_1", displayName: "Attacker", email: "a@b.com", role: "admin", createdAt: request.time, updatedAt: request.time }` -> `PERMISSION_DENIED`.
2. **Payload 2 (Self-Role Escalation on Update)**: Authenticated student updates `/users/student_1` changing `role` from `"student"` to `"admin"` -> `PERMISSION_DENIED`.
3. **Payload 3 (PII Horizontal Scraping)**: Authenticated `student_1` attempts `get` or `list` on `/users/student_2` -> `PERMISSION_DENIED`.
4. **Payload 4 (Unverified Admin Email Spoof)**: User with token `{ email: "shefatahmed5959@gmail.com", email_verified: false }` attempts to create a course in `/courses/c1` -> `PERMISSION_DENIED`.
5. **Payload 5 (Shadow Field Injection on Profile)**: Student updates `/users/student_1` with `{ displayName: "New Name", updatedAt: request.time, isVerifiedAdmin: true }` -> `PERMISSION_DENIED`.
6. **Payload 6 (Free Course Non-Zero Price Violation)**: Admin creates `/courses/c_free` with `{ courseType: "free", price: 49, ... }` -> `PERMISSION_DENIED`.
7. **Payload 7 (Draft Course Leak)**: Unauthenticated or student user attempts `get` on `/courses/draft_course` where `isPublished == false` -> `PERMISSION_DENIED`.
8. **Payload 8 (Invalid YouTube Video ID Injection)**: Admin creates `/lessons/l1` with `{ youtubeVideoId: "<script>alert(1)</script>", ... }` -> `PERMISSION_DENIED`.
9. **Payload 9 (Orphaned Lesson Creation)**: Admin creates `/lessons/l1` referencing nonexistent `courseId: "non_existent_course"` -> `PERMISSION_DENIED`.
10. **Payload 10 (Unauthorized Paid Course Self-Enrollment)**: Student creates `/enrollments/student_1_paid_course_1` for a course where `courseType == "paid"` -> `PERMISSION_DENIED`.
11. **Payload 11 (Duplicate Enrollment Bypass)**: Student creates `/enrollments/random_id_999` with `{ userId: "student_1", courseId: "free_course_1" }` bypassing composite key `{userId}_{courseId}` -> `PERMISSION_DENIED`.
12. **Payload 12 (Cross-Student Progress Tampering)**: `student_1` attempts to read or update `/lessonProgress/student_2_lesson_1` -> `PERMISSION_DENIED`.

---

## 3. Test Runner Specification (`firestore.rules.test.ts`)

All 12 adversarial payloads and positive authorized workflows are verified via unit assertions against the rule invariants and validation helpers.
