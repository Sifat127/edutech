import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, toPublicUserProfile } from '@/lib/server-db';
import { calculateAdminEnrollmentMetrics } from '@/lib/lms-logic';

export async function GET(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required.' },
        { status: 403 }
      );
    }

    const db = readDb();
    const courses = Object.values(db.courses).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const lessons = Object.values(db.lessons).sort(
      (a, b) => a.lessonOrder - b.lessonOrder
    );
    const users = Object.values(db.users)
      .map(toPublicUserProfile)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const enrollments = Object.values(db.enrollments).sort((a, b) =>
      b.enrolledAt.localeCompare(a.enrolledAt)
    );
    const progressRecords = Object.values(db.lessonProgress);

    const students = users.filter((u) => u.role === 'student');
    const enrollmentMetrics = calculateAdminEnrollmentMetrics({ courses, enrollments });

    return NextResponse.json(
      {
        stats: {
          totalCourses: courses.length,
          publishedCourses: courses.filter((c) => c.isPublished).length,
          totalLessons: lessons.length,
          publishedLessons: lessons.filter((l) => l.isPublished).length,
          totalStudents: students.length,
          totalUsers: users.length,
          activeEnrollments: enrollmentMetrics.totalEnrolledStudents,
          totalEnrollments: enrollments.length,
          totalRevenue: enrollmentMetrics.totalRevenue,
          pendingApprovals: enrollmentMetrics.pendingApprovals,
          rejectedEnrollments: enrollmentMetrics.rejectedEnrollments,
        },
        courses,
        lessons,
        users,
        enrollments,
        progressRecords,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load admin overview.' }, { status: 500 });
  }
}
