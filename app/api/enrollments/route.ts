import { NextResponse } from 'next/server';
import { authenticateRequest, readDbAsync, writeDbAsync } from '@/lib/server-db';
import {
  canEnrollInFreeCourse,
  generateSecretCode,
  isValidId,
  makeEnrollmentId,
  type AccessStatus,
  type Enrollment,
} from '@/lib/lms-logic';

export async function GET(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const allParam = url.searchParams.get('all') === '1';
    const db = await readDbAsync();

    if (allParam && caller.role === 'admin') {
      const enrollments = Object.values(db.enrollments).sort((a, b) =>
        b.enrolledAt.localeCompare(a.enrolledAt)
      );
      return NextResponse.json({ enrollments }, { status: 200 });
    }

    const userEnrollments = Object.values(db.enrollments)
      .filter((e) => e.userId === caller.uid)
      .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));

    return NextResponse.json({ enrollments: userEnrollments }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve enrollments.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required to enroll.' }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';

    if (!isValidId(courseId)) {
      return NextResponse.json({ error: 'A valid courseId is required.' }, { status: 400 });
    }

    const db = await readDbAsync();
    const course = db.courses[courseId] ?? null;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Admin manual enrollment grant or revocation
    if (caller.role === 'admin' && typeof body.userId === 'string') {
      const targetUserId = body.userId.trim();
      if (!isValidId(targetUserId) || !db.users[targetUserId]) {
        return NextResponse.json({ error: 'Target student user not found.' }, { status: 404 });
      }

      const requestedStatus = body.accessStatus as AccessStatus | undefined;
      const accessStatus: AccessStatus =
        requestedStatus === 'revoked' ||
        requestedStatus === 'rejected' ||
        requestedStatus === 'pending'
          ? requestedStatus
          : 'active';

      const statusUpper =
        accessStatus === 'active'
          ? 'ACTIVE'
          : accessStatus === 'pending'
          ? 'PENDING'
          : 'REJECTED';

      const enrollmentId = makeEnrollmentId(targetUserId, courseId);
      const existing = db.enrollments[enrollmentId];
      const existingCodes = Object.values(db.enrollments)
        .map((e) => e.secretCode)
        .filter((c): c is string => Boolean(c));

      const updated: Enrollment = {
        id: enrollmentId,
        userId: targetUserId,
        courseId,
        accessStatus,
        status: statusUpper,
        secretCode: existing?.secretCode || generateSecretCode(existingCodes),
        paymentMethod:
          existing?.paymentMethod || (course.courseType === 'free' ? 'Free' : 'bKash'),
        createdAt: existing?.createdAt || existing?.enrolledAt || now,
        activatedAt: statusUpper === 'ACTIVE' ? now : existing?.activatedAt ?? null,
        enrolledAt: existing ? existing.enrolledAt : now,
        updatedAt: now,
      };

      db.enrollments[enrollmentId] = updated;
      await writeDbAsync(db);

      return NextResponse.json(
        { enrollment: updated },
        { status: existing ? 200 : 201 }
      );
    }

    // Student self-enrollment (strictly restricted to published free courses)
    const enrollmentId = makeEnrollmentId(caller.uid, courseId);
    const existing = db.enrollments[enrollmentId] ?? null;

    const check = canEnrollInFreeCourse({
      user: caller,
      course,
      existingEnrollment: existing,
    });

    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: check.statusCode });
    }

    const existingCodes = Object.values(db.enrollments)
      .map((e) => e.secretCode)
      .filter((c): c is string => Boolean(c));

    const newEnrollment: Enrollment = {
      id: enrollmentId,
      userId: caller.uid,
      courseId,
      accessStatus: 'active',
      status: 'ACTIVE',
      secretCode: existing?.secretCode || generateSecretCode(existingCodes),
      paymentMethod: 'Free',
      createdAt: now,
      activatedAt: now,
      enrolledAt: now,
      updatedAt: now,
    };

    db.enrollments[enrollmentId] = newEnrollment;
    await writeDbAsync(db);

    return NextResponse.json({ enrollment: newEnrollment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to process enrollment.' }, { status: 500 });
  }
}
