# Design System & UI/UX Specification (`DESIGN.md`)

## 1. Visual Direction
Lumina Academy follows a clean, editorial educational SaaS aesthetic designed for clarity, high contrast, and distraction-free video learning.

## 2. Color Palette (60-30-10 Allocation)
- **60% Dominant Neutral Canvas**:
  - Page Background: Soft Slate (`#F8FAFC` / `bg-slate-50`)
  - Primary Surface: Crisp White (`#FFFFFF` / `bg-white`)
- **30% Structural Surfaces & Typography**:
  - Primary Ink: Deep Slate (`#0F172A` / `text-slate-900`)
  - Secondary Body Copy: Muted Slate (`#475569` / `text-slate-600`)
  - Hairline Borders: Subtle Slate (`#E2E8F0` / `border-slate-200`)
- **10% Semantic & Action Accents**:
  - Primary Interactive CTA: Indigo (`#4F46E5` / `bg-indigo-600`, hover `bg-indigo-700`)
  - Free Access / Completed State: Emerald (`#047857` / `text-emerald-700`, `bg-emerald-50`)
  - Warning / Draft State: Amber (`#B45309` / `text-amber-700`)
  - Destructive / Error State: Crimson (`#DC2626` / `text-red-600`, `bg-red-50`)

## 3. Typography
- **Sans Font Family (`--font-sans`)**: `Plus Jakarta Sans` (weights 400, 500, 600, 700) loaded via `next/font/google` in `app/layout.tsx`.
- **Monospace & Tabular Figures (`--font-mono`)**: `JetBrains Mono` (weights 400, 500, 600) paired with `tabular-nums` for lesson sequence numbers, prices, completion percentages, and admin counters.

## 4. Component Conventions
- **Top Bar Contract (`components/navbar.tsx`)**:
  - Single-row, 3-zone header (`h-16`) with Brand wordmark on the left, single-line navigation links in the center (`Home`, `Courses`, `Free Courses`, `About`, `Dashboard`), and primary account actions on the right.
- **Zero-Pill Metadata (`components/course-card.tsx`)**:
  - Static metadata (`Category · Free Access · 3 Lessons`) is rendered as clean inline text separated by middle dots (`·`) rather than cluttered pill badges.
- **Resilient Thumbnails (`CourseThumbnail`)**:
  - Every `<img>` specifies `referrerPolicy="no-referrer"`, meaningful `alt` text, and an `onError` state fallback that renders a structured SVG card placeholder if a remote URL fails.

## 5. Responsive Behavior & Accessibility
- **Desktop (`1440px`)**: `max-w-7xl` container, 3-column course grids, 12-column split layouts for Course Details (`8 + 4`), Lesson Player (`8 + 4`), and Dashboards (`3 + 9`).
- **Tablet & Mobile (`390px–768px`)**: Collapsible top navigation menu, collapsible curriculum drawer above the responsive `aspect-video` YouTube player on `/learn/[courseId]`, and single-column stacked cards with no horizontal overflow.
- **Accessibility**: Semantic HTMLlandmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`), explicit `<label htmlFor="...">` bindings on every input, `role="dialog"` with `aria-modal="true"` on confirmation modals, and `role="status"` live toast notifications.
