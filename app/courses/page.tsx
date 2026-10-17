'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, BookOpen, AlertCircle } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { CourseCard } from '@/components/course-card';
import { useLms } from '@/components/lms-provider';

function CatalogContent() {
  const searchParams = useSearchParams();
  const initialTypeParam = searchParams.get('type');

  const { courses, coursesLoading, enrollments, refreshCourses } = useLms();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid'>(
    initialTypeParam === 'free' || initialTypeParam === 'paid' ? initialTypeParam : 'all'
  );
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    if (initialTypeParam === 'free' || initialTypeParam === 'paid') {
      setFilterType(initialTypeParam);
    } else {
      setFilterType('all');
    }
  }, [initialTypeParam]);

  const enrolledIds = useMemo(
    () =>
      new Set(
        enrollments.filter((e) => e.accessStatus === 'active').map((e) => e.courseId)
      ),
    [enrollments]
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((course) => {
      if (filterType !== 'all' && course.courseType !== filterType) {
        return false;
      }
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q)
      );
    });
  }, [courses, filterType, searchQuery]);

  const handleRetry = async () => {
    try {
      setErrorState(null);
      await refreshCourses();
    } catch (err) {
      setErrorState(err instanceof Error ? err.message : 'Unable to load courses.');
    }
  };

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="border-b border-slate-200 pb-8 mb-8">
        <p className="text-xs font-semibold text-indigo-600">Course Catalog</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">
          Explore Published Courses
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl">
          Search by course title or topic, or filter between instant-enrollment free courses and
          comprehensive paid tracks.
        </p>

        {/* Search & Filter Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="course-search" className="sr-only">
              Search courses by title
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="course-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses by title or category..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>

          <div
            role="group"
            aria-label="Filter courses by access type"
            className="inline-flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg self-start sm:self-auto"
          >
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Courses ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('free')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterType === 'free'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Free ({courses.filter((c) => c.courseType === 'free').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('paid')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterType === 'paid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid ({courses.filter((c) => c.courseType === 'paid').length})
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {errorState && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3 mb-8">
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto" />
          <p className="text-sm font-medium text-red-900">{errorState}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Loading State */}
      {coursesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse p-6"
            />
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-8 space-y-4">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">No Matching Courses Found</h2>
            <p className="text-sm text-slate-600">
              No published courses matched your current search or access filter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
            }}
            className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Reset Search & Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledIds.has(course.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function CourseCatalogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <Suspense
        fallback={
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" />
          </main>
        }
      >
        <CatalogContent />
      </Suspense>
      <Footer />
    </div>
  );
}
