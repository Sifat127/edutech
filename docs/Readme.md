# DIU EduTech (`Readme.md`)

## 1. Overview
**DIU EduTech** is a full-stack online learning platform built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS 4**, **Firebase Authentication**, and **Cloud Firestore**. It enables administrators to publish free and paid courses backed by **YouTube Unlisted** video lessons, and allows students to enroll, stream lessons inside an embedded player, and track completion progress.

## 2. Key Capabilities
- **Public Catalog & Curriculum Preview**: Search courses by title or category, filter between Free and Paid tracks, and inspect lesson curricula before enrolling.
- **Role-Based Authentication**: Student registration (default `student` role), Email/Password login, Firebase Google Sign-In (`signInWithPopup`), password reset, and server-verified administrator access.
- **Authoritative Enrollment & Access Control**:
  - Instant student self-enrollment for published **Free** courses.
  - Manual administrator approval and revocation for **Paid** courses (no fake payment gateway).
  - Server-side protection ensuring unpublished lessons and unauthorized YouTube video IDs are never exposed to unentitled users.
- **Embedded YouTube Lesson Player**: Official YouTube embed (`https://www.youtube.com/embed/VIDEO_ID?rel=0`) with desktop curriculum sidebar, mobile collapsible drawer, previous/next navigation, and lesson completion tracking.
- **Administrator Console**: Real-time platform metrics, course CRUD, lesson CRUD with YouTube URL validation and reordering, student directory search, and enrollment management.

## 3. Documentation Index (`/docs`)
1. [PRD.md](./PRD.md) — Product requirements and acceptance criteria.
2. [DESIGN.md](./DESIGN.md) — Design system, typography, color palette, and accessibility.
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — Module boundaries and data flow.
4. [DATABASE.md](./DATABASE.md) — Firestore & server schema, composite keys, and data integrity.
5. [API.md](./API.md) — Server API endpoints, status codes, and payloads.
6. [AGENTS.md](./AGENTS.md) — Coding agent rules and repository conventions.
7. [Project Implementation.md](./Project%20Implementation.md) — Staged implementation roadmap and status.
8. [Setup.md](./Setup.md) — Environment configuration, installation, and startup guide.
9. [Feature Development.md](./Feature%20Development.md) — Feature lifecycle and review checklist.
10. [Authentication & Security.md](./Authentication%20&%20Security.md) — RBAC, Firestore security rules, and threat mitigation.
11. [MCP Connection.md](./MCP%20Connection.md) — MCP configuration and troubleshooting.
12. [Integrations.md](./Integrations.md) — Firebase, Google Identity Toolkit, and YouTube Embed integrations.
13. [Testing & QA.md](./Testing%20&%20QA.md) — Unit tests, security rule tests, and browser verification.
14. [Debugging.md](./Debugging.md) — Structured Firestore error handling and troubleshooting.
