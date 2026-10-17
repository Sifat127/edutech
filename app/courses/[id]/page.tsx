'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Lock,
  PlayCircle,
  ShieldAlert,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { CourseThumbnail } from '@/components/course-card';
import { BkashCheckoutModal } from '@/components/bkash-checkout-modal';
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
    enrollment?.accessStatus === 'active' ||
    enrollment?.status === 'ACTIVE' ||
    user?.role === 'admin';
  const isEnrollmentPending =
    !isEnrolledActive &&
    (enrollment?.accessStatus === 'pending' || enrollment?.status === 'PENDING');
  const isEnrollmentRevoked =
    !isEnrolledActive &&
    (enrollment?.accessStatus === 'revoked' ||
      enrollment?.accessStatus === 'rejected' ||
      enrollment?.status === 'REJECTED');

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

                {isEnrollmentPending && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-950 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-900">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Payment under review / Pending approval</span>
                      </span>
                      {enrollment?.secretCode && (
                        <span className="font-mono font-bold text-slate-900">
                          Code: {enrollment.secretCode}
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed text-amber-900">
                      Your bKash enrollment request has been recorded. Send your Secret Code via
                      WhatsApp to support so an administrator can verify and unlock this course.
                    </p>
                  </div>
                )}

                {isEnrollmentRevoked && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-900">
                    Your enrollment access for this course was rejected or revoked by an
                    administrator. You may initiate a new bKash verification code below.
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
                ) : isEnrollmentPending ? (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Payment under review / Pending approval</span>
                      </div>
                      {enrollment?.secretCode && (
                        <div className="flex items-center justify-between bg-white border border-amber-200 rounded-md px-3 py-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Your Secret Code
                            </p>
                            <p className="text-sm font-mono font-bold text-slate-900">
                              {enrollment.secretCode}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(enrollment.secretCode || '');
                              notify(`Copied Secret Code ${enrollment.secretCode}`, 'success');
                            }}
                            aria-label="Copy Secret Code"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPurchaseModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>View bKash & WhatsApp Instructions</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowPurchaseModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Enroll / Purchase</span>
                    </button>
                    <p className="text-xs text-slate-500 text-center leading-relaxed">
                      Generates a unique Secret Code for manual bKash payment & WhatsApp
                      verification.
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
                    <span>Payment Method</span>
                    <span className="font-medium text-slate-900">
                      {course.courseType === 'free' ? 'Free Instant Access' : 'bKash + Secret Code'}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Manual bKash Payment & Secret Code Checkout Modal */}
      {course && (
        <BkashCheckoutModal
          course={course}
          user={user}
          existingEnrollment={enrollment}
          isOpen={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          onEnrollmentInitiated={(updatedEnrollment) => {
            setEnrollment(updatedEnrollment);
            void refreshUserData();
          }}
          onNotify={notify}
        />
      )}

      <Footer />
    </div>
  );
}
