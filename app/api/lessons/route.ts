import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, writeDb } from '@/lib/server-db';
import {
  calculateCourseProgress,
  getAuthorizedCourseLessons,
  isValidId,
  makeEnrollmentId,
  validateLessonInput,
  type Lesson,
} from '@/lib/lms-logic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const courseId = (url.searchParams.get('courseId') || '').trim();

    if (!isValidId(courseId)) {
      return NextResponse.json({ error: 'A valid courseId parameter is required.' }, { status: 400 });
    }

    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json(
        { error: 'Please log in to access course lessons.' },
        { status: 401 }
      );
    }

    const db = readDb();
    const course = db.courses[courseId] ?? null;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const enrollment = db.enrollments[makeEnrollmentId(caller.uid, courseId)] ?? null;
    const allCourseLessons = Object.values(db.lessons).filter((l) => l.courseId === courseId);

    const authResult = getAuthorizedCourseLessons({
      user: caller,
      course,
      enrollment,
      lessons: allCourseLessons,
    });

    if (!authResult.valid || !authResult.data) {
      return NextResponse.json(
        {
          error: authResult.error || 'Access denied.',
          course: course.isPublished || caller.role === 'admin' ? course : undefined,
          enrollment,
        },
        { status: authResult.statusCode }
      );
    }

    const progress = calculateCourseProgress({
      courseId,
      userId: caller.uid,
      lessons: allCourseLessons,
      progressRecords: Object.values(db.lessonProgress),
    });

    return NextResponse.json(
      {
        course,
        lessons: authResult.data,
        enrollment,
        progress,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve lessons.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can add lessons.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateLessonInput(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid lesson payload.' },
        { status: validation.statusCode }
      );
    }

    const db = readDb();
    if (!db.courses[validation.data.courseId]) {
      return NextResponse.json(
        { error: 'Parent course does not exist.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const id =
      typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(body.id) && !db.lessons[body.id]
        ? body.id
        : `lesson_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const newLesson: Lesson = {
      id,
      ...validation.data,
      createdAt: now,
      updatedAt: now,
    };

    db.lessons[id] = newLesson;
    db.courses[validation.data.courseId].updatedAt = now;
    writeDb(db);

    return NextResponse.json({ lesson: newLesson }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create lesson.' }, { status: 500 });
  }
}
