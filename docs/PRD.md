# Product Requirements Document (`PRD.md`)

## 1. Product Vision & Overview
**DIU EduTech** is a modern, self-paced online learning management system offering both **free** and **paid** technical courses powered by **YouTube Unlisted** video lessons, **Firebase Authentication**, **Cloud Firestore**, and a **Next.js 15** server runtime.

## 2. Target Personas
1. **Student (`role: "student"`)**:
   - Registers or logs in via Email/Password or Google Sign-In.
   - Browses published free and paid courses in the public catalog.
   - Enrolls immediately in published free courses.
   - Views course curricula and accesses paid courses after administrator approval.
   - Watches authorized lessons in the embedded YouTube player and tracks completion progress.
2. **Administrator (`role: "admin"`)**:
   - Creates, edits, publishes/unpublishes, and deletes courses.
   - Adds, edits, reorders, publishes/unpublishes, and deletes lessons using validated YouTube watch or `youtu.be` URLs.
   - Views registered students, searches by name or email, and manually grants or revokes course enrollments.

## 3. Core Functional Requirements & Acceptance Criteria

### 3.1 Public Website
- **Homepage (`/`)**:
  - Top navigation bar (`Home`, `Courses`, `Free Courses`, `About`, `Login`, `Sign Up` / Dashboard link).
  - Hero section with headline `"Learn at Your Own Pace"` and `"Explore Courses"` CTA.
  - Featured Courses, Free Courses, and Recently Added Courses sections.
- **Course Catalog (`/courses`)**:
  - Live client/query search by title, description, or category.
  - Segmented filter for `All Courses`, `Free`, and `Paid`.
  - Course cards displaying thumbnail, category, access tier (`Free Access` vs `Paid · $price`), lesson count, and `View Course` button.
- **Course Details (`/courses/[id]`)**:
  - Displays thumbnail, title, description, access tier, price, and ordered published curriculum (without exposing raw `youtubeVideoId` to unauthorized users).
  - Shows `Enroll Now` for free courses, `Purchase Course` (opening the administrator approval instructions modal without fake payment gateways) for paid courses, and `Start Learning` / `Continue Learning` for enrolled students.

### 3.2 Authentication & Authorization
- Supports Email/Password registration, login, logout, password reset, and Firebase Google Sign-In (`signInWithPopup`).
- All newly registered accounts receive `role: "student"` by default.
- Users cannot escalate their own role to `admin` via client payloads or profile updates.
- Bootstrap administrator (`shefatahmed5959@gmail.com` and `admin@lumina.edu`) has verified `admin` access.

### 3.3 Student Dashboard (`/dashboard`)
- Tabs: `Overview`, `My Courses`, `Explore Courses`, `Free Courses`, `Profile`, and `Logout`.
- Displays real completion percentages calculated from completed lessons vs. published lessons.
- Lists recently completed lessons with direct links to rewatch.

### 3.4 Course Learning Player (`/learn/[courseId]`)
- Renders authorized lessons using the official YouTube embed format: `https://www.youtube.com/embed/VIDEO_ID?rel=0`.
- Provides `Previous Lesson`, `Next Lesson`, and `Mark as Complete` controls.
- Desktop curriculum sidebar and mobile collapsible lesson drawer with zero horizontal overflow.

### 3.5 Administrator Console (`/admin`)
- Tabs: `Overview`, `Courses`, `Lessons`, `Students`, `Enrollments`, `Settings`, and `Logout`.
- Enforces server-verified admin checks (`401`/`403`) on all mutations.
