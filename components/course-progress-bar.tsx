'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface CourseProgressBarProps {
  completedCount?: number;
  totalLessons?: number;
  percentage?: number;
  label?: string;
  size?: 'sm' | 'md';
  showLessonRatio?: boolean;
}

export function CourseProgressBar({
  completedCount,
  totalLessons,
  percentage,
  label = 'Course Progress',
  size = 'sm',
  showLessonRatio = true,
}: CourseProgressBarProps) {
  const computedPercentage =
    typeof percentage === 'number'
      ? Math.max(0, Math.min(100, Math.round(percentage)))
      : typeof completedCount === 'number' && typeof totalLessons === 'number' && totalLessons > 0
      ? Math.max(0, Math.min(100, Math.round((completedCount / totalLessons) * 100)))
      : 0;

  const isComplete = computedPercentage === 100 && (totalLessons ?? 1) > 0;
  const barHeight = size === 'md' ? 'h-2.5' : 'h-2';

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
        <span className="font-medium text-slate-600 flex items-center gap-1.5 truncate">
          {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          <span className="truncate">{label}</span>
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {showLessonRatio &&
            typeof completedCount === 'number' &&
            typeof totalLessons === 'number' && (
              <span className="text-slate-500 font-mono text-[11px]">
                {completedCount}/{totalLessons} lessons
              </span>
            )}
          <span
            className={`font-mono font-semibold ${
              isComplete ? 'text-emerald-700' : 'text-indigo-700'
            }`}
          >
            {computedPercentage}%
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={computedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full ${barHeight} bg-slate-100 rounded-full overflow-hidden border border-slate-200/60`}
      >
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isComplete ? 'bg-emerald-600' : 'bg-indigo-600'
          }`}
          style={{ width: `${computedPercentage}%` }}
        />
      </div>
    </div>
  );
}
