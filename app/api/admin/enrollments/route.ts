import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, readDbAsync, writeDb, writeDbAsync } from '@/lib/server-db';
import {
  calculateAdminEnrollmentMetrics,
  generateDeterministicSecretCode,
  toAccessStatusFromUpper,
  toEnrollmentStatusUpper,
  type Enrollment,
  type EnrollmentStatusUpper,
} from '@/lib/lms-logic';

export interface EnrichedAdminEnrollment extends Enrollment {
  status: EnrollmentStatusUpper;
  secretCode: string;
  paymentMethod: string;
  createdAt: string;
  activatedAt: string | null;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  coursePrice: number;
  courseType: 'free' | 'paid';
}

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

    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get('status') || 'ALL').trim().toUpperCase();
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));

    const db = await readDbAsync();
    const allCourses = Object.values(db.courses);
    const allEnrollments = Object.values(db.enrollments);

    const metrics = calculateAdminEnrollmentMetrics({
      courses: allCourses,
      enrollments: allEnrollments,
    });

    let mutated = false;
    const enriched: EnrichedAdminEnrollment[] = allEnrollments
      .map((enrollment) => {
        const student = db.users[enrollment.userId];
        const course = db.courses[enrollment.courseId];
        const statusUpper = toEnrollmentStatusUpper(enrollment);
        const resolvedCode =
          enrollment.secretCode ||
          generateDeterministicSecretCode(
            student?.email ? student.email.toLowerCase() : enrollment.userId,
            enrollment.courseId
          );

        if (!enrollment.secretCode) {
          enrollment.secretCode = resolvedCode;
          mutated = true;
        }

        return {
          ...enrollment,
          status: statusUpper,
          secretCode: resolvedCode,
          paymentMethod:
            enrollment.paymentMethod || (course?.courseType === 'free' ? 'Free' : 'bKash'),
          createdAt: enrollment.createdAt || enrollment.enrolledAt,
          activatedAt: enrollment.activatedAt ?? null,
          studentName: student?.displayName || enrollment.userId,
          studentEmail: student?.email || 'Unknown',
          courseTitle: course?.title || enrollment.courseId,
          coursePrice: course?.price ?? 0,
          courseType: course?.courseType ?? 'paid',
        };
      })
      .sort((a, b) => {
        // Pending approvals first, then newest createdAt
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });

    if (mutated) {
      await writeDbAsync(db);
    }

    const filtered = enriched.filter((item) => {
      if (
        statusFilter !== 'ALL' &&
        (statusFilter === 'PENDING' || statusFilter === 'ACTIVE' || statusFilter === 'REJECTED')
      ) {
        if (item.status !== statusFilter) return false;
      }

      if (search) {
        const matchesCode = item.secretCode.toLowerCase().includes(search);
        const matchesEmail = item.studentEmail.toLowerCase().includes(search);
        const matchesName = item.studentName.toLowerCase().includes(search);
        const matchesCourse = item.courseTitle.toLowerCase().includes(search);
        const matchesTrx = (item.trxId || '').toLowerCase().includes(search);
        if (!matchesCode && !matchesEmail && !matchesName && !matchesCourse && !matchesTrx) {
          return false;
        }
      }

      return true;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json(
      {
        enrollments: paginated,
        metrics,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve admin enrollments.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const body = (await request.json()) as Record<string, unknown>;
    const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId.trim() : '';
    const requestedStatus =
      typeof body.status === 'string' ? (body.status.toUpperCase() as EnrollmentStatusUpper) : null;

    if (!enrollmentId || !requestedStatus || !['PENDING', 'ACTIVE', 'REJECTED'].includes(requestedStatus)) {
      return NextResponse.json(
        { error: 'Valid enrollmentId and status (PENDING, ACTIVE, or REJECTED) are required.' },
        { status: 400 }
      );
    }

    const db = readDb();
    const existing = db.enrollments[enrollmentId];
    if (!existing) {
      return NextResponse.json({ error: 'Enrollment record not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updated: Enrollment = {
      ...existing,
      status: requestedStatus,
      accessStatus: toAccessStatusFromUpper(requestedStatus),
      activatedAt:
        requestedStatus === 'ACTIVE'
          ? now
          : requestedStatus === 'PENDING'
          ? null
          : existing.activatedAt ?? null,
      updatedAt: now,
    };

    db.enrollments[enrollmentId] = updated;
    writeDb(db);

    return NextResponse.json({ enrollment: updated }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to update enrollment.' }, { status: 500 });
  }
}
