'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lock,
  PlayCircle,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { CourseThumbnail } from '@/components/course-card';
import { useLms } from '@/components/lms-provider';
import { enrollInCourse, fetchCourseDetails } from '@/lib/lms-client';
import type {
  Course,
  CourseProgressSummary,
  Enrollment,
  PublicLessonSummary,
} from '@/lib/lms-logic';

export default function CourseDetailsPage() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id || '';
  const router = useRouter();
  const { user, refreshUserData, notify } = useLms();

  const [course, setCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<PublicLessonSummary[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [progress, setProgress] = useState<CourseProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCourseDetails(courseId);
      setCourse(data.course);
      setCurriculum(data.curriculum);
      setEnrollment(data.enrollment);
      setProgress(data.progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load course details.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails, user]);

  const isEnrolledActive =
    enrollment?.accessStatus === 'active' || user?.role === 'admin';
  const isEnrollmentRevoked = enrollment?.accessStatus === 'revoked';

  const handleFreeEnroll = async () => {
    if (!user) {
      router.push(`/login?redirect=/courses/${encodeURIComponent(courseId)}`);
      return;
    }
    try {
      setEnrolling(true);
      await enrollInCourse(courseId);
      await refreshUserData();
      await loadDetails();
      notify('Successfully enrolled! You can now start watching lessons.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Enrollment failed.', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Course Catalog</span>
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 h-96 animate-pulse" />
        ) : error || !course ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
            <ShieldAlert className="w-8 h-8 text-red-600 mx-auto" />
            <h1 className="text-lg font-bold text-slate-900">Course Unavailable</h1>
            <p className="text-sm text-slate-600">
              {error || 'The requested course could not be found.'}
            </p>
            <Link
              href="/courses"
              className="inline-block px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Return to Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Course Overview & Curriculum */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-5">
                <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 tabular-nums">
                  <span className="font-semibold text-indigo-600">{course.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-900">
                    {course.courseType === 'free' ? 'Free Course' : `Paid Course ($${course.price})`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {curriculum.length} Published{' '}
                    {curriculum.length === 1 ? 'Lesson' : 'Lessons'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {course.title}
                </h1>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line">
                  {course.description}
                </p>

                {isEnrollmentRevoked && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-900">
                    Your enrollment access for this course has been revoked by an administrator.
                    Lesson playback is currently disabled.
                  </div>
                )}
              </div>

              {/* Course Curriculum List */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Course Curriculum</h2>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {curriculum.length} video {curriculum.length === 1 ? 'lesson' : 'lessons'} in
                      sequence
                    </p>
                  </div>
                  <BookOpen className="w-5 h-5 text-slate-400" />
                </div>

                {curriculum.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">
                    No published lessons have been added to this course yet.
                  </p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {curriculum.map((lesson, idx) => {
                      const isCompleted =
                        progress?.completedLessonIds.includes(lesson.id) ?? false;

                      return (
                        <li
                          key={lesson.id}
                          className="py-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="font-mono text-xs font-semibold text-slate-500 w-6 tabular-nums shrink-0">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {lesson.title}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Video Lesson · Sequence #{lesson.lessonOrder}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Completed</span>
                              </span>
                            )}
                            {isEnrolledActive ? (
                              <Link
                                href={`/learn/${course.id}?lesson=${lesson.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>Watch</span>
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>

            {/* Right Column: Enrollment & Access Card */}
            <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-24">
              <CourseThumbnail
                src={course.thumbnailUrl}
                title={course.title}
                category={course.category}
                className="aspect-[16/10] w-full border-b border-slate-100"
              />

              <div className="p-6 space-y-6">
                <div className="flex items-baseline justify-between border-b border-slate-100 pb-4 tabular-nums">
                  <span className="text-xs font-medium text-slate-500">Course Access</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {course.courseType === 'free' ? 'Free' : `$${course.price}`}
                  </span>
                </div>

                {isEnrolledActive ? (
                  <div className="space-y-4">
                    {progress && progress.totalPublishedLessons > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                          <span>Your Progress</span>
                          <span className="font-semibold text-slate-900">
                            {progress.completedCount} / {progress.totalPublishedLessons} (
                            {progress.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-transform origin-left"
                            style={{
                              transform: `scaleX(${Math.max(0, Math.min(100, progress.percentage)) / 100})`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <Link
                      href={
                        progress?.nextLessonId
                          ? `/learn/${course.id}?lesson=${progress.nextLessonId}`
                          : `/learn/${course.id}`
                      }
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>
                        {progress && progress.completedCount > 0
                          ? 'Continue Learning'
                          : 'Start Learning'}
                      </span>
                    </Link>

                    <p className="text-xs text-slate-500 text-center">
                      {user?.role === 'admin'
                        ? 'Administrator preview access enabled.'
                        : 'You have active enrollment in this course.'}
                    </p>
                  </div>
                ) : course.courseType === 'free' ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={enrolling || isEnrollmentRevoked}
                      onClick={handleFreeEnroll}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <span>{enrolling ? 'Enrolling...' : 'Enroll Now'}</span>
                    </button>
                    <p className="text-xs text-slate-500 text-center">
                      Instant free access to all {curriculum.length} published video lessons.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowPurchaseModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      <span>Purchase Course</span>
                    </button>
                    <p className="text-xs text-slate-500 text-center leading-relaxed">
                      Paid course enrollments are verified and activated by an administrator.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Access Format</span>
                    <span className="font-medium text-slate-900">Embedded Video Player</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Published Lessons</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {curriculum.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Progress Tracking</span>
                    <span className="font-medium text-slate-900">Included</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Honest Paid Course Access Modal (No Fake Payment Gateway) */}
      {showPurchaseModal && course && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-indigo-600">Paid Course Enrollment</p>
                <h2 id="purchase-modal-title" className="text-lg font-bold text-slate-900 mt-0.5">
                  Administrator Approval Required
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                aria-label="Close purchase information dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-900">{course.title}</strong> is a paid course listed
                at <strong className="text-slate-900 tabular-nums">${course.price}</strong>.
              </p>
              <p>
                Online payment processing is not enabled in this release. Paid course access is
                granted manually by a platform administrator after enrollment verification.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 space-y-1.5">
                <p className="font-semibold text-slate-900">How to unlock access:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Register or log in to your student account ({user?.email || 'Not logged in'}).</li>
                  <li>
                    An administrator can grant active access to your account from the{' '}
                    <strong>Admin Dashboard → Enrollments</strong> panel.
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {!user && (
                <Link
                  href={`/login?redirect=/courses/${encodeURIComponent(course.id)}`}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Log In First
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
