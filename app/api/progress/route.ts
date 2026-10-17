import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, writeDb } from '@/lib/server-db';
import {
  calculateCourseProgress,
  canAccessCourseLessons,
  isValidId,
  makeEnrollmentId,
  makeProgressId,
  type LessonProgress,
} from '@/lib/lms-logic';

export async function GET(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const db = readDb();
    const records = Object.values(db.lessonProgress)
      .filter((p) => p.userId === caller.uid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json({ progressRecords: records }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve progress.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const lessonId = typeof body.lessonId === 'string' ? body.lessonId.trim() : '';
    const isCompleted = body.isCompleted !== undefined ? Boolean(body.isCompleted) : true;

    if (!isValidId(courseId) || !isValidId(lessonId)) {
      return NextResponse.json(
        { error: 'Valid courseId and lessonId are required.' },
        { status: 400 }
      );
    }

    // Prevent cross-user progress updates if userId is passed in body
    if (typeof body.userId === 'string' && body.userId !== caller.uid) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify another student’s lesson progress.' },
        { status: 403 }
      );
    }

    const db = readDb();
    const course = db.courses[courseId] ?? null;
    const lesson = db.lessons[lessonId] ?? null;

    if (!course || !lesson || lesson.courseId !== courseId) {
      return NextResponse.json({ error: 'Course or lesson not found.' }, { status: 404 });
    }

    if (!lesson.isPublished && caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Cannot track progress on an unpublished lesson.' },
        { status: 403 }
      );
    }

    const enrollment = db.enrollments[makeEnrollmentId(caller.uid, courseId)] ?? null;
    const access = canAccessCourseLessons({
      user: caller,
      course,
      enrollment,
    });

    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.statusCode });
    }

    const now = new Date().toISOString();
    const progressId = makeProgressId(caller.uid, lessonId);

    const record: LessonProgress = {
      id: progressId,
      userId: caller.uid,
      courseId,
      lessonId,
      isCompleted,
      completedAt: now,
      updatedAt: now,
    };

    db.lessonProgress[progressId] = record;
    writeDb(db);

    const summary = calculateCourseProgress({
      courseId,
      userId: caller.uid,
      lessons: Object.values(db.lessons).filter((l) => l.courseId === courseId),
      progressRecords: Object.values(db.lessonProgress),
    });

    return NextResponse.json({ record, summary }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to update lesson progress.' }, { status: 500 });
  }
}
