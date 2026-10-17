import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeVideoId,
  buildYouTubeEmbedUrl,
  validateCourseInput,
  validateLessonInput,
  canAccessCourseLessons,
  canEnrollInFreeCourse,
  toPublicCurriculum,
  getAuthorizedCourseLessons,
  calculateCourseProgress,
  calculateCourseStudentDistribution,
  type Course,
  type Lesson,
  type Enrollment,
  type LessonProgress,
} from './lms-logic.ts';

test('extractYouTubeVideoId extracts valid IDs from standard watch, youtu.be, and embed URLs', () => {
  const watchRes = extractYouTubeVideoId('https://www.youtube.com/watch?v=M7lc1UVf-VE&t=12s');
  assert.equal(watchRes.valid, true);
  assert.equal(watchRes.data, 'M7lc1UVf-VE');

  const shortRes = extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=12345');
  assert.equal(shortRes.valid, true);
  assert.equal(shortRes.data, 'dQw4w9WgXcQ');

  const embedRes = extractYouTubeVideoId('https://www.youtube.com/embed/aqz-KE-bpKQ');
  assert.equal(embedRes.valid, true);
  assert.equal(embedRes.data, 'aqz-KE-bpKQ');
});

test('extractYouTubeVideoId rejects iframe HTML, non-YouTube domains, and malformed IDs', () => {
  const iframeRes = extractYouTubeVideoId('<iframe src="https://www.youtube.com/embed/M7lc1UVf-VE"></iframe>');
  assert.equal(iframeRes.valid, false);
  assert.equal(iframeRes.statusCode, 400);

  const evilDomainRes = extractYouTubeVideoId('https://vimeo.com/12345678901');
  assert.equal(evilDomainRes.valid, false);

  const shortIdRes = extractYouTubeVideoId('https://www.youtube.com/watch?v=short');
  assert.equal(shortIdRes.valid, false);
});

test('buildYouTubeEmbedUrl formats official embed link with rel=0', () => {
  assert.equal(
    buildYouTubeEmbedUrl('M7lc1UVf-VE'),
    'https://www.youtube.com/embed/M7lc1UVf-VE?rel=0'
  );
});

test('validateCourseInput enforces free course price === 0 and paid course price >= 0', () => {
  const invalidFree = validateCourseInput({
    title: 'Intro to TypeScript',
    description: 'Comprehensive guide',
    thumbnailUrl: '/thumbnails/typescript.svg',
    category: 'Software Engineering',
    courseType: 'free',
    price: 25,
    isPublished: true,
  });
  assert.equal(invalidFree.valid, false);
  assert.equal(invalidFree.statusCode, 400);

  const validFree = validateCourseInput({
    title: 'Intro to TypeScript',
    description: 'Comprehensive guide',
    thumbnailUrl: '/thumbnails/typescript.svg',
    category: 'Software Engineering',
    courseType: 'free',
    price: 0,
    isPublished: true,
  });
  assert.equal(validFree.valid, true);
  assert.equal(validFree.data?.price, 0);

  const invalidPaid = validateCourseInput({
    title: 'Cloud Architecture',
    description: 'Deep dive',
    thumbnailUrl: '/thumbnails/fullstack.svg',
    category: 'Cloud',
    courseType: 'paid',
    price: -10,
    isPublished: true,
  });
  assert.equal(invalidPaid.valid, false);
});

test('canEnrollInFreeCourse blocks self-enrollment in paid courses and prevents duplicates', () => {
  const student = { uid: 'user_1', role: 'student' as const };
  const freeCourse = { id: 'course_free', courseType: 'free' as const, isPublished: true };
  const paidCourse = { id: 'course_paid', courseType: 'paid' as const, isPublished: true };

  // Allowed on free course when not enrolled
  const res1 = canEnrollInFreeCourse({ user: student, course: freeCourse, existingEnrollment: null });
  assert.equal(res1.allowed, true);
  assert.equal(res1.statusCode, 201);

  // Conflict on duplicate enrollment
  const resDuplicate = canEnrollInFreeCourse({
    user: student,
    course: freeCourse,
    existingEnrollment: { userId: 'user_1', courseId: 'course_free', accessStatus: 'active' },
  });
  assert.equal(resDuplicate.allowed, false);
  assert.equal(resDuplicate.statusCode, 409);

  // Blocked on paid course for student
  const resPaid = canEnrollInFreeCourse({ user: student, course: paidCourse, existingEnrollment: null });
  assert.equal(resPaid.allowed, false);
  assert.equal(resPaid.statusCode, 403);
});

test('canAccessCourseLessons and getAuthorizedCourseLessons enforce active enrollment and strip unpublished lessons', () => {
  const student = { uid: 'user_1', role: 'student' as const };
  const admin = { uid: 'admin_1', role: 'admin' as const };
  const paidCourse: Course = {
    id: 'course_paid',
    title: 'Distributed Systems',
    description: 'Desc',
    thumbnailUrl: '/thumbnails/database.svg',
    category: 'Systems',
    courseType: 'paid',
    price: 79,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const lessons: Lesson[] = [
    {
      id: 'lesson_1',
      courseId: 'course_paid',
      title: 'Lesson 1: Consensus',
      youtubeVideoId: 'M7lc1UVf-VE',
      lessonOrder: 1,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'lesson_2',
      courseId: 'course_paid',
      title: 'Lesson 2: Draft Topic',
      youtubeVideoId: 'dQw4w9WgXcQ',
      lessonOrder: 2,
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Unenrolled student is denied
  const deniedUnenrolled = getAuthorizedCourseLessons({
    user: student,
    course: paidCourse,
    enrollment: null,
    lessons,
  });
  assert.equal(deniedUnenrolled.valid, false);
  assert.equal(deniedUnenrolled.statusCode, 403);

  // Revoked student is denied
  const revokedEnrollment: Enrollment = {
    id: 'user_1_course_paid',
    userId: 'user_1',
    courseId: 'course_paid',
    accessStatus: 'revoked',
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const deniedRevoked = getAuthorizedCourseLessons({
    user: student,
    course: paidCourse,
    enrollment: revokedEnrollment,
    lessons,
  });
  assert.equal(deniedRevoked.valid, false);
  assert.equal(deniedRevoked.statusCode, 403);

  // Active student receives only published lessons
  const activeEnrollment: Enrollment = {
    ...revokedEnrollment,
    accessStatus: 'active',
  };
  const allowedActive = getAuthorizedCourseLessons({
    user: student,
    course: paidCourse,
    enrollment: activeEnrollment,
    lessons,
  });
  assert.equal(allowedActive.valid, true);
  assert.equal(allowedActive.data?.length, 1);
  assert.equal(allowedActive.data?.[0].id, 'lesson_1');

  // Admin receives both published and draft lessons
  const allowedAdmin = getAuthorizedCourseLessons({
    user: admin,
    course: paidCourse,
    enrollment: null,
    lessons,
  });
  assert.equal(allowedAdmin.valid, true);
  assert.equal(allowedAdmin.data?.length, 2);

  // Public curriculum strips youtubeVideoId and draft lessons
  const publicCurriculum = toPublicCurriculum(lessons);
  assert.equal(publicCurriculum.length, 1);
  assert.equal('youtubeVideoId' in publicCurriculum[0], false);
});

test('calculateCourseProgress computes exact completion percentage and nextLessonId', () => {
  const now = new Date().toISOString();
  const lessons: Lesson[] = [
    { id: 'l1', courseId: 'c1', title: 'L1', youtubeVideoId: 'M7lc1UVf-VE', lessonOrder: 1, isPublished: true, createdAt: now, updatedAt: now },
    { id: 'l2', courseId: 'c1', title: 'L2', youtubeVideoId: 'M7lc1UVf-VE', lessonOrder: 2, isPublished: true, createdAt: now, updatedAt: now },
    { id: 'l3', courseId: 'c1', title: 'L3 Draft', youtubeVideoId: 'M7lc1UVf-VE', lessonOrder: 3, isPublished: false, createdAt: now, updatedAt: now },
  ];
  const progressRecords: LessonProgress[] = [
    { id: 'u1_l1', userId: 'u1', courseId: 'c1', lessonId: 'l1', isCompleted: true, completedAt: now, updatedAt: now },
    { id: 'u2_l2', userId: 'u2', courseId: 'c1', lessonId: 'l2', isCompleted: true, completedAt: now, updatedAt: now },
  ];

  const summary = calculateCourseProgress({
    courseId: 'c1',
    userId: 'u1',
    lessons,
    progressRecords,
  });

  assert.equal(summary.totalPublishedLessons, 2);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.percentage, 50);
  assert.equal(summary.nextLessonId, 'l2');
});

test('calculateCourseStudentDistribution ranks courses by active student count and computes share percentage', () => {
  const now = new Date().toISOString();
  const courses: Course[] = [
    {
      id: 'c1',
      title: 'Course Alpha',
      description: 'Desc',
      thumbnailUrl: '/thumbnails/typescript.svg',
      category: 'Engineering',
      courseType: 'free',
      price: 0,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'c2',
      title: 'Course Beta With A Very Long Title For Axis Truncation',
      description: 'Desc',
      thumbnailUrl: '/thumbnails/database.svg',
      category: 'Security',
      courseType: 'paid',
      price: 99,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const enrollments: Enrollment[] = [
    { id: 'u1_c2', userId: 'u1', courseId: 'c2', accessStatus: 'active', enrolledAt: now, updatedAt: now },
    { id: 'u2_c2', userId: 'u2', courseId: 'c2', accessStatus: 'active', enrolledAt: now, updatedAt: now },
    { id: 'u3_c2', userId: 'u3', courseId: 'c2', accessStatus: 'revoked', enrolledAt: now, updatedAt: now },
    { id: 'u1_c1', userId: 'u1', courseId: 'c1', accessStatus: 'active', enrolledAt: now, updatedAt: now },
  ];

  const dist = calculateCourseStudentDistribution({ courses, enrollments });
  assert.equal(dist.length, 2);
  assert.equal(dist[0].courseId, 'c2');
  assert.equal(dist[0].activeStudents, 2);
  assert.equal(dist[0].inactiveStudents, 1);
  assert.equal(dist[0].totalStudents, 3);
  assert.equal(dist[0].sharePercentage, 67);

  assert.equal(dist[1].courseId, 'c1');
  assert.equal(dist[1].activeStudents, 1);
  assert.equal(dist[1].sharePercentage, 33);
});

