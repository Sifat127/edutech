export type UserRole = 'student' | 'admin';
export type CourseType = 'free' | 'paid';
export type AccessStatus = 'active' | 'revoked' | 'pending';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  courseType: CourseType;
  price: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  youtubeVideoId: string;
  lessonOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicLessonSummary {
  id: string;
  courseId: string;
  title: string;
  lessonOrder: number;
  isPublished: boolean;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  accessStatus: AccessStatus;
  enrolledAt: string;
  updatedAt: string;
}

export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  isCompleted: boolean;
  completedAt: string;
  updatedAt: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
export const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
export const BOOTSTRAP_ADMIN_EMAIL = 'shefatahmed5959@gmail.com';

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

export function makeEnrollmentId(userId: string, courseId: string): string {
  return `${userId}_${courseId}`;
}

export function makeProgressId(userId: string, lessonId: string): string {
  return `${userId}_${lessonId}`;
}

/**
 * Extracts and validates an 11-character YouTube video ID from standard YouTube URLs:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * Rejects iframe HTML, unsupported domains, or malformed video IDs.
 */
export function extractYouTubeVideoId(input: unknown): ValidationResult<string> {
  if (typeof input !== 'string') {
    return { valid: false, error: 'YouTube URL or video ID must be a string.', statusCode: 400 };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: 'YouTube URL is required.', statusCode: 400 };
  }

  // Reject raw HTML or iframe tags immediately
  if (trimmed.includes('<') || trimmed.includes('>') || /iframe/i.test(trimmed)) {
    return {
      valid: false,
      error: 'Raw HTML or iframe embed code is not allowed. Please paste a standard YouTube watch or youtu.be URL.',
      statusCode: 400,
    };
  }

  // Allow direct 11-char ID only if it matches strict YouTube ID pattern and has no slashes/colons
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return { valid: true, data: trimmed, statusCode: 200 };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format. Use https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID.',
      statusCode: 400,
    };
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return {
      valid: false,
      error: 'URL must use http or https protocol.',
      statusCode: 400,
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  let candidateId: string | null = null;

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    if (segments.length === 1) {
      candidateId = segments[0];
    }
  } else if (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtube-nocookie.com' ||
    hostname === 'www.youtube-nocookie.com'
  ) {
    if (parsedUrl.pathname === '/watch') {
      candidateId = parsedUrl.searchParams.get('v');
    } else if (parsedUrl.pathname.startsWith('/embed/')) {
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      if (segments.length === 2 && segments[0] === 'embed') {
        candidateId = segments[1];
      }
    }
  } else {
    return {
      valid: false,
      error: 'Unsupported video domain. Only official youtube.com and youtu.be links are supported.',
      statusCode: 400,
    };
  }

  if (!candidateId || !YOUTUBE_ID_REGEX.test(candidateId)) {
    return {
      valid: false,
      error: 'Could not extract a valid 11-character YouTube video ID from the provided URL.',
      statusCode: 400,
    };
  }

  return { valid: true, data: candidateId, statusCode: 200 };
}

/**
 * Generates the official YouTube embed URL from a validated 11-character video ID.
 */
export function buildYouTubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean; cc?: boolean }
): string {
  if (!YOUTUBE_ID_REGEX.test(videoId)) {
    throw new Error('Invalid YouTube video ID');
  }
  if (options?.autoplay) {
    const ccParam = options.cc ? '&cc_load_policy=1' : '';
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=1&autoplay=1${ccParam}`;
  }
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
}

export interface CourseInputPayload {
  title?: unknown;
  description?: unknown;
  thumbnailUrl?: unknown;
  category?: unknown;
  courseType?: unknown;
  price?: unknown;
  isPublished?: unknown;
}

export interface ValidatedCourseData {
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  courseType: CourseType;
  price: number;
  isPublished: boolean;
}

export function validateCourseInput(payload: CourseInputPayload): ValidationResult<ValidatedCourseData> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid course payload.', statusCode: 400 };
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const thumbnailUrl = typeof payload.thumbnailUrl === 'string' ? payload.thumbnailUrl.trim() : '';
  const category = typeof payload.category === 'string' ? payload.category.trim() : '';
  const courseType = payload.courseType;
  const isPublished = Boolean(payload.isPublished);

  if (title.length < 1 || title.length > 160) {
    return { valid: false, error: 'Course title must be between 1 and 160 characters.', statusCode: 400 };
  }
  if (description.length < 1 || description.length > 5000) {
    return { valid: false, error: 'Course description must be between 1 and 5000 characters.', statusCode: 400 };
  }
  if (thumbnailUrl.length < 1 || thumbnailUrl.length > 500) {
    return { valid: false, error: 'Course thumbnail URL must be between 1 and 500 characters.', statusCode: 400 };
  }
  if (category.length < 1 || category.length > 80) {
    return { valid: false, error: 'Course category must be between 1 and 80 characters.', statusCode: 400 };
  }
  if (courseType !== 'free' && courseType !== 'paid') {
    return { valid: false, error: 'Course type must be either "free" or "paid".', statusCode: 400 };
  }

  const numericPrice = typeof payload.price === 'number' ? payload.price : Number(payload.price);
  if (Number.isNaN(numericPrice) || !Number.isFinite(numericPrice)) {
    return { valid: false, error: 'Course price must be a valid number.', statusCode: 400 };
  }

  if (courseType === 'free' && numericPrice !== 0) {
    return { valid: false, error: 'Free courses must have a price of 0.', statusCode: 400 };
  }

  if (courseType === 'paid' && (numericPrice < 0 || numericPrice > 100000)) {
    return { valid: false, error: 'Paid course price must be between $0 and $100,000.', statusCode: 400 };
  }

  const roundedPrice = courseType === 'free' ? 0 : Math.round(numericPrice * 100) / 100;

  return {
    valid: true,
    statusCode: 200,
    data: {
      title,
      description,
      thumbnailUrl,
      category,
      courseType,
      price: roundedPrice,
      isPublished,
    },
  };
}

export interface LessonInputPayload {
  courseId?: unknown;
  title?: unknown;
  youtubeUrl?: unknown;
  youtubeVideoId?: unknown;
  lessonOrder?: unknown;
  isPublished?: unknown;
}

export interface ValidatedLessonData {
  courseId: string;
  title: string;
  youtubeVideoId: string;
  lessonOrder: number;
  isPublished: boolean;
}

export function validateLessonInput(payload: LessonInputPayload): ValidationResult<ValidatedLessonData> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid lesson payload.', statusCode: 400 };
  }

  const courseId = typeof payload.courseId === 'string' ? payload.courseId.trim() : '';
  if (!isValidId(courseId)) {
    return { valid: false, error: 'A valid parent course ID is required.', statusCode: 400 };
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (title.length < 1 || title.length > 160) {
    return { valid: false, error: 'Lesson title must be between 1 and 160 characters.', statusCode: 400 };
  }

  const rawVideoInput = payload.youtubeUrl ?? payload.youtubeVideoId;
  const videoExtraction = extractYouTubeVideoId(rawVideoInput);
  if (!videoExtraction.valid || !videoExtraction.data) {
    return {
      valid: false,
      error: videoExtraction.error || 'Invalid YouTube URL.',
      statusCode: 400,
    };
  }

  const orderNum = typeof payload.lessonOrder === 'number' ? payload.lessonOrder : Number(payload.lessonOrder);
  if (!Number.isInteger(orderNum) || orderNum < 1 || orderNum > 10000) {
    return { valid: false, error: 'Lesson order must be an integer between 1 and 10,000.', statusCode: 400 };
  }

  return {
    valid: true,
    statusCode: 200,
    data: {
      courseId,
      title,
      youtubeVideoId: videoExtraction.data,
      lessonOrder: orderNum,
      isPublished: Boolean(payload.isPublished),
    },
  };
}

export interface AccessCheckResult {
  allowed: boolean;
  statusCode: number;
  reason: string;
}

/**
 * Authoritative access control check for watching course lessons.
 */
export function canAccessCourseLessons(params: {
  user: Pick<UserProfile, 'uid' | 'role'> | null;
  course: Pick<Course, 'id' | 'courseType' | 'isPublished'> | null;
  enrollment: Pick<Enrollment, 'userId' | 'courseId' | 'accessStatus'> | null;
}): AccessCheckResult {
  const { user, course, enrollment } = params;

  if (!course) {
    return { allowed: false, statusCode: 404, reason: 'Course not found.' };
  }

  if (!user) {
    return {
      allowed: false,
      statusCode: 401,
      reason: 'Please log in to enroll and watch course lessons.',
    };
  }

  if (user.role === 'admin') {
    return {
      allowed: true,
      statusCode: 200,
      reason: 'Administrator access verified.',
    };
  }

  if (!course.isPublished) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'This course is currently unpublished and unavailable to students.',
    };
  }

  if (!enrollment || enrollment.userId !== user.uid || enrollment.courseId !== course.id) {
    return {
      allowed: false,
      statusCode: 403,
      reason:
        course.courseType === 'free'
          ? 'You must enroll in this free course before watching its lessons.'
          : 'This is a paid course. Access requires an active enrollment approved by an administrator.',
    };
  }

  if (enrollment.accessStatus === 'revoked') {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Your enrollment access for this course has been revoked by an administrator.',
    };
  }

  if (enrollment.accessStatus !== 'active') {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Your enrollment request is pending administrator approval.',
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    reason: 'Active enrollment verified.',
  };
}

/**
 * Authoritative check for whether a user can self-enroll in a course.
 * Prevents duplicate enrollments and blocks self-enrollment into paid courses.
 */
export function canEnrollInFreeCourse(params: {
  user: Pick<UserProfile, 'uid' | 'role'> | null;
  course: Pick<Course, 'id' | 'courseType' | 'isPublished'> | null;
  existingEnrollment: Pick<Enrollment, 'userId' | 'courseId' | 'accessStatus'> | null;
}): AccessCheckResult {
  const { user, course, existingEnrollment } = params;

  if (!user) {
    return { allowed: false, statusCode: 401, reason: 'Authentication is required to enroll.' };
  }

  if (!course) {
    return { allowed: false, statusCode: 404, reason: 'Course not found.' };
  }

  if (!course.isPublished && user.role !== 'admin') {
    return { allowed: false, statusCode: 403, reason: 'Cannot enroll in an unpublished course.' };
  }

  if (existingEnrollment && existingEnrollment.accessStatus === 'active') {
    return { allowed: false, statusCode: 409, reason: 'You are already enrolled in this course.' };
  }

  if (existingEnrollment && existingEnrollment.accessStatus === 'revoked' && user.role !== 'admin') {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Your access to this course was revoked. Please contact an administrator.',
    };
  }

  if (course.courseType === 'paid' && user.role !== 'admin') {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Paid courses require administrator approval. Self-enrollment is only available for free courses.',
    };
  }

  return { allowed: true, statusCode: 201, reason: 'Enrollment permitted.' };
}

/**
 * Strips protected YouTube video IDs for public curriculum previews,
 * and filters out unpublished lessons for non-admins.
 */
export function toPublicCurriculum(lessons: Lesson[]): PublicLessonSummary[] {
  return lessons
    .filter((lesson) => lesson.isPublished)
    .sort((a, b) => a.lessonOrder - b.lessonOrder)
    .map(({ id, courseId, title, lessonOrder, isPublished }) => ({
      id,
      courseId,
      title,
      lessonOrder,
      isPublished,
    }));
}

/**
 * Returns full lesson objects (including youtubeVideoId) ONLY when the caller is authorized.
 * Never returns unpublished lessons to non-admin students.
 */
export function getAuthorizedCourseLessons(params: {
  user: Pick<UserProfile, 'uid' | 'role'> | null;
  course: Pick<Course, 'id' | 'courseType' | 'isPublished'> | null;
  enrollment: Pick<Enrollment, 'userId' | 'courseId' | 'accessStatus'> | null;
  lessons: Lesson[];
}): ValidationResult<Lesson[]> {
  const access = canAccessCourseLessons({
    user: params.user,
    course: params.course,
    enrollment: params.enrollment,
  });

  if (!access.allowed) {
    return {
      valid: false,
      statusCode: access.statusCode,
      error: access.reason,
    };
  }

  const isAdmin = params.user?.role === 'admin';
  const filtered = params.lessons
    .filter((l) => l.courseId === params.course!.id && (isAdmin || l.isPublished))
    .sort((a, b) => a.lessonOrder - b.lessonOrder);

  return {
    valid: true,
    statusCode: 200,
    data: filtered,
  };
}

export interface CourseProgressSummary {
  courseId: string;
  completedCount: number;
  totalPublishedLessons: number;
  percentage: number;
  completedLessonIds: string[];
  nextLessonId: string | null;
}

/**
 * Calculates real course progress from actual published lessons and verified completion records.
 */
export function calculateCourseProgress(params: {
  courseId: string;
  userId: string;
  lessons: Lesson[];
  progressRecords: LessonProgress[];
}): CourseProgressSummary {
  const publishedLessons = params.lessons
    .filter((l) => l.courseId === params.courseId && l.isPublished)
    .sort((a, b) => a.lessonOrder - b.lessonOrder);

  const publishedIds = new Set(publishedLessons.map((l) => l.id));

  const completedLessonIds = params.progressRecords
    .filter(
      (p) =>
        p.userId === params.userId &&
        p.courseId === params.courseId &&
        p.isCompleted &&
        publishedIds.has(p.lessonId)
    )
    .map((p) => p.lessonId);

  const uniqueCompleted = Array.from(new Set(completedLessonIds));
  const completedSet = new Set(uniqueCompleted);
  const totalPublishedLessons = publishedLessons.length;
  const completedCount = uniqueCompleted.length;

  const percentage =
    totalPublishedLessons === 0
      ? 0
      : Math.min(100, Math.round((completedCount / totalPublishedLessons) * 100));

  const firstUncompleted = publishedLessons.find((l) => !completedSet.has(l.id));
  const nextLessonId = firstUncompleted
    ? firstUncompleted.id
    : publishedLessons[0]?.id ?? null;

  return {
    courseId: params.courseId,
    completedCount,
    totalPublishedLessons,
    percentage,
    completedLessonIds: uniqueCompleted,
    nextLessonId,
  };
}

export interface CourseStudentDistributionItem {
  courseId: string;
  title: string;
  shortTitle: string;
  category: string;
  courseType: CourseType;
  isPublished: boolean;
  activeStudents: number;
  inactiveStudents: number;
  totalStudents: number;
  sharePercentage: number;
}

/**
 * Calculates the distribution of enrolled students across all courses,
 * sorted by active student count (most popular first).
 */
export function calculateCourseStudentDistribution(params: {
  courses: Course[];
  enrollments: Enrollment[];
}): CourseStudentDistributionItem[] {
  const { courses, enrollments } = params;

  const activeByCourse = new Map<string, Set<string>>();
  const inactiveByCourse = new Map<string, Set<string>>();

  for (const course of courses) {
    activeByCourse.set(course.id, new Set());
    inactiveByCourse.set(course.id, new Set());
  }

  for (const enrollment of enrollments) {
    if (!activeByCourse.has(enrollment.courseId)) continue;
    const activeSet = activeByCourse.get(enrollment.courseId)!;
    const inactiveSet = inactiveByCourse.get(enrollment.courseId)!;

    if (enrollment.accessStatus === 'active') {
      activeSet.add(enrollment.userId);
      inactiveSet.delete(enrollment.userId);
    } else if (!activeSet.has(enrollment.userId)) {
      inactiveSet.add(enrollment.userId);
    }
  }

  let totalActiveEnrollmentsAcrossCourses = 0;
  for (const set of activeByCourse.values()) {
    totalActiveEnrollmentsAcrossCourses += set.size;
  }

  const items: CourseStudentDistributionItem[] = courses.map((course) => {
    const activeStudents = activeByCourse.get(course.id)?.size ?? 0;
    const inactiveStudents = inactiveByCourse.get(course.id)?.size ?? 0;
    const totalStudents = activeStudents + inactiveStudents;
    const sharePercentage =
      totalActiveEnrollmentsAcrossCourses === 0
        ? 0
        : Math.round((activeStudents / totalActiveEnrollmentsAcrossCourses) * 100);
    const shortTitle =
      course.title.length > 26 ? `${course.title.slice(0, 24).trim()}...` : course.title;

    return {
      courseId: course.id,
      title: course.title,
      shortTitle,
      category: course.category,
      courseType: course.courseType,
      isPublished: course.isPublished,
      activeStudents,
      inactiveStudents,
      totalStudents,
      sharePercentage,
    };
  });

  return items.sort((a, b) => {
    if (b.activeStudents !== a.activeStudents) {
      return b.activeStudents - a.activeStudents;
    }
    if (b.totalStudents !== a.totalStudents) {
      return b.totalStudents - a.totalStudents;
    }
    return a.title.localeCompare(b.title);
  });
}

