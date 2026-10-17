import { NextResponse } from 'next/server';
import { authenticateRequest, readDb, writeDb } from '@/lib/server-db';
import {
  toPublicCurriculum,
  validateCourseInput,
  type Course,
} from '@/lib/lms-logic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeAll = url.searchParams.get('includeAll') === '1';
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const typeFilter = url.searchParams.get('type') || 'all';

    const caller = await authenticateRequest(request);
    const isAdmin = caller?.role === 'admin';

    const db = readDb();
    const allLessons = Object.values(db.lessons);

    let courses = Object.values(db.courses).filter((course) => {
      if (includeAll && isAdmin) return true;
      return course.isPublished;
    });

    if (typeFilter === 'free' || typeFilter === 'paid') {
      courses = courses.filter((c) => c.courseType === typeFilter);
    }

    if (search) {
      courses = courses.filter(
        (c) =>
          c.title.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search) ||
          c.category.toLowerCase().includes(search)
      );
    }

    courses.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const enriched = courses.map((course) => {
      const courseLessons = allLessons.filter((l) => l.courseId === course.id);
      const publicLessons = toPublicCurriculum(courseLessons);
      return {
        ...course,
        publishedLessonCount: publicLessons.length,
        totalLessonCount: isAdmin ? courseLessons.length : publicLessons.length,
      };
    });

    return NextResponse.json({ courses: enriched }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve courses.' }, { status: 500 });
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
        { error: 'Forbidden: Only administrators can create courses.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateCourseInput(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid course input.' },
        { status: validation.statusCode }
      );
    }

    const db = readDb();
    const now = new Date().toISOString();
    const id =
      typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(body.id) && !db.courses[body.id]
        ? body.id
        : `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const newCourse: Course = {
      id,
      ...validation.data,
      createdAt: now,
      updatedAt: now,
    };

    db.courses[id] = newCourse;
    writeDb(db);

    return NextResponse.json({ course: newCourse }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create course.' }, { status: 500 });
  }
}
