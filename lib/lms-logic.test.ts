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
  calculateCompletionTrends,
  calculateAdminEnrollmentMetrics,
  canInitiatePaidEnrollment,
  generateSecretCode,
  isValidSecretCodeFormat,
  normalizeSecretCode,
  clampVolume,
  computeSeekOffset,
  getQualityShortLabel,
  getQualityTargetDimensions,
  buildYouTubeQualityCommands,
  isValidVideoQualityCode,
  YOUTUBE_QUALITY_OPTIONS,
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

test('generateSecretCode, normalizeSecretCode, and isValidSecretCodeFormat handle bKash secret codes', () => {
  const code = generateSecretCode(['EDU-8F29K1']);
  assert.equal(isValidSecretCodeFormat(code), true);
  assert.notEqual(code, 'EDU-8F29K1');
  assert.equal(normalizeSecretCode('  edu-8f29k1 '), 'EDU-8F29K1');
  assert.equal(normalizeSecretCode('edu8f29k1'), 'EDU-8F29K1');
  assert.equal(isValidSecretCodeFormat('edu-8f29k1'), true);
  assert.equal(isValidSecretCodeFormat('INVALID'), false);
});

test('canInitiatePaidEnrollment and calculateAdminEnrollmentMetrics enforce bKash purchase rules and revenue math', () => {
  const now = new Date().toISOString();
  const paidCourse: Course = {
    id: 'c_paid',
    title: 'Cloud Security',
    description: 'Desc',
    thumbnailUrl: '/thumbnails/database.svg',
    category: 'Security',
    courseType: 'paid',
    price: 120,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  };
  const freeCourse: Course = {
    ...paidCourse,
    id: 'c_free',
    courseType: 'free',
    price: 0,
  };

  assert.equal(
    canInitiatePaidEnrollment({
      user: { uid: 'u1', role: 'student' },
      course: paidCourse,
      existingEnrollment: null,
    }).allowed,
    true
  );

  assert.equal(
    canInitiatePaidEnrollment({
      user: { uid: 'u1', role: 'student' },
      course: freeCourse,
      existingEnrollment: null,
    }).allowed,
    false
  );

  assert.equal(
    canInitiatePaidEnrollment({
      user: { uid: 'u1', role: 'student' },
      course: paidCourse,
      existingEnrollment: {
        id: 'u1_c_paid',
        userId: 'u1',
        courseId: 'c_paid',
        accessStatus: 'active',
        status: 'ACTIVE',
      },
    }).allowed,
    false
  );

  const metrics = calculateAdminEnrollmentMetrics({
    courses: [paidCourse, freeCourse],
    enrollments: [
      {
        id: 'u1_c_paid',
        userId: 'u1',
        courseId: 'c_paid',
        accessStatus: 'active',
        status: 'ACTIVE',
        secretCode: 'EDU-4M92C7',
        enrolledAt: now,
        updatedAt: now,
      },
      {
        id: 'u2_c_paid',
        userId: 'u2',
        courseId: 'c_paid',
        accessStatus: 'pending',
        status: 'PENDING',
        secretCode: 'EDU-8F29K1',
        enrolledAt: now,
        updatedAt: now,
      },
    ],
  });

  assert.equal(metrics.totalEnrolledStudents, 1);
  assert.equal(metrics.totalRevenue, 120);
  assert.equal(metrics.pendingApprovals, 1);
  assert.equal(metrics.activeCourses, 2);
});

test('clampVolume clamps and rounds manual volume values (including 33%, 0%, 100%)', () => {
  assert.equal(clampVolume(33), 33);
  assert.equal(clampVolume('33'), 33);
  assert.equal(clampVolume(33.4), 33);
  assert.equal(clampVolume(0), 0);
  assert.equal(clampVolume(100), 100);
  assert.equal(clampVolume(-15), 0);
  assert.equal(clampVolume(145), 100);
  assert.equal(clampVolume('invalid', 33), 33);
});

test('computeSeekOffset calculates +10s forward and -10s backward safely within bounds', () => {
  assert.equal(computeSeekOffset(45, 10, 300), 55);
  assert.equal(computeSeekOffset(45, -10, 300), 35);
  assert.equal(computeSeekOffset(4, -10, 300), 0);
  assert.equal(computeSeekOffset(295, 10, 300), 300);
});

test('video quality helpers validate quality codes and buildYouTubeEmbedUrl includes vq parameter', () => {
  assert.equal(YOUTUBE_QUALITY_OPTIONS.length, 6);
  assert.equal(isValidVideoQualityCode('hd1080'), true);
  assert.equal(isValidVideoQualityCode('hd720'), true);
  assert.equal(isValidVideoQualityCode('large'), true);
  assert.equal(isValidVideoQualityCode('4k_ultra'), false);
  assert.equal(getQualityShortLabel('hd1080'), '1080p');
  assert.equal(getQualityShortLabel('hd720'), '720p');
  assert.equal(getQualityShortLabel('default'), 'Auto');

  const urlWithQuality = buildYouTubeEmbedUrl('BwuLxPH8IDs', {
    autoplay: true,
    vq: 'hd1080',
    start: 130,
    origin: 'http://localhost:3000',
  });
  assert.equal(urlWithQuality.includes('vq=hd1080'), true);
  assert.equal(urlWithQuality.includes('hd=1'), true);
  assert.equal(urlWithQuality.includes('enablejsapi=1'), true);
  assert.equal(urlWithQuality.includes('widgetid=1'), true);
  assert.equal(urlWithQuality.includes('origin=http%3A%2F%2Flocalhost%3A3000'), true);
  assert.equal(urlWithQuality.includes('start=130'), true);

  assert.deepEqual(getQualityTargetDimensions('hd1080'), { width: 1920, height: 1080 });
  assert.deepEqual(getQualityTargetDimensions('default'), { width: 1920, height: 1080 });
  assert.deepEqual(getQualityTargetDimensions('hd720'), { width: 1280, height: 720 });
  assert.deepEqual(getQualityTargetDimensions('large'), { width: 854, height: 480 });
  assert.deepEqual(getQualityTargetDimensions('medium'), { width: 640, height: 360 });
  assert.deepEqual(getQualityTargetDimensions('small'), { width: 426, height: 240 });

  const commands1080 = buildYouTubeQualityCommands('hd1080', {
    videoId: 'BwuLxPH8IDs',
    startSeconds: 42.8,
    reloadStream: true,
    isPaused: false,
  });
  assert.deepEqual(commands1080[0], { func: 'setSize', args: [1920, 1080] });
  assert.deepEqual(commands1080[1], {
    func: 'setPlaybackQualityRange',
    args: ['hd1080', 'hd1080'],
  });
  assert.deepEqual(commands1080[2], { func: 'setPlaybackQuality', args: ['hd1080'] });
  assert.deepEqual(commands1080[3], {
    func: 'loadVideoById',
    args: [{ videoId: 'BwuLxPH8IDs', startSeconds: 42, suggestedQuality: 'hd1080' }],
  });
});

test('calculateCompletionTrends handles empty progress records smoothly', () => {
  const result = calculateCompletionTrends([], 30, '2026-10-17T12:00:00.000Z');
  assert.equal(result.points.length, 30);
  assert.equal(result.totalCompletionsLast30Days, 0);
  assert.equal(result.activeDaysCount, 0);
  assert.equal(result.currentStreakDays, 0);
  assert.equal(result.longestStreakDays, 0);
  assert.equal(result.dailyAverage, 0);
  assert.equal(result.consistencyPercentage, 0);
  assert.equal(result.bestDay, null);
  assert.equal(result.points[29].date, '2026-10-17');
});

test('calculateCompletionTrends accurately calculates completions, cumulative counts, and streaks', () => {
  const refDate = '2026-10-17T12:00:00.000Z';
  const sampleProgress: LessonProgress[] = [
    // 2 completions on 2026-10-17 (today)
    {
      id: 'p1',
      userId: 'u1',
      courseId: 'c1',
      lessonId: 'l1',
      isCompleted: true,
      completedAt: '2026-10-17T09:00:00.000Z',
      updatedAt: '2026-10-17T09:00:00.000Z',
    },
    {
      id: 'p2',
      userId: 'u1',
      courseId: 'c1',
      lessonId: 'l2',
      isCompleted: true,
      completedAt: '2026-10-17T11:00:00.000Z',
      updatedAt: '2026-10-17T11:00:00.000Z',
    },
    // 1 completion on 2026-10-16 (yesterday)
    {
      id: 'p3',
      userId: 'u1',
      courseId: 'c2',
      lessonId: 'l3',
      isCompleted: true,
      completedAt: '2026-10-16T15:30:00.000Z',
      updatedAt: '2026-10-16T15:30:00.000Z',
    },
    // 1 completion on 2026-10-15
    {
      id: 'p4',
      userId: 'u1',
      courseId: 'c2',
      lessonId: 'l4',
      isCompleted: true,
      completedAt: '2026-10-15T08:00:00.000Z',
      updatedAt: '2026-10-15T08:00:00.000Z',
    },
    // 1 completion on 2026-10-10
    {
      id: 'p5',
      userId: 'u1',
      courseId: 'c1',
      lessonId: 'l5',
      isCompleted: true,
      completedAt: '2026-10-10T14:00:00.000Z',
      updatedAt: '2026-10-10T14:00:00.000Z',
    },
    // Incomplete record (should be ignored)
    {
      id: 'p6',
      userId: 'u1',
      courseId: 'c1',
      lessonId: 'l6',
      isCompleted: false,
      completedAt: '2026-10-17T11:30:00.000Z',
      updatedAt: '2026-10-17T11:30:00.000Z',
    },
  ];

  const result = calculateCompletionTrends(sampleProgress, 30, refDate);
  assert.equal(result.points.length, 30);
  assert.equal(result.totalCompletionsLast30Days, 5);
  assert.equal(result.activeDaysCount, 4);
  // Consecutive active days: Oct 15, 16, 17 -> streak of 3
  assert.equal(result.currentStreakDays, 3);
  assert.equal(result.longestStreakDays, 3);
  assert.equal(result.bestDay?.count, 2);
  assert.equal(result.bestDay?.date, '2026-10-17');
  // Check cumulative count on the last day equals total
  assert.equal(result.points[29].cumulativeCount, 5);
  assert.equal(result.points[29].completedCount, 2);
});

