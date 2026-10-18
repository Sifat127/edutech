import { NextResponse } from 'next/server';
import { authenticateRequest, readDbAsync, writeDbAsync } from '@/lib/server-db';
import {
  normalizeSecretCode,
  type AccessStatus,
  type Enrollment,
  type EnrollmentStatusUpper,
} from '@/lib/lms-logic';

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
    const normalizedCode = normalizeSecretCode(body.secretCode);
    const requestedAction =
      typeof body.action === 'string' && body.action.toUpperCase() === 'REJECT'
        ? 'REJECT'
        : 'APPROVE';

    if (!normalizedCode || normalizedCode.length < 4) {
      return NextResponse.json(
        { error: 'A valid Secret Code is required to activate course access.' },
        { status: 400 }
      );
    }

    const db = await readDbAsync();
    const matched = Object.values(db.enrollments).find(
      (e) => e.secretCode && normalizeSecretCode(e.secretCode) === normalizedCode
    );

    if (!matched) {
      return NextResponse.json(
        { error: `No enrollment found matching Secret Code "${normalizedCode}".` },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const nextStatusUpper: EnrollmentStatusUpper =
      requestedAction === 'REJECT' ? 'REJECTED' : 'ACTIVE';
    const nextAccessStatus: AccessStatus =
      requestedAction === 'REJECT' ? 'revoked' : 'active';

    const updated: Enrollment = {
      ...matched,
      accessStatus: nextAccessStatus,
      status: nextStatusUpper,
      paymentMethod: matched.paymentMethod || 'bKash',
      createdAt: matched.createdAt || matched.enrolledAt,
      activatedAt: nextStatusUpper === 'ACTIVE' ? now : null,
      updatedAt: now,
    };

    db.enrollments[matched.id] = updated;
    await writeDbAsync(db);

    const student = db.users[updated.userId];
    const course = db.courses[updated.courseId];

    return NextResponse.json(
      {
        enrollment: {
          ...updated,
          studentName: student?.displayName || updated.userId,
          studentEmail: student?.email || 'Unknown email',
          courseTitle: course?.title || updated.courseId,
          coursePrice: course?.price ?? 0,
          courseType: course?.courseType ?? 'paid',
        },
        message:
          nextStatusUpper === 'ACTIVE'
            ? `Secret Code ${updated.secretCode} approved! Course "${course?.title || updated.courseId}" is now unlocked for ${student?.displayName || updated.userId}.`
            : `Enrollment for Secret Code ${updated.secretCode} has been rejected.`,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to update enrollment status by Secret Code.' },
      { status: 500 }
    );
  }
}
