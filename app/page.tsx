'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, PlayCircle, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { CourseCard } from '@/components/course-card';
import { useLms } from '@/components/lms-provider';

export default function HomePage() {
  const { courses, coursesLoading, enrollments } = useLms();

  const enrolledCourseIds = new Set(
    enrollments.filter((e) => e.accessStatus === 'active').map((e) => e.courseId)
  );

  const featuredCourses = courses.slice(0, 3);
  const freeCourses = courses.filter((c) => c.courseType === 'free');
  const recentCourses = [...courses]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <p className="text-xs font-semibold text-indigo-600 tracking-wide">
                  Structured Video Curriculum · Self-Paced Mastery
                </p>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] text-balance">
                  Learn at Your Own Pace
                </h1>
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                  Access structured software engineering, cloud architecture, and interface design
                  courses. Watch distraction-free video lessons directly inside the platform and
                  track your lesson-by-lesson completion progress.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/courses"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Explore Courses</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/courses?type=free"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Browse Free Courses</span>
                  </Link>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-indigo-600" />
                    Official YouTube Embedded Player
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    Instant Free Course Enrollment
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Lesson-by-Lesson Progress Tracking
                  </span>
                </div>
              </div>

              {/* Right Column: Curriculum Preview Card */}
              <div className="lg:col-span-5">
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Curriculum Overview</p>
                      <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                        How DIU EduTech Works
                      </h2>
                    </div>
                    <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
                  </div>

                  <ol className="space-y-4 text-sm">
                    <li className="flex items-start gap-3.5">
                      <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 tabular-nums">
                        01
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">Choose a Course Track</p>
                        <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                          Browse published free and paid courses with transparent curriculum
                          outlines before enrolling.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 tabular-nums">
                        02
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Enroll in Free or Authorized Paid Courses
                        </p>
                        <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                          Students can enroll in free courses with one click. Paid courses are
                          unlocked after administrator verification.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 tabular-nums">
                        03
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Watch Lessons & Track Completion
                        </p>
                        <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                          Stream authorized YouTube Unlisted lessons inside the dedicated learning
                          view and mark lessons complete as you progress.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Courses Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold text-indigo-600">Curated Tracks</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Featured Courses
              </h2>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>View Full Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {coursesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse p-6"
                />
              ))}
            </div>
          ) : featuredCourses.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-sm text-slate-600">No published courses available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isEnrolled={enrolledCourseIds.has(course.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Free Courses Section */}
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Open Access</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                  Free Courses
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Create a free student account and start watching these courses immediately.
                </p>
              </div>
              <Link
                href="/courses?type=free"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <span>All Free Courses</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {coursesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="bg-slate-50 rounded-xl border border-slate-200 h-80 animate-pulse p-6"
                  />
                ))}
              </div>
            ) : freeCourses.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center">
                <p className="text-sm text-slate-600">No free courses are currently published.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {freeCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isEnrolled={enrolledCourseIds.has(course.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recently Added Courses Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold text-indigo-600">Latest Releases</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Recently Added Courses
              </h2>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>Browse All Courses</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {coursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="bg-white rounded-xl border border-slate-200 h-80 animate-pulse p-6"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isEnrolled={enrolledCourseIds.has(course.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
