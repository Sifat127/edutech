import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, readDbAsync, writeDb } from '@/lib/server-db';
import {
  calculateCourseProgress,
  isValidId,
  makeEnrollmentId,
  toPublicCurriculum,
  validateCourseInput,
} from '@/lib/lms-logic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
    }

    const db = await readDbAsync();
    const course = db.courses[id];
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const caller = await authenticateRequest(request);
    const isAdmin = caller?.role === 'admin';

    if (!course.isPublished && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Draft courses are not publicly accessible.' },
        { status: 403 }
      );
    }

    const courseLessons = Object.values(db.lessons).filter((l) => l.courseId === course.id);
    const curriculum = toPublicCurriculum(courseLessons);

    const callerUid = caller ? caller.uid : '';
    const callerEmail = caller?.email ? caller.email.toLowerCase() : '';
    const enrollment = caller
      ? db.enrollments[makeEnrollmentId(caller.uid, course.id)] ??
        Object.values(db.enrollments).find(
          (e) =>
            e.courseId === course.id &&
            (e.userId === callerUid ||
              (callerEmail && e.userId.toLowerCase() === callerEmail))
        ) ??
        null
      : null;

    const progress = caller
      ? calculateCourseProgress({
          courseId: course.id,
          userId: caller.uid,
          lessons: courseLessons,
          progressRecords: Object.values(db.lessonProgress),
        })
      : null;

    return NextResponse.json(
      {
        course,
        curriculum,
        enrollment,
        progress,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load course details.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can update courses.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
    }

    const db = readDb();
    const existing = db.courses[id];
    if (!existing) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const mergedPayload = {
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      thumbnailUrl: body.thumbnailUrl !== undefined ? body.thumbnailUrl : existing.thumbnailUrl,
      category: body.category !== undefined ? body.category : existing.category,
      courseType: body.courseType !== undefined ? body.courseType : existing.courseType,
      price: body.price !== undefined ? body.price : existing.price,
      isPublished: body.isPublished !== undefined ? body.isPublished : existing.isPublished,
    };

    const validation = validateCourseInput(mergedPayload);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid course update payload.' },
        { status: validation.statusCode }
      );
    }

    const updatedCourse = {
      ...existing,
      ...validation.data,
      updatedAt: new Date().toISOString(),
    };

    db.courses[id] = updatedCourse;
    writeDb(db);

    return NextResponse.json({ course: updatedCourse }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to update course.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await authenticateRequest(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can delete courses.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
    }

    const db = readDb();
    if (!db.courses[id]) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Atomic cleanup of course, associated lessons, enrollments, and progress records
    delete db.courses[id];

    for (const [lessonId, lesson] of Object.entries(db.lessons)) {
      if (lesson.courseId === id) {
        delete db.lessons[lessonId];
      }
    }

    for (const [enrollmentId, enrollment] of Object.entries(db.enrollments)) {
      if (enrollment.courseId === id) {
        delete db.enrollments[enrollmentId];
      }
    }

    for (const [progressId, progress] of Object.entries(db.lessonProgress)) {
      if (progress.courseId === id) {
        delete db.lessonProgress[progressId];
      }
    }

    writeDb(db);
    return NextResponse.json({ deleted: true, courseId: id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete course.' }, { status: 500 });
  }
}
