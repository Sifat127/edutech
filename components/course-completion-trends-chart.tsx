'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, Calendar, Flame, TrendingUp, Zap } from 'lucide-react';
import {
  calculateCompletionTrends,
  type DailyCompletionPoint,
  type LessonProgress,
} from '@/lib/lms-logic';

interface CourseCompletionTrendsChartProps {
  progressRecords: LessonProgress[];
}

export function CourseCompletionTrendsChart({
  progressRecords,
}: CourseCompletionTrendsChartProps) {
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative'>('daily');

  useEffect(() => {
    setMounted(true);
  }, []);

  const trends = useMemo(() => {
    return calculateCompletionTrends(progressRecords, 30);
  }, [progressRecords]);

  const hasCompletions = trends.totalLast30Days > 0;

  return (
    <div
      data-testid="course-completion-trends"
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-6"
    >
      {/* Header & Metric Highlights */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Course Completion Trends
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Your daily lesson completion consistency and learning velocity over the past 30 days.
          </p>
        </div>

        {/* View Toggle */}
        <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 text-xs font-semibold text-slate-600 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'daily'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Daily Completions
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cumulative')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'cumulative'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Cumulative Growth
          </button>
        </div>
      </div>

      {/* 4 Consistency Stat Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            <span>Past 30 Days</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {trends.totalLast30Days}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">
              {trends.totalLast30Days === 1 ? 'lesson' : 'lessons'}
            </span>
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active Days</span>
          </div>
          <p className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
            {trends.activeDaysCount}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">/ 30 days</span>
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>Current Streak</span>
          </div>
          <p className="text-xl font-bold font-mono text-amber-700 tabular-nums">
            {trends.currentStreakDays}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">
              {trends.currentStreakDays === 1 ? 'day' : 'days'}
            </span>
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Award className="w-3.5 h-3.5 text-purple-600" />
            <span>Weekly Velocity</span>
          </div>
          <p className="text-xl font-bold font-mono text-purple-700 tabular-nums">
            {trends.completionRatePerWeek}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">/ week</span>
          </p>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full pt-2">
        {!mounted ? (
          <div className="h-full w-full bg-slate-50 border border-dashed border-slate-200 rounded-lg animate-pulse flex items-center justify-center text-xs text-slate-400">
            Loading completion trends...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trends.dataPoints}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                interval={4}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload as DailyCompletionPoint;
                  return (
                    <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg space-y-1 border border-slate-800">
                      <p className="font-semibold text-slate-200">
                        {data.displayDate} ({data.dayOfWeek})
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-300 font-mono">
                          Completed: {data.completions}{' '}
                          {data.completions === 1 ? 'lesson' : 'lessons'}
                        </span>
                        <span className="text-slate-400 font-mono">
                          Total: {data.cumulative}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey={viewMode === 'daily' ? 'completions' : 'cumulative'}
                stroke={viewMode === 'daily' ? '#4f46e5' : '#059669'}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={viewMode === 'daily' ? 'url(#colorDaily)' : 'url(#colorCumulative)'}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!hasCompletions && (
        <div className="text-center py-2 text-xs text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          💡 No lessons completed in the last 30 days yet. Start watching any enrolled course and mark lessons as complete to build your daily learning consistency streak!
        </div>
      )}
    </div>
  );
}
