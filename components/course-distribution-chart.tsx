'use client';

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { type CourseStudentDistributionItem } from '@/lib/lms-logic';

interface CourseDistributionChartProps {
  data: CourseStudentDistributionItem[];
  onSelectCourse?: (courseId: string) => void;
}

const BAR_COLORS = [
  '#4f46e5', // indigo-600 (top course)
  '#2563eb', // blue-600
  '#6366f1', // indigo-500
  '#3b82f6', // blue-500
  '#818cf8', // indigo-400
  '#60a5fa', // blue-400
];

export function CourseDistributionChart({
  data,
  onSelectCourse,
}: CourseDistributionChartProps) {
  const totalActiveEnrollments = data.reduce((sum, item) => sum + item.activeStudents, 0);
  const topCourse = data.length > 0 && data[0].activeStudents > 0 ? data[0] : null;

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-6"
      data-testid="course-distribution-chart"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-900">
              Student Distribution Across Courses
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Active student enrollments per course, ranked from highest to lowest popularity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {topCourse && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-slate-600">Most Popular:</span>
              <span className="font-semibold text-indigo-950 truncate max-w-[180px]">
                {topCourse.title}
              </span>
              <span className="font-mono font-bold text-indigo-700 tabular-nums">
                ({topCourse.activeStudents})
              </span>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 tabular-nums">
            <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Total Active Seats:</span>
            <span className="font-mono font-bold text-slate-900">{totalActiveEnrollments}</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">No courses available</p>
          <p className="text-xs text-slate-500">
            Create your first course to visualize student enrollment distribution.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Recharts BarChart */}
          <div className="lg:col-span-8 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 12, right: 16, left: -12, bottom: 24 }}
                barSize={38}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="shortTitle"
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as CourseStudentDistributionItem;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3 text-xs space-y-1.5 max-w-xs">
                        <p className="font-bold text-slate-900 leading-snug">{item.title}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{item.category}</span>
                          <span>•</span>
                          <span className="uppercase font-semibold text-indigo-600">
                            {item.courseType}
                          </span>
                          <span>•</span>
                          <span>{item.isPublished ? 'Published' : 'Draft'}</span>
                        </div>
                        <div className="pt-1 border-t border-slate-100 space-y-1 tabular-nums">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-600">Active Students:</span>
                            <span className="font-mono font-bold text-indigo-600">
                              {item.activeStudents} ({item.sharePercentage}%)
                            </span>
                          </div>
                          {item.inactiveStudents > 0 && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">Revoked / Pending:</span>
                              <span className="font-mono font-medium text-slate-700">
                                {item.inactiveStudents}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="activeStudents"
                  name="Active Students"
                  radius={[6, 6, 0, 0]}
                  onClick={(_, index) => {
                    const selected = typeof index === 'number' ? data[index] : undefined;
                    if (onSelectCourse && selected?.courseId) {
                      onSelectCourse(selected.courseId);
                    }
                  }}
                  className={onSelectCourse ? 'cursor-pointer' : ''}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.courseId}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranked Breakdown List */}
          <div className="lg:col-span-4 space-y-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Popularity Breakdown
            </p>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {data.map((item, index) => (
                <div
                  key={item.courseId}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate" title={item.title}>
                        {index + 1}. {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.courseType === 'free' ? 'Free' : 'Paid'} • {item.category}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded tabular-nums">
                      {item.activeStudents} {item.activeStudents === 1 ? 'student' : 'students'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(item.activeStudents > 0 ? 6 : 0, item.sharePercentage)}%`,
                        backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
