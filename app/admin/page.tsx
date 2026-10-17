'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Edit3,
  ExternalLink,
  Film,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { CourseDistributionChart } from '@/components/course-distribution-chart';
import { AdminEnrollmentManager } from '@/components/admin-enrollment-manager';
import { useLms } from '@/components/lms-provider';
import {
  createCourseAdmin,
  createLessonAdmin,
  deleteCourseAdmin,
  deleteLessonAdmin,
  fetchAdminOverview,
  updateCourseAdmin,
  updateLessonAdmin,
  type AdminOverviewPayload,
} from '@/lib/lms-client';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  calculateCourseStudentDistribution,
  extractYouTubeVideoId,
  type Course,
  type Lesson,
} from '@/lib/lms-logic';

type AdminTab = 'overview' | 'courses' | 'lessons' | 'students' | 'enrollments' | 'settings';

const THUMBNAIL_PRESETS = [
  { label: 'TypeScript & Code Architecture', url: '/thumbnails/typescript.svg' },
  { label: 'Cloud & Distributed Systems', url: '/thumbnails/fullstack.svg' },
  { label: 'Database & Security Modeling', url: '/thumbnails/database.svg' },
  { label: 'Interface & Design Systems', url: '/thumbnails/ui-engineering.svg' },
  { label: 'Zero-Trust Security', url: '/thumbnails/security.svg' },
  { label: 'DevOps & Pipelines', url: '/thumbnails/devops.svg' },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, authLoading, refreshCourses, logout, notify } = useLms();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminData, setAdminData] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Course Form State
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCategory, setCourseCategory] = useState('Software Engineering');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseThumbnail, setCourseThumbnail] = useState('/thumbnails/typescript.svg');
  const [courseType, setCourseType] = useState<'free' | 'paid'>('free');
  const [coursePrice, setCoursePrice] = useState('0');
  const [coursePublished, setCoursePublished] = useState(true);
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Lesson Management State
  const [selectedCourseIdForLessons, setSelectedCourseIdForLessons] = useState<string>('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonYoutubeUrl, setLessonYoutubeUrl] = useState('');
  const [lessonOrder, setLessonOrder] = useState('1');
  const [lessonPublished, setLessonPublished] = useState(true);
  const [submittingLesson, setSubmittingLesson] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);

  // Student & Enrollment Management State
  const [studentSearch, setStudentSearch] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantCourseId, setGrantCourseId] = useState('');

  const loadAdminData = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminOverview();
      setAdminData(data);
      if (!selectedCourseIdForLessons && data.courses.length > 0) {
        setSelectedCourseIdForLessons(data.courses[0].id);
      }
      const firstStudent = data.users.find((u) => u.role === 'student');
      if (!grantUserId && firstStudent) {
        setGrantUserId(firstStudent.uid);
      }
      if (!grantCourseId && data.courses.length > 0) {
        setGrantCourseId(data.courses[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCourseIdForLessons, grantUserId, grantCourseId]);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin') {
      void loadAdminData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user, loadAdminData]);

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCourseTitle('');
    setCourseCategory('Software Engineering');
    setCourseDescription('');
    setCourseThumbnail('/thumbnails/typescript.svg');
    setCourseType('free');
    setCoursePrice('0');
    setCoursePublished(true);
  };

  const handleStartEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setCourseTitle(c.title);
    setCourseCategory(c.category);
    setCourseDescription(c.description);
    setCourseThumbnail(c.thumbnailUrl);
    setCourseType(c.courseType);
    setCoursePrice(String(c.price));
    setCoursePublished(c.isPublished);
    setActiveTab('courses');
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = courseType === 'free' ? 0 : Number(coursePrice);
    if (courseType === 'paid' && (Number.isNaN(numericPrice) || numericPrice <= 0)) {
      notify('Paid courses require a price greater than $0.', 'error');
      return;
    }

    try {
      setSubmittingCourse(true);
      if (editingCourseId) {
        await updateCourseAdmin(editingCourseId, {
          title: courseTitle,
          description: courseDescription,
          thumbnailUrl: courseThumbnail,
          category: courseCategory,
          courseType,
          price: numericPrice,
          isPublished: coursePublished,
        });
        notify('Course updated successfully.', 'success');
      } else {
        const created = await createCourseAdmin({
          title: courseTitle,
          description: courseDescription,
          thumbnailUrl: courseThumbnail,
          category: courseCategory,
          courseType,
          price: numericPrice,
          isPublished: coursePublished,
        });
        if (!selectedCourseIdForLessons) {
          setSelectedCourseIdForLessons(created.id);
        }
        notify('New course created!', 'success');
      }
      resetCourseForm();
      await Promise.all([loadAdminData(), refreshCourses()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Course save failed.', 'error');
    } finally {
      setSubmittingCourse(false);
    }
  };

  const handleToggleCoursePublish = async (course: Course) => {
    try {
      await updateCourseAdmin(course.id, { isPublished: !course.isPublished });
      notify(
        course.isPublished ? 'Course moved to Draft.' : 'Course published to catalog.',
        'success'
      );
      await Promise.all([loadAdminData(), refreshCourses()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to toggle publication.', 'error');
    }
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      await deleteCourseAdmin(courseToDelete.id);
      notify(`Deleted course "${courseToDelete.title}".`, 'info');
      setCourseToDelete(null);
      await Promise.all([loadAdminData(), refreshCourses()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const lessonsForSelectedCourse = useMemo(() => {
    if (!adminData || !selectedCourseIdForLessons) return [];
    return adminData.lessons
      .filter((l) => l.courseId === selectedCourseIdForLessons)
      .sort((a, b) => a.lessonOrder - b.lessonOrder);
  }, [adminData, selectedCourseIdForLessons]);

  // Keep default lessonOrder synced to next order number when switching course
  useEffect(() => {
    if (!editingLessonId) {
      setLessonOrder(String(lessonsForSelectedCourse.length + 1));
    }
  }, [lessonsForSelectedCourse.length, editingLessonId]);

  const youtubePreviewCheck = useMemo(() => {
    if (!lessonYoutubeUrl.trim()) return null;
    return extractYouTubeVideoId(lessonYoutubeUrl);
  }, [lessonYoutubeUrl]);

  const resetLessonForm = () => {
    setEditingLessonId(null);
    setLessonTitle('');
    setLessonYoutubeUrl('');
    setLessonOrder(String(lessonsForSelectedCourse.length + 1));
    setLessonPublished(true);
  };

  const handleStartEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setSelectedCourseIdForLessons(lesson.courseId);
    setLessonTitle(lesson.title);
    setLessonYoutubeUrl(`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`);
    setLessonOrder(String(lesson.lessonOrder));
    setLessonPublished(lesson.isPublished);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseIdForLessons) {
      notify('Please select a parent course first.', 'error');
      return;
    }

    const check = extractYouTubeVideoId(lessonYoutubeUrl);
    if (!check.valid) {
      notify(check.error || 'Invalid YouTube URL.', 'error');
      return;
    }

    try {
      setSubmittingLesson(true);
      if (editingLessonId) {
        await updateLessonAdmin(editingLessonId, {
          title: lessonTitle,
          youtubeUrl: lessonYoutubeUrl,
          lessonOrder: Number(lessonOrder),
          isPublished: lessonPublished,
        });
        notify('Lesson updated.', 'success');
      } else {
        await createLessonAdmin({
          courseId: selectedCourseIdForLessons,
          title: lessonTitle,
          youtubeUrl: lessonYoutubeUrl,
          lessonOrder: Number(lessonOrder),
          isPublished: lessonPublished,
        });
        notify('Lesson added to course!', 'success');
      }
      resetLessonForm();
      await Promise.all([loadAdminData(), refreshCourses()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save lesson.', 'error');
    } finally {
      setSubmittingLesson(false);
    }
  };

  const handleMoveLessonOrder = async (lesson: Lesson, direction: 'up' | 'down') => {
    const idx = lessonsForSelectedCourse.findIndex((l) => l.id === lesson.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lessonsForSelectedCourse.length) return;
    const neighbor = lessonsForSelectedCourse[swapIdx];

    try {
      await Promise.all([
        updateLessonAdmin(lesson.id, { lessonOrder: neighbor.lessonOrder }),
        updateLessonAdmin(neighbor.id, { lessonOrder: lesson.lessonOrder }),
      ]);
      await loadAdminData();
      notify('Lesson order updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Reorder failed.', 'error');
    }
  };

  const handleToggleLessonPublish = async (lesson: Lesson) => {
    try {
      await updateLessonAdmin(lesson.id, { isPublished: !lesson.isPublished });
      await Promise.all([loadAdminData(), refreshCourses()]);
      notify(lesson.isPublished ? 'Lesson unpublished.' : 'Lesson published.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleConfirmDeleteLesson = async () => {
    if (!lessonToDelete) return;
    try {
      await deleteLessonAdmin(lessonToDelete.id);
      notify(`Deleted lesson "${lessonToDelete.title}".`, 'info');
      setLessonToDelete(null);
      await Promise.all([loadAdminData(), refreshCourses()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete lesson.', 'error');
    }
  };

  const filteredStudents = useMemo(() => {
    if (!adminData) return [];
    const q = studentSearch.trim().toLowerCase();
    return adminData.users.filter((u) => {
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [adminData, studentSearch]);

  const courseDistribution = useMemo(() => {
    if (!adminData) return [];
    return calculateCourseStudentDistribution({
      courses: adminData.courses,
      enrollments: adminData.enrollments,
    });
  }, [adminData]);

  const activeStudentsByCourseId = useMemo(() => {
    return new Map(courseDistribution.map((item) => [item.courseId, item.activeStudents]));
  }, [courseDistribution]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse p-8" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-8 text-center space-y-4">
            <ShieldAlert className="w-8 h-8 text-red-600 mx-auto" />
            <h1 className="text-xl font-bold text-slate-900">Administrator Access Required</h1>
            <p className="text-sm text-slate-600">
              This console is restricted to verified platform administrators. Student accounts
              cannot access administrative operations.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/login?redirect=/admin"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Admin Login
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Student Dashboard
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const courseMap = new Map(adminData?.courses.map((c) => [c.id, c]) || []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Admin Sidebar */}
          <aside className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4 space-y-6">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-indigo-600">Administrator Console</p>
              <p className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {user.displayName}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>

            <nav aria-label="Admin Console Navigation" className="space-y-1">
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
                onClick={() => setActiveTab('courses')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'courses'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Courses</span>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {adminData?.stats.totalCourses ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lessons')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'lessons'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Film className="w-4 h-4 shrink-0" />
                  <span>Lessons</span>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {adminData?.stats.totalLessons ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'students'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Students</span>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {adminData?.stats.totalStudents ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('enrollments')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'enrollments'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Enrollments</span>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {adminData?.stats.totalEnrollments ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Settings</span>
              </button>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push('/');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* Main Admin Workspace */}
          <section className="lg:col-span-9 space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900">
                {error}
              </div>
            )}

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && adminData && (
              <div className="space-y-8">
                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-indigo-600">Platform Administration</p>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                      Admin Overview
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Live database metrics across courses, video lessons, students, and
                      enrollments.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('enrollments')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Verify Secret Code ({adminData.stats.pendingApprovals ?? 0})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetCourseForm();
                        setActiveTab('courses');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Course</span>
                    </button>
                  </div>
                </div>

                {/* 4 Stat Summary Cards: Total Enrolled Students, Total Revenue/Sales, Pending Approvals, Active Courses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Total Enrolled Students</p>
                    <p className="text-3xl font-bold text-slate-900 font-mono">
                      {adminData.stats.activeEnrollments}
                    </p>
                    <p className="text-xs text-slate-500">
                      {adminData.stats.totalStudents} Registered Accounts
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Total Revenue / Sales</p>
                    <p className="text-3xl font-bold text-emerald-700 font-mono">
                      ${adminData.stats.totalRevenue ?? 0}
                    </p>
                    <p className="text-xs text-slate-500">Verified bKash Paid Courses</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Pending Approvals</p>
                    <p className="text-3xl font-bold text-amber-700 font-mono">
                      {adminData.stats.pendingApprovals ?? 0}
                    </p>
                    <p className="text-xs text-slate-500">Awaiting Secret Code Check</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Active Courses</p>
                    <p className="text-3xl font-bold text-indigo-600 font-mono">
                      {adminData.stats.publishedCourses}
                    </p>
                    <p className="text-xs text-slate-500">
                      {adminData.stats.totalLessons} Total Video Lessons
                    </p>
                  </div>
                </div>

                {/* Visual Student Distribution Chart (Recharts) */}
                <CourseDistributionChart
                  data={courseDistribution}
                  onSelectCourse={(courseId) => {
                    setGrantCourseId(courseId);
                    setActiveTab('enrollments');
                  }}
                />

                {/* Quick Course Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">All Courses</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('courses')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      Manage Courses
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Course Title</th>
                          <th className="py-3 px-4">Type & Price</th>
                          <th className="py-3 px-4">Students</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {adminData.courses.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {c.title}
                              <span className="block text-[11px] font-normal text-slate-500">
                                {c.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {c.courseType === 'free' ? 'Free ($0)' : `Paid ($${c.price})`}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                              {activeStudentsByCourseId.get(c.id) ?? 0}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={
                                  c.isPublished
                                    ? 'font-semibold text-emerald-700'
                                    : 'font-semibold text-amber-700'
                                }
                              >
                                {c.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCourseIdForLessons(c.id);
                                  setActiveTab('lessons');
                                }}
                                className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                Lessons
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditCourse(c)}
                                className="font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COURSE MANAGEMENT */}
            {activeTab === 'courses' && adminData && (
              <div className="space-y-8">
                {/* Course Create / Edit Form */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h1 className="text-lg font-bold text-slate-900">
                        {editingCourseId ? 'Edit Course' : 'Create New Course'}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure course metadata, Free or Paid access type, price, and publication
                        status.
                      </p>
                    </div>
                    {editingCourseId && (
                      <button
                        type="button"
                        onClick={resetCourseForm}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveCourse} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-title-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Course Title
                        </label>
                        <input
                          id="course-title-input"
                          type="text"
                          required
                          value={courseTitle}
                          onChange={(e) => setCourseTitle(e.target.value)}
                          placeholder="e.g., Production Kubernetes & Cloud Security"
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-category-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Category
                        </label>
                        <input
                          id="course-category-input"
                          type="text"
                          required
                          value={courseCategory}
                          onChange={(e) => setCourseCategory(e.target.value)}
                          placeholder="e.g., Cloud Engineering"
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="course-desc-input"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Course Description
                      </label>
                      <textarea
                        id="course-desc-input"
                        rows={3}
                        required
                        value={courseDescription}
                        onChange={(e) => setCourseDescription(e.target.value)}
                        placeholder="Describe what students will learn in this course..."
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-type-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Access Type
                        </label>
                        <select
                          id="course-type-select"
                          value={courseType}
                          onChange={(e) => {
                            const val = e.target.value as 'free' | 'paid';
                            setCourseType(val);
                            if (val === 'free') setCoursePrice('0');
                            else if (coursePrice === '0') setCoursePrice('49');
                          }}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        >
                          <option value="free">Free Course ($0)</option>
                          <option value="paid">Paid Course</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-price-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Price (USD)
                        </label>
                        <input
                          id="course-price-input"
                          type="number"
                          min={0}
                          step="1"
                          disabled={courseType === 'free'}
                          value={courseType === 'free' ? '0' : coursePrice}
                          onChange={(e) => setCoursePrice(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 tabular-nums"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-status-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Publication Status
                        </label>
                        <select
                          id="course-status-select"
                          value={coursePublished ? 'published' : 'draft'}
                          onChange={(e) => setCoursePublished(e.target.value === 'published')}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        >
                          <option value="published">Published (Visible)</option>
                          <option value="draft">Unpublished (Draft)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-thumb-preset"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Select Preset Course Thumbnail
                        </label>
                        <select
                          id="course-thumb-preset"
                          value={
                            THUMBNAIL_PRESETS.some((p) => p.url === courseThumbnail)
                              ? courseThumbnail
                              : 'custom'
                          }
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              setCourseThumbnail(e.target.value);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        >
                          {THUMBNAIL_PRESETS.map((p) => (
                            <option key={p.url} value={p.url}>
                              {p.label}
                            </option>
                          ))}
                          <option value="custom">Custom Image URL</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="course-thumb-url"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Thumbnail Path or URL
                        </label>
                        <input
                          id="course-thumb-url"
                          type="text"
                          required
                          value={courseThumbnail}
                          onChange={(e) => setCourseThumbnail(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={submittingCourse}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                      >
                        {submittingCourse
                          ? 'Saving...'
                          : editingCourseId
                          ? 'Update Course'
                          : 'Create Course'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Existing Courses Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-sm font-bold text-slate-900">
                      Course Directory ({adminData.courses.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Course</th>
                          <th className="py-3 px-4">Access</th>
                          <th className="py-3 px-4">Visibility</th>
                          <th className="py-3 px-4 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {adminData.courses.map((course) => (
                          <tr key={course.id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-900">{course.title}</p>
                              <p className="text-[11px] text-slate-500">{course.category}</p>
                            </td>
                            <td className="py-3.5 px-4">
                              {course.courseType === 'free'
                                ? 'Free ($0)'
                                : `Paid ($${course.price})`}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleCoursePublish(course)}
                                className={`font-semibold underline underline-offset-2 cursor-pointer ${
                                  course.isPublished ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {course.isPublished ? 'Published (Unpublish)' : 'Draft (Publish)'}
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCourseIdForLessons(course.id);
                                  setActiveTab('lessons');
                                }}
                                className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                Manage Lessons
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditCourse(course)}
                                aria-label={`Edit ${course.title}`}
                                className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setCourseToDelete(course)}
                                aria-label={`Delete ${course.title}`}
                                className="inline-flex items-center gap-1 font-semibold text-red-600 hover:text-red-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LESSON MANAGEMENT */}
            {activeTab === 'lessons' && adminData && (
              <div className="space-y-8">
                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h1 className="text-lg font-bold text-slate-900">
                        {editingLessonId ? 'Edit Video Lesson' : 'Add YouTube Video Lesson'}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Paste a standard YouTube watch URL (`https://www.youtube.com/watch?v=...`)
                        or `youtu.be` link. Only the validated 11-character video ID is stored.
                      </p>
                    </div>

                    <div className="min-w-[240px]">
                      <label
                        htmlFor="lesson-course-selector"
                        className="block text-[11px] font-semibold text-slate-500 mb-1"
                      >
                        Target Course
                      </label>
                      <select
                        id="lesson-course-selector"
                        value={selectedCourseIdForLessons}
                        onChange={(e) => {
                          setSelectedCourseIdForLessons(e.target.value);
                          setEditingLessonId(null);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                      >
                        {adminData.courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.courseType.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <form onSubmit={handleSaveLesson} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="sm:col-span-6 space-y-1.5">
                        <label
                          htmlFor="lesson-title-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Lesson Title
                        </label>
                        <input
                          id="lesson-title-input"
                          type="text"
                          required
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                          placeholder="e.g., Module 1: Distributed State Consensus"
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1.5">
                        <label
                          htmlFor="lesson-order-input"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Lesson Order
                        </label>
                        <input
                          id="lesson-order-input"
                          type="number"
                          min={1}
                          required
                          value={lessonOrder}
                          onChange={(e) => setLessonOrder(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1.5">
                        <label
                          htmlFor="lesson-publish-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Visibility
                        </label>
                        <select
                          id="lesson-publish-select"
                          value={lessonPublished ? 'published' : 'draft'}
                          onChange={(e) => setLessonPublished(e.target.value === 'published')}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        >
                          <option value="published">Published</option>
                          <option value="draft">Unpublished</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="lesson-youtube-input"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        YouTube Unlisted Video URL
                      </label>
                      <input
                        id="lesson-youtube-input"
                        type="text"
                        required
                        value={lessonYoutubeUrl}
                        onChange={(e) => setLessonYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=M7lc1UVf-VE or https://youtu.be/M7lc1UVf-VE"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                      />
                      {youtubePreviewCheck && (
                        <p
                          className={`text-xs ${
                            youtubePreviewCheck.valid ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {youtubePreviewCheck.valid
                            ? `Validated YouTube Video ID: ${youtubePreviewCheck.data}`
                            : youtubePreviewCheck.error}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={submittingLesson}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                      >
                        {submittingLesson
                          ? 'Saving Lesson...'
                          : editingLessonId
                          ? 'Save Lesson Changes'
                          : 'Add Lesson to Course'}
                      </button>
                      {editingLessonId && (
                        <button
                          type="button"
                          onClick={resetLessonForm}
                          className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Lessons List for Selected Course */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Curriculum for{' '}
                        {courseMap.get(selectedCourseIdForLessons)?.title || 'Selected Course'}
                      </h2>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {lessonsForSelectedCourse.length}{' '}
                        {lessonsForSelectedCourse.length === 1 ? 'lesson' : 'lessons'} configured
                      </p>
                    </div>
                    {selectedCourseIdForLessons && (
                      <Link
                        href={`/learn/${selectedCourseIdForLessons}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        <span>Preview Player</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {lessonsForSelectedCourse.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No lessons have been added to this course yet. Use the form above to paste a
                      YouTube URL and add the first lesson.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                            <th className="py-3 px-4">Order</th>
                            <th className="py-3 px-4">Lesson Title</th>
                            <th className="py-3 px-4">YouTube Video ID</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 tabular-nums">
                          {lessonsForSelectedCourse.map((lesson, idx) => (
                            <tr key={lesson.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                                #{lesson.lessonOrder}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {lesson.title}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600">
                                {lesson.youtubeVideoId}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => handleToggleLessonPublish(lesson)}
                                  className={`font-semibold underline underline-offset-2 cursor-pointer ${
                                    lesson.isPublished ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {lesson.isPublished ? 'Published' : 'Unpublished'}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveLessonOrder(lesson, 'up')}
                                  aria-label={`Move ${lesson.title} up`}
                                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5 inline" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === lessonsForSelectedCourse.length - 1}
                                  onClick={() => handleMoveLessonOrder(lesson, 'down')}
                                  aria-label={`Move ${lesson.title} down`}
                                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5 inline" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLesson(lesson)}
                                  className="font-semibold text-indigo-600 hover:text-indigo-800 px-1.5 cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLessonToDelete(lesson)}
                                  className="font-semibold text-red-600 hover:text-red-800 px-1.5 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: STUDENT MANAGEMENT */}
            {activeTab === 'students' && adminData && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900">Registered Students</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Search students by name or email and inspect their course enrollments.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <label htmlFor="admin-student-search" className="sr-only">
                      Search students by name or email
                    </label>
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="admin-student-search"
                      type="search"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Name & Email</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Active Enrollments</th>
                          <th className="py-3 px-4 text-right">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {filteredStudents.map((u) => {
                          const userEnrollments = adminData.enrollments.filter(
                            (e) => e.userId === u.uid && e.accessStatus === 'active'
                          );
                          return (
                            <tr key={u.uid} className="hover:bg-slate-50/80">
                              <td className="py-3.5 px-4">
                                <p className="font-semibold text-slate-900">{u.displayName}</p>
                                <p className="text-[11px] text-slate-500">{u.email}</p>
                              </td>
                              <td className="py-3.5 px-4 font-mono uppercase text-slate-700">
                                {u.role}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {userEnrollments.length === 0 ? (
                                  <span className="text-slate-400">None</span>
                                ) : (
                                  userEnrollments
                                    .map((e) => courseMap.get(e.courseId)?.title || e.courseId)
                                    .join(' · ')
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGrantUserId(u.uid);
                                    setActiveTab('enrollments');
                                  }}
                                  className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                >
                                  Manage Access
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ENROLLMENT & PAID ACCESS CONTROL */}
            {activeTab === 'enrollments' && adminData && (
              <AdminEnrollmentManager
                courses={adminData.courses}
                users={adminData.users}
                enrollments={adminData.enrollments}
                initialGrantUserId={grantUserId}
                initialGrantCourseId={grantCourseId}
                onDataChanged={async () => {
                  await Promise.all([loadAdminData(), refreshCourses()]);
                }}
                onNotify={notify}
              />
            )}

            {/* TAB 6: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    Platform Configuration & Security Notes
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Firebase Authentication, Cloud Firestore security rules, and YouTube Unlisted
                    video configuration.
                  </p>
                </div>

                <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <p className="font-semibold text-slate-900">
                      1. Administrator Role Enforcement
                    </p>
                    <p>
                      New registrations default to the <code className="font-mono">student</code>{' '}
                      role. The bootstrap administrator email (
                      <code className="font-mono">{BOOTSTRAP_ADMIN_EMAIL}</code>) and verified
                      admin accounts in <code className="font-mono">/admins</code> are enforced by
                      both the Node.js backend API and Cloud Firestore Security Rules.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <p className="font-semibold text-slate-900">
                      2. Firebase Authentication Providers
                    </p>
                    <p>
                      Google Sign-In (<code className="font-mono">signInWithPopup</code>) is
                      provisioned automatically. To also use native Firebase Email/Password
                      authentication in production alongside the server session handler, open the
                      Firebase Console → Authentication → Sign-in method and enable the
                      Email/Password provider.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <p className="font-semibold text-slate-900">
                      3. YouTube Unlisted Video Security Disclosure
                    </p>
                    <p>
                      Lessons store only the validated 11-character YouTube video ID and render via{' '}
                      <code className="font-mono">
                        https://www.youtube.com/embed/VIDEO_ID?rel=0
                      </code>
                      . Remember that YouTube Unlisted videos are not strictly private if a viewer
                      shares the direct YouTube URL externally; platform authorization protects
                      course curriculum metadata and learning routes.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Confirmation Dialog: Delete Course */}
      {courseToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-course-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="delete-course-modal-title" className="text-base font-bold text-slate-900">
                Confirm Course Deletion
              </h2>
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                aria-label="Close delete confirmation"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">{courseToDelete.title}</strong>? This will also
              remove all associated lessons, enrollments, and progress records.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourse}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
              >
                Delete Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Lesson */}
      {lessonToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-lesson-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="delete-lesson-modal-title" className="text-base font-bold text-slate-900">
                Confirm Lesson Deletion
              </h2>
              <button
                type="button"
                onClick={() => setLessonToDelete(null)}
                aria-label="Close lesson delete confirmation"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete lesson{' '}
              <strong className="text-slate-900">{lessonToDelete.title}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLessonToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLesson}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
              >
                Delete Lesson
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
