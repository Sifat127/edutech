'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import type { Course } from '@/lib/lms-logic';
import { CourseProgressBar } from './course-progress-bar';

export function CourseThumbnail({
  src,
  title,
  category,
  className = '',
}: {
  src: string;
  title: string;
  category: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return (
      <div
        className={`bg-slate-100 flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
      >
        <BookOpen className="w-8 h-8 text-indigo-600 mb-2" />
        <span className="text-xs font-medium text-slate-600 line-clamp-1">{category}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export interface CourseCardProps {
  course: Course & {
    publishedLessonCount?: number;
  };
  progressPercentage?: number;
  completedLessonsCount?: number;
  totalLessonsCount?: number;
  isEnrolled?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}

export function CourseCard({
  course,
  progressPercentage,
  completedLessonsCount,
  totalLessonsCount,
  isEnrolled = false,
  ctaLabel,
  ctaHref,
}: CourseCardProps) {
  const href = ctaHref || `/courses/${course.id}`;
  const buttonText =
    ctaLabel || (isEnrolled ? 'Continue Learning' : 'View Course');

  const accessText =
    course.courseType === 'free'
      ? 'Free Access'
      : `Paid · $${course.price}`;

  return (
    <article className="group bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col transition-colors hover:border-slate-300">
      <Link href={href} className="block focus-visible:outline-2 focus-visible:outline-indigo-600">
        <CourseThumbnail
          src={course.thumbnailUrl}
          title={course.title}
          category={course.category}
          className="aspect-[16/10] w-full border-b border-slate-100"
        />
      </Link>

      <div className="p-6 flex flex-col flex-1 justify-between gap-5">
        <div className="space-y-2.5">
          {/* Clean unboxed metadata line with typographic separators */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 tabular-nums">
            <span className="font-medium text-slate-700">{course.category}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                course.courseType === 'free'
                  ? 'font-semibold text-emerald-700'
                  : 'font-semibold text-indigo-700'
              }
            >
              {accessText}
            </span>
            {typeof course.publishedLessonCount === 'number' && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {course.publishedLessonCount}{' '}
                  {course.publishedLessonCount === 1 ? 'Lesson' : 'Lessons'}
                </span>
              </>
            )}
          </div>

          <h3 className="text-lg font-semibold text-slate-900 leading-snug">
            <Link
              href={href}
              className="hover:text-indigo-600 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 rounded"
            >
              {course.title}
            </Link>
          </h3>

          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
            {course.description}
          </p>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-100">
          {typeof progressPercentage === 'number' && (
            <CourseProgressBar
              percentage={progressPercentage}
              completedCount={completedLessonsCount}
              totalLessons={totalLessonsCount ?? course.publishedLessonCount}
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {isEnrolled
                ? 'Enrolled'
                : course.courseType === 'free'
                ? 'Instant Free Enrollment'
                : `Tuition: $${course.price}`}
            </span>

            <Link
              href={href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span>{buttonText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
