# Database Architecture & Schema (`DATABASE.md`)

## 1. Database Engines & Synchronization
- **Cloud Firestore**: Provisioned in project `second-gist-57c1c` with database ID `ai-studio-a90bd914-6b7d-4917-9203-78b80a477218` (configured in `firebase-applet-config.json`).
- **Server Persistence Store (`.data/lms-db.json`)**: Used by Next.js Node.js API routes (`lib/server-db.ts`) for atomic server-verified operations and seeded initial courses, synchronized with Cloud Firestore via `lib/lms-client.ts`.

## 2. Collections & Entity Schemas

### 2.1 `users` (`/users/{userId}`)
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `uid` | `string` | `^[a-zA-Z0-9_\-]{1,128}$`, Immutable | Unique user ID matching document ID |
| `displayName` | `string` | `1..100` chars | User's full display name |
| `email` | `string` | `3..254` chars, Immutable for students | Verified email address (PII) |
| `role` | `string` | `'student' \| 'admin'` | Authorization role (`student` on self-registration) |
| `createdAt` | `timestamp` | Immutable | Creation timestamp |
| `updatedAt` | `timestamp` | Server timestamp | Last update timestamp |

### 2.2 `admins` (`/admins/{adminId}`)
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `uid` | `string` | `^[a-zA-Z0-9_\-]{1,128}$` | Administrator user ID |
| `email` | `string` | `3..254` chars | Administrator email |
| `createdAt` | `timestamp` | Immutable | Timestamp granted |

### 2.3 `courses` (`/courses/{courseId}`)
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `^[a-zA-Z0-9_\-]{1,128}$` | Course document ID |
| `title` | `string` | `1..160` chars | Course title |
| `description` | `string` | `1..5000` chars | Full course description |
| `thumbnailUrl` | `string` | `1..500` chars | SVG asset path or image URL |
| `category` | `string` | `1..80` chars | Subject category |
| `courseType` | `string` | `'free' \| 'paid'` | Access tier |
| `price` | `number` | `0` if `free`; `0..100000` if `paid` | Display price in USD |
| `isPublished` | `boolean` | `true \| false` | Catalog visibility flag |
| `createdAt` | `timestamp` | Immutable | Creation timestamp |
| `updatedAt` | `timestamp` | Server timestamp | Last update timestamp |

### 2.4 `lessons` (`/lessons/{lessonId}`)
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `^[a-zA-Z0-9_\-]{1,128}$` | Lesson document ID |
| `courseId` | `string` | Must reference valid course | Parent course ID |
| `title` | `string` | `1..160` chars | Lesson title |
| `youtubeVideoId` | `string` | `^[a-zA-Z0-9_\-]{11}$` | Extracted 11-character YouTube video ID |
| `lessonOrder` | `number` | Integer `1..10000` | Sequence order within course |
| `isPublished` | `boolean` | `true \| false` | Publication status |
| `createdAt` | `timestamp` | Immutable | Creation timestamp |
| `updatedAt` | `timestamp` | Server timestamp | Last update timestamp |

### 2.5 `enrollments` (`/enrollments/{enrollmentId}`)
- **Composite Document ID**: `{userId}_{courseId}` — guarantees at most one enrollment record per `(userId, courseId)` pair.
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Must equal `{userId}_{courseId}` | Composite document ID |
| `userId` | `string` | Valid user ID | Enrolled student ID |
| `courseId` | `string` | Valid course ID | Target course ID |
| `accessStatus` | `string` | `'active' \| 'revoked' \| 'pending'` | Authorization state |
| `enrolledAt` | `timestamp` | Immutable | Initial enrollment timestamp |
| `updatedAt` | `timestamp` | Server timestamp | Last status change timestamp |

### 2.6 `lessonProgress` (`/lessonProgress/{progressId}`)
- **Composite Document ID**: `{userId}_{lessonId}` — guarantees idempotent completion tracking per student and lesson.
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Must equal `{userId}_{lessonId}` | Composite document ID |
| `userId` | `string` | Valid user ID | Student user ID |
| `courseId` | `string` | Valid course ID | Parent course ID |
| `lessonId` | `string` | Valid lesson ID | Target lesson ID |
| `isCompleted` | `boolean` | `true \| false` | Completion state |
| `completedAt` | `timestamp` | Server timestamp | Completion timestamp |
| `updatedAt` | `timestamp` | Server timestamp | Last update timestamp |

## 3. Data Integrity & Cascading Cleanup
- Deleting a course via `DELETE /api/courses/[id]` atomically deletes the course document and cleans up all associated `lessons`, `enrollments`, and `lessonProgress` records.
- Deleting a lesson via `DELETE /api/lessons/[id]` removes the lesson and cleans up associated `lessonProgress` records.
