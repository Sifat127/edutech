import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, writeDb } from '@/lib/server-db';
import { isValidId, validateLessonInput } from '@/lib/lms-logic';

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
        { error: 'Forbidden: Only administrators can update lessons.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: 'Invalid lesson ID.' }, { status: 400 });
    }

    const db = readDb();
    const existing = db.lessons[id];
    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const mergedPayload = {
      courseId: existing.courseId,
      title: body.title !== undefined ? body.title : existing.title,
      youtubeUrl:
        body.youtubeUrl !== undefined
          ? body.youtubeUrl
          : body.youtubeVideoId !== undefined
          ? body.youtubeVideoId
          : existing.youtubeVideoId,
      lessonOrder: body.lessonOrder !== undefined ? body.lessonOrder : existing.lessonOrder,
      isPublished: body.isPublished !== undefined ? body.isPublished : existing.isPublished,
    };

    const validation = validateLessonInput(mergedPayload);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid lesson update payload.' },
        { status: validation.statusCode }
      );
    }

    const now = new Date().toISOString();
    const updatedLesson = {
      ...existing,
      ...validation.data,
      updatedAt: now,
    };

    db.lessons[id] = updatedLesson;
    if (db.courses[existing.courseId]) {
      db.courses[existing.courseId].updatedAt = now;
    }
    writeDb(db);

    return NextResponse.json({ lesson: updatedLesson }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to update lesson.' }, { status: 500 });
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
        { error: 'Forbidden: Only administrators can delete lessons.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: 'Invalid lesson ID.' }, { status: 400 });
    }

    const db = readDb();
    const existing = db.lessons[id];
    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
    }

    delete db.lessons[id];

    for (const [progressId, progress] of Object.entries(db.lessonProgress)) {
      if (progress.lessonId === id) {
        delete db.lessonProgress[progressId];
      }
    }

    writeDb(db);
    return NextResponse.json({ deleted: true, lessonId: id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete lesson.' }, { status: 500 });
  }
}
