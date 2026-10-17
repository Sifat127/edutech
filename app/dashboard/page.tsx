'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Gift,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  PlayCircle,
  User,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { CourseCard } from '@/components/course-card';
import { CourseProgressBar } from '@/components/course-progress-bar';
import { BkashCheckoutModal } from '@/components/bkash-checkout-modal';
import { useLms } from '@/components/lms-provider';
import { updateUserDisplayName, type EnrichedCourse } from '@/lib/lms-client';
import type { Enrollment } from '@/lib/lms-logic';

type StudentTab = 'overview' | 'my-courses' | 'explore' | 'free-courses' | 'profile';

function StudentDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as StudentTab) || 'overview';

  const {
    user,
    authLoading,
    courses,
    coursesLoading,
    enrollments,
    progressRecords,
    setSessionUser,
    refreshUserData,
    logout,
    notify,
  } = useLms();

  const [activeTab, setActiveTab] = useState<StudentTab>(initialTab);
  const [customDisplayName, setCustomDisplayName] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedPendingModal, setSelectedPendingModal] = useState<{
    course: EnrichedCourse;
    enrollment: Enrollment;
  } | null>(null);

  const displayNameInput = customDisplayName ?? user?.displayName ?? '';

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.accessStatus === 'active' || e.status === 'ACTIVE'),
    [enrollments]
  );

  const pendingEnrollments = useMemo(
    () =>
      enrollments.filter(
        (e) =>
          (e.accessStatus === 'pending' || e.status === 'PENDING') &&
          e.accessStatus !== 'active'
      ),
    [enrollments]
  );

  const enrolledCourseMap = useMemo(() => {
    const map = new Map<string, (typeof courses)[number]>();
    for (const c of courses) {
      map.set(c.id, c);
    }
    return map;
  }, [courses]);

  const myPendingCourses = useMemo(() => {
    return pendingEnrollments
      .map((enrollment) => {
        const course = enrolledCourseMap.get(enrollment.courseId);
        if (!course) return null;
        return { course, enrollment };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [pendingEnrollments, enrolledCourseMap]);

  const myEnrolledCourses = useMemo(() => {
    return activeEnrollments
      .map((enrollment) => {
        const course = enrolledCourseMap.get(enrollment.courseId);
        if (!course) return null;
        const completedCount = new Set(
          progressRecords
            .filter((p) => p.courseId === course.id && p.isCompleted)
            .map((p) => p.lessonId)
        ).size;
        const totalLessons = course.publishedLessonCount || 0;
        const percentage =
          totalLessons > 0
            ? Math.min(100, Math.round((completedCount / totalLessons) * 100))
            : 0;
        return {
          course,
          enrollment,
          completedCount,
          totalLessons,
          percentage,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [activeEnrollments, enrolledCourseMap, progressRecords]);

  const progressByCourseId = useMemo(() => {
    const map = new Map<
      string,
      { completedCount: number; totalLessons: number; percentage: number }
    >();
    for (const item of myEnrolledCourses) {
      map.set(item.course.id, {
        completedCount: item.completedCount,
        totalLessons: item.totalLessons,
        percentage: item.percentage,
      });
    }
    return map;
  }, [myEnrolledCourses]);

  const recentProgressList = useMemo(() => {
    return [...progressRecords]
      .filter((p) => p.isCompleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  }, [progressRecords]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (displayNameInput.trim().length < 2) {
      notify('Display name must be at least 2 characters.', 'error');
      return;
    }
    try {
      setSavingProfile(true);
      const updated = await updateUserDisplayName(displayNameInput.trim());
      setSessionUser(updated);
      notify('Profile updated successfully.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogoutClick = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse p-8" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Student Sign-In Required</h1>
          <p className="text-sm text-slate-600">
            Please log in to view your enrolled courses, track completed video lessons, and manage
            your student profile.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/login?redirect=/dashboard"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Create Account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const enrolledIdsSet = new Set(activeEnrollments.map((e) => e.courseId));
  const freeCoursesList = courses.filter((c) => c.courseType === 'free');

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4 space-y-6">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-medium text-slate-500">Student Workspace</p>
            <p className="text-sm font-bold text-slate-900 truncate mt-0.5">{user.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>

          <nav aria-label="Student Dashboard Navigation" className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my-courses')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'my-courses'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>My Courses</span>
              </span>
              <span className="font-mono text-xs tabular-nums">{myEnrolledCourses.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('explore')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'explore'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              <span>Explore Courses</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('free-courses')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'free-courses'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Gift className="w-4 h-4 shrink-0" />
              <span>Free Courses</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Profile</span>
            </button>

            <div className="pt-3 mt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content Viewport */}
        <section className="lg:col-span-9 space-y-8">
          {/* Welcome Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-indigo-600">Student Dashboard</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Welcome back, {user.displayName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Track your enrolled courses, resume video lessons, and explore new curricula.
              </p>
            </div>

            <div className="flex items-center gap-6 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 tabular-nums">
              <div>
                <p className="text-xs text-slate-500">Enrolled Courses</p>
                <p className="text-2xl font-bold text-slate-900 font-mono">
                  {myEnrolledCourses.length}
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500">Completed Lessons</p>
                <p className="text-2xl font-bold text-indigo-600 font-mono">
                  {progressRecords.filter((p) => p.isCompleted).length}
                </p>
              </div>
            </div>
          </div>

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Pending bKash Verification / Under Review Banner */}
              {myPendingCourses.length > 0 && (
                <div
                  data-testid="student-pending-approvals"
                  className="bg-amber-50/90 border border-amber-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-800 shrink-0" />
                      <h2 className="text-sm font-bold text-amber-950">
                        Payment under review / Pending approval ({myPendingCourses.length})
                      </h2>
                    </div>
                    <span className="text-xs font-medium text-amber-900">
                      Course content remains locked until Secret Code activation
                    </span>
                  </div>

                  <div className="space-y-3">
                    {myPendingCourses.map(({ course, enrollment }) => (
                      <div
                        key={enrollment.id}
                        className="bg-white border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                              <Lock className="w-3.5 h-3.5" />
                              <span>PENDING APPROVAL</span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>bKash Fee: ${course.price}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {course.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            Send your Secret Code via WhatsApp to support for immediate course
                            activation.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          {enrollment.secretCode && (
                            <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg">
                              <KeyRound className="w-3.5 h-3.5 text-indigo-300" />
                              <span className="text-xs font-mono font-bold tracking-wider">
                                {enrollment.secretCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(enrollment.secretCode || '');
                                  notify(
                                    `Secret Code ${enrollment.secretCode} copied!`,
                                    'success'
                                  );
                                }}
                                aria-label={`Copy Secret Code ${enrollment.secretCode}`}
                                className="p-1 text-slate-300 hover:text-white cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedPendingModal({ course, enrollment })}
                            className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          >
                            bKash & WhatsApp Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Continue Learning Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Continue Learning</h2>
                  {myEnrolledCourses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('my-courses')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      View All Enrolled ({myEnrolledCourses.length})
                    </button>
                  )}
                </div>

                {myEnrolledCourses.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-4">
                    <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="text-base font-semibold text-slate-900">
                        You Haven&apos;t Enrolled in Any Courses Yet
                      </h3>
                      <p className="text-sm text-slate-600">
                        Browse our catalog of free and paid courses to enroll and start watching
                        video lessons right away.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('free-courses')}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
                      >
                        Browse Free Courses
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('explore')}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                      >
                        Explore Full Catalog
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Dedicated Visual Progress Breakdown per Enrolled Course (from lessonProgress) */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3.5">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Course Completion Progress
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Live lesson completion percentage across your enrolled courses.
                          </p>
                        </div>
                        <span className="text-xs font-mono font-semibold text-indigo-600 tabular-nums">
                          {progressRecords.filter((p) => p.isCompleted).length} Total Completed
                        </span>
                      </div>

                      <div className="space-y-4">
                        {myEnrolledCourses.map(
                          ({ course, completedCount, totalLessons, percentage }) => (
                            <div
                              key={`progress_${course.id}`}
                              className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <Link
                                  href={`/learn/${course.id}`}
                                  className="text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors truncate"
                                >
                                  {course.title}
                                </Link>
                                <Link
                                  href={`/learn/${course.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  <span>
                                    {percentage === 100
                                      ? 'Review Course'
                                      : percentage > 0
                                      ? 'Resume Lesson'
                                      : 'Start Course'}
                                  </span>
                                </Link>
                              </div>

                              <CourseProgressBar
                                label={
                                  percentage === 100
                                    ? 'Completed'
                                    : percentage > 0
                                    ? 'In Progress'
                                    : 'Not Started'
                                }
                                completedCount={completedCount}
                                totalLessons={totalLessons}
                                percentage={percentage}
                                size="md"
                              />
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {myEnrolledCourses.map(
                        ({ course, completedCount, totalLessons, percentage }) => (
                          <CourseCard
                            key={course.id}
                            course={course}
                            isEnrolled
                            progressPercentage={percentage}
                            completedLessonsCount={completedCount}
                            totalLessonsCount={totalLessons}
                            ctaLabel={percentage > 0 ? 'Continue Learning' : 'Start Learning'}
                            ctaHref={`/learn/${course.id}`}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recently Completed Lessons */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  Recently Completed Lessons
                </h2>
                {recentProgressList.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No lessons marked as completed yet. Open any enrolled course and click
                    &ldquo;Mark as Complete&rdquo; after watching a lesson.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {recentProgressList.map((item) => {
                      const parentCourse = enrolledCourseMap.get(item.courseId);
                      return (
                        <li
                          key={item.id}
                          className="py-3 flex items-center justify-between gap-4 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {parentCourse ? parentCourse.title : item.courseId}
                              </p>
                              <p className="text-xs text-slate-500 tabular-nums">
                                Lesson ID: {item.lessonId} · Completed{' '}
                                {new Date(item.completedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Link
                            href={`/learn/${item.courseId}?lesson=${item.lessonId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap shrink-0"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Rewatch</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB: MY COURSES */}
          {activeTab === 'my-courses' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Enrolled Courses</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All courses where you currently hold an active enrollment.
                </p>
              </div>

              {myEnrolledCourses.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
                  <p className="text-sm text-slate-600">You have no active course enrollments.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('free-courses')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
                  >
                    Enroll in a Free Course
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myEnrolledCourses.map(
                    ({ course, completedCount, totalLessons, percentage }) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        isEnrolled
                        progressPercentage={percentage}
                        completedLessonsCount={completedCount}
                        totalLessonsCount={totalLessons}
                        ctaLabel={percentage > 0 ? 'Continue Learning' : 'Start Learning'}
                        ctaHref={`/learn/${course.id}`}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: EXPLORE COURSES */}
          {activeTab === 'explore' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Explore All Courses</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Browse all published free and paid courses in the catalog.
                  </p>
                </div>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  <span>Open Search Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {coursesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="bg-white rounded-xl border border-slate-200 h-80 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map((course) => {
                    const prog = progressByCourseId.get(course.id);
                    return (
                      <CourseCard
                        key={course.id}
                        course={course}
                        isEnrolled={enrolledIdsSet.has(course.id)}
                        progressPercentage={prog?.percentage}
                        completedLessonsCount={prog?.completedCount}
                        totalLessonsCount={prog?.totalLessons}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: FREE COURSES */}
          {activeTab === 'free-courses' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Free Courses</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enroll immediately at no cost and watch all published lessons.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {freeCoursesList.map((course) => {
                  const prog = progressByCourseId.get(course.id);
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      isEnrolled={enrolledIdsSet.has(course.id)}
                      progressPercentage={prog?.percentage}
                      completedLessonsCount={prog?.completedCount}
                      totalLessonsCount={prog?.totalLessons}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 max-w-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Student Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage your display name and review your account details.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-display-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Display Name
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    required
                    value={displayNameInput}
                    onChange={(e) => setCustomDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email Address (Verified)
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-role"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Account Role (Server-Enforced)
                  </label>
                  <input
                    id="profile-role"
                    type="text"
                    disabled
                    value={user.role}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 uppercase font-mono cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      {selectedPendingModal && (
        <BkashCheckoutModal
          course={selectedPendingModal.course}
          user={user}
          existingEnrollment={selectedPendingModal.enrollment}
          isOpen={true}
          onClose={() => setSelectedPendingModal(null)}
          onEnrollmentInitiated={() => {
            void refreshUserData();
          }}
          onNotify={notify}
        />
      )}
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <Suspense
        fallback={
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
          </main>
        }
      >
        <StudentDashboardContent />
      </Suspense>
      <Footer />
    </div>
  );
}
