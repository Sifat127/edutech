import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, writeDb } from '@/lib/server-db';
import {
  BKASH_PAYMENT_CONFIG,
  canInitiatePaidEnrollment,
  generateSecretCode,
  isValidId,
  makeEnrollmentId,
  type Enrollment,
} from '@/lib/lms-logic';

export async function POST(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json(
        { error: 'Please log in to your student account to initiate purchase.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const trxId =
      typeof body.trxId === 'string' && body.trxId.trim()
        ? body.trxId.trim().slice(0, 64)
        : undefined;
    const senderPhone =
      typeof body.senderPhone === 'string' && body.senderPhone.trim()
        ? body.senderPhone.trim().slice(0, 32)
        : undefined;

    if (!isValidId(courseId)) {
      return NextResponse.json({ error: 'A valid courseId is required.' }, { status: 400 });
    }

    const db = readDb();
    const course = db.courses[courseId] ?? null;
    const enrollmentId = makeEnrollmentId(caller.uid, courseId);
    const existing = db.enrollments[enrollmentId] ?? null;

    const check = canInitiatePaidEnrollment({
      user: caller,
      course,
      existingEnrollment: existing,
    });

    if (!check.allowed || !course) {
      return NextResponse.json({ error: check.reason }, { status: check.statusCode });
    }

    const now = new Date().toISOString();

    // If a PENDING enrollment with a secretCode already exists for this student & course,
    // preserve the existing Secret Code and optionally attach updated trxId / senderPhone.
    if (
      existing &&
      (existing.accessStatus === 'pending' || existing.status === 'PENDING') &&
      existing.secretCode
    ) {
      const updatedExisting: Enrollment = {
        ...existing,
        accessStatus: 'pending',
        status: 'PENDING',
        paymentMethod: existing.paymentMethod || 'bKash',
        trxId: trxId ?? existing.trxId,
        senderPhone: senderPhone ?? existing.senderPhone,
        updatedAt: now,
      };
      db.enrollments[enrollmentId] = updatedExisting;
      writeDb(db);

      return NextResponse.json(
        {
          enrollment: updatedExisting,
          secretCode: updatedExisting.secretCode,
          course: {
            id: course.id,
            title: course.title,
            price: course.price,
            category: course.category,
          },
          bkashConfig: BKASH_PAYMENT_CONFIG,
          isExistingPending: true,
        },
        { status: 200 }
      );
    }

    const existingCodes = Object.values(db.enrollments)
      .map((e) => e.secretCode)
      .filter((code): code is string => Boolean(code));

    const secretCode = generateSecretCode(existingCodes);

    const pendingEnrollment: Enrollment = {
      id: enrollmentId,
      userId: caller.uid,
      courseId: course.id,
      accessStatus: 'pending',
      status: 'PENDING',
      secretCode,
      paymentMethod: 'bKash',
      ...(trxId ? { trxId } : {}),
      ...(senderPhone ? { senderPhone } : {}),
      createdAt: now,
      activatedAt: null,
      enrolledAt: now,
      updatedAt: now,
    };

    db.enrollments[enrollmentId] = pendingEnrollment;
    writeDb(db);

    return NextResponse.json(
      {
        enrollment: pendingEnrollment,
        secretCode,
        course: {
          id: course.id,
          title: course.title,
          price: course.price,
          category: course.category,
        },
        bkashConfig: BKASH_PAYMENT_CONFIG,
        isExistingPending: false,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to initiate bKash course enrollment.' },
      { status: 500 }
    );
  }
}
