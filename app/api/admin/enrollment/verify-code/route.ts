import { NextResponse } from 'next/server';
import { authenticateRequest, readDb } from '@/lib/server-db';
import {
  normalizeSecretCode,
  toEnrollmentStatusUpper,
} from '@/lib/lms-logic';

export async function POST(request: Request) {
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

    if (!normalizedCode || normalizedCode.length < 4) {
      return NextResponse.json(
        { error: 'Please enter a valid Secret Code (e.g., EDU-8F29K1).' },
        { status: 400 }
      );
    }

    const db = readDb();
    const matched = Object.values(db.enrollments).find(
      (e) => e.secretCode && normalizeSecretCode(e.secretCode) === normalizedCode
    );

    if (!matched) {
      return NextResponse.json(
        { error: `No enrollment record found matching Secret Code "${normalizedCode}".` },
        { status: 404 }
      );
    }

    const student = db.users[matched.userId];
    const course = db.courses[matched.courseId];
    const statusUpper = toEnrollmentStatusUpper(matched);

    return NextResponse.json(
      {
        verified: true,
        enrollment: {
          ...matched,
          status: statusUpper,
          studentName: student?.displayName || matched.userId,
          studentEmail: student?.email || 'Unknown email',
          courseTitle: course?.title || matched.courseId,
          coursePrice: course?.price ?? 0,
          courseType: course?.courseType ?? 'paid',
          courseCategory: course?.category ?? 'General',
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to verify Secret Code.' },
      { status: 500 }
    );
  }
}
