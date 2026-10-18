import { NextResponse } from 'next/server';
import { authenticateRequest, readDbAsync, writeDbAsync } from '@/lib/server-db';
import {
  BKASH_PAYMENT_CONFIG,
  canInitiatePaidEnrollment,
  generateDeterministicSecretCode,
  isValidId,
  makeEnrollmentId,
  normalizeSecretCode,
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
    const incomingCodeRaw =
      typeof body.secretCode === 'string' && body.secretCode.trim()
        ? body.secretCode.trim()
        : typeof body.existingSecretCode === 'string' && body.existingSecretCode.trim()
        ? body.existingSecretCode.trim()
        : undefined;

    const requestedSecretCode = incomingCodeRaw ? normalizeSecretCode(incomingCodeRaw) : undefined;

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

    const db = await readDbAsync();
    const course = db.courses[courseId] ?? null;

    // 1. Check primary ID key: `${caller.uid}_${courseId}`
    const enrollmentId = makeEnrollmentId(caller.uid, courseId);
    let existing: Enrollment | null = db.enrollments[enrollmentId] ?? null;

    // 2. Comprehensive check: find ANY enrollment for this course matching caller's UID or Email
    if (!existing) {
      existing =
        Object.values(db.enrollments).find(
          (e) =>
            e.courseId === courseId &&
            (e.userId === caller.uid ||
              (caller.email && e.userId.toLowerCase() === caller.email.toLowerCase()))
        ) ?? null;
    }

    const check = canInitiatePaidEnrollment({
      user: caller,
      course,
      existingEnrollment: existing,
    });

    if (!check.allowed || !course) {
      return NextResponse.json({ error: check.reason }, { status: check.statusCode });
    }

    const now = new Date().toISOString();

    // FIXED PERMANENT CODE:
    // If an enrollment already exists for this student & course, or if a code was assigned,
    // that Secret Code is IMMUTABLE and MUST NEVER be re-generated or changed.
    const preservedSecretCode =
      existing?.secretCode ||
      (requestedSecretCode && /^EDU-[A-Z0-9]{6}$/.test(requestedSecretCode)
        ? requestedSecretCode
        : null);

    if (existing && preservedSecretCode) {
      const updatedExisting: Enrollment = {
        ...existing,
        id: existing.id || enrollmentId,
        userId: existing.userId || caller.uid,
        courseId,
        secretCode: preservedSecretCode, // Stays 100% fixed
        accessStatus: existing.accessStatus || 'pending',
        status: existing.status || 'PENDING',
        paymentMethod: existing.paymentMethod || 'bKash',
        trxId: trxId !== undefined ? trxId : existing.trxId,
        senderPhone: senderPhone !== undefined ? senderPhone : existing.senderPhone,
        updatedAt: now,
      };

      db.enrollments[updatedExisting.id] = updatedExisting;
      if (updatedExisting.id !== enrollmentId) {
        db.enrollments[enrollmentId] = updatedExisting;
      }
      await writeDbAsync(db);

      return NextResponse.json(
        {
          enrollment: updatedExisting,
          secretCode: preservedSecretCode,
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

    // If no prior enrollment existed with a code, generate a deterministic fixed code.
    // CRITICAL: Filter out this student's own records to prevent self-collision!
    const otherUsersCodes = Object.values(db.enrollments)
      .filter(
        (e) =>
          e.userId !== caller.uid &&
          (!caller.email || e.userId.toLowerCase() !== caller.email.toLowerCase())
      )
      .map((e) => e.secretCode)
      .filter((code): code is string => Boolean(code));

    const studentSeed = caller.email ? caller.email.toLowerCase() : caller.uid.toLowerCase();
    const finalSecretCode =
      preservedSecretCode ||
      generateDeterministicSecretCode(studentSeed, course.id, otherUsersCodes);

    const pendingEnrollment: Enrollment = {
      id: enrollmentId,
      userId: caller.uid,
      courseId: course.id,
      accessStatus: 'pending',
      status: 'PENDING',
      secretCode: finalSecretCode,
      paymentMethod: 'bKash',
      ...(trxId ? { trxId } : {}),
      ...(senderPhone ? { senderPhone } : {}),
      createdAt: now,
      activatedAt: null,
      enrolledAt: now,
      updatedAt: now,
    };

    db.enrollments[enrollmentId] = pendingEnrollment;
    await writeDbAsync(db);

    return NextResponse.json(
      {
        enrollment: pendingEnrollment,
        secretCode: finalSecretCode,
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
