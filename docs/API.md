# Backend API Reference (`API.md`)

## 1. Authentication & Headers
Protected endpoints accept an HTTP `Authorization: Bearer <token>` header, where `<token>` is either:
1. A server-signed HMAC session token (`lms.<payload>.<signature>`), or
2. A Firebase Authentication ID token verified against Google Identity Toolkit (`accounts:lookup`).

## 2. Standard HTTP Status Codes
- `200 OK`: Successful read or update.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation error (malformed YouTube URL, invalid price, missing required fields).
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Authenticated user lacks required role (`admin`) or active course enrollment.
- `404 Not Found`: Target course, lesson, or user does not exist.
- `409 Conflict`: Duplicate registration email or duplicate active course enrollment.
- `500 Internal Server Error`: Unexpected server error (sanitized; never leaks stack traces or secrets).

---

## 3. Endpoints

### 3.1 `GET /api/auth` & `POST /api/auth`
- **`GET /api/auth`**: Returns `{ user: UserProfile }` for the current Bearer token (`200` or `401`).
- **`POST /api/auth`**:
  - `action: "register"`: Validates `displayName`, `email`, `password`. Forces `role: "student"` (unless bootstrap admin email). Returns `201` `{ user, token }` or `409` on duplicate email.
  - `action: "login"`: Verifies credentials. Returns `200` `{ user, token }` or `401`.
  - `action: "firebase-sync"`: Verifies Firebase ID token from `Authorization` header and returns `200` `{ user, token }`.
  - `action: "reset-password"`: Records password reset timestamp and returns `200` `{ message }`.
  - `action: "update-profile"`: Updates caller's `displayName`. Rejects any attempt to alter `role` (`403`).

### 3.2 `GET /api/courses` & `POST /api/courses`
- **`GET /api/courses`**:
  - Query params: `search` (optional), `type` (`all | free | paid`), `includeAll` (`1` for admins).
  - Returns `{ courses: EnrichedCourse[] }` (`200`). Draft courses are excluded for non-admins.
- **`POST /api/courses`** (Admin only):
  - Validates payload via `validateCourseInput`. Enforces `price === 0` for `free` courses. Returns `201` `{ course }`.

### 3.3 `GET / PATCH / DELETE /api/courses/[id]`
- **`GET /api/courses/[id]`**:
  - Returns `{ course, curriculum, enrollment, progress }` (`200`). `curriculum` uses `toPublicCurriculum` so `youtubeVideoId` and unpublished lessons are never exposed publicly.
- **`PATCH /api/courses/[id]`** (Admin only):
  - Updates course fields or toggles `isPublished`. Returns `200` `{ course }`.
- **`DELETE /api/courses/[id]`** (Admin only):
  - Deletes course and cascades cleanup to lessons, enrollments, and progress. Returns `200` `{ deleted: true, courseId }`.

### 3.4 `GET / POST /api/lessons` & `PATCH / DELETE /api/lessons/[id]`
- **`GET /api/lessons?courseId={id}`** (Authenticated & Authorized only):
  - Verifies active enrollment (or `admin` role) via `getAuthorizedCourseLessons`. Returns `200` `{ course, lessons, enrollment, progress }` or `401`/`403`.
- **`POST /api/lessons`** (Admin only):
  - Extracts and validates 11-char `youtubeVideoId` from `youtubeUrl` via `extractYouTubeVideoId`. Verifies parent course exists (`404`). Returns `201` `{ lesson }`.
- **`PATCH /api/lessons/[id]`** & **`DELETE /api/lessons/[id]`** (Admin only):
  - Updates lesson metadata/order/publication (`200`) or deletes lesson (`200`).

### 3.5 `GET / POST /api/enrollments`
- **`GET /api/enrollments`**: Returns caller's enrollments (or all enrollments when `?all=1` as admin).
- **`POST /api/enrollments`**:
  - Student caller: Enrolls in a published `free` course (`201`), blocks `paid` self-enrollment (`403`), and rejects duplicates (`409`).
  - Admin caller (`{ userId, courseId, accessStatus }`): Grants (`active`) or revokes (`revoked`) access for any course (`200`/`201`).

### 3.6 `GET / POST /api/progress`
- **`GET /api/progress`**: Returns authenticated user's `LessonProgress[]`.
- **`POST /api/progress`**: Verifies active enrollment in `courseId`, updates `{userId}_{lessonId}` completion status, and returns `{ record, summary }` (`200`).

### 3.7 `GET /api/admin/overview`
- Requires verified `admin` role (`401`/`403`). Returns platform statistics and management lists (`courses`, `lessons`, `users`, `enrollments`, `progressRecords`).
