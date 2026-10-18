import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  makeEnrollmentId,
  makeProgressId,
  type AccessStatus,
  type Course,
  type CourseProgressSummary,
  type Enrollment,
  type Lesson,
  type LessonProgress,
  type PublicLessonSummary,
  type UserProfile,
} from './lms-logic';

export interface EnrichedCourse extends Course {
  publishedLessonCount: number;
  totalLessonCount: number;
}

export const INITIAL_PUBLISHED_COURSES: EnrichedCourse[] = [
  {
    id: 'course_db_security',
    title: 'Database Security Modeling & Zero-Trust Access Control',
    description:
      'Design defense-in-depth security rules, relational invariants, and server-verified authorization gates for multi-tenant applications.',
    thumbnailUrl: '/thumbnails/database.svg',
    category: 'Security & Data',
    courseType: 'paid',
    price: 120,
    isPublished: true,
    createdAt: '2026-10-14T09:00:00.000Z',
    updatedAt: '2026-10-16T14:00:00.000Z',
    publishedLessonCount: 2,
    totalLessonCount: 2,
  },
  {
    id: 'course_cloud_architecture',
    title: 'Full-Stack Cloud Architecture & Distributed Systems',
    description:
      'Architect resilient cloud-native services with containerized runtimes, distributed state management, and zero-downtime deployment pipelines.',
    thumbnailUrl: '/thumbnails/fullstack.svg',
    category: 'Cloud Engineering',
    courseType: 'paid',
    price: 89,
    isPublished: true,
    createdAt: '2026-10-12T09:00:00.000Z',
    updatedAt: '2026-10-16T08:00:00.000Z',
    publishedLessonCount: 3,
    totalLessonCount: 3,
  },
  {
    id: 'course_ui_systems',
    title: 'Modern Interface Engineering & Design Systems',
    description:
      'Build accessible, high-contrast web interfaces with systematic typography, responsive grid math, and predictable component APIs.',
    thumbnailUrl: '/thumbnails/ui-engineering.svg',
    category: 'Design Systems',
    courseType: 'free',
    price: 0,
    isPublished: true,
    createdAt: '2026-10-11T09:00:00.000Z',
    updatedAt: '2026-10-15T11:00:00.000Z',
    publishedLessonCount: 3,
    totalLessonCount: 3,
  },
  {
    id: 'course_ts_fundamentals',
    title: 'TypeScript Fundamentals & Type-Safe Architecture',
    description:
      'Master structural typing, generics, discriminated unions, and runtime validation patterns for production React and Node.js applications.',
    thumbnailUrl: '/thumbnails/typescript.svg',
    category: 'Software Engineering',
    courseType: 'free',
    price: 0,
    isPublished: true,
    createdAt: '2026-10-10T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z',
    publishedLessonCount: 3,
    totalLessonCount: 3,
  },
];

const SESSION_TOKEN_STORAGE_KEY = 'lumina_lms_session_token';
const CLIENT_USER_STORAGE_KEY = 'lumina_lms_user_cache';
const CLIENT_ENROLLMENTS_STORAGE_KEY = 'lumina_lms_enrollments_cache';
const CLIENT_PROGRESS_STORAGE_KEY = 'lumina_lms_progress_cache';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ||
      window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
      window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(CLIENT_USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getClientCachedUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CLIENT_USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function setClientCachedUser(user: UserProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(CLIENT_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CLIENT_USER_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function getClientCachedEnrollments(): Enrollment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLIENT_ENROLLMENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Enrollment[]) : [];
  } catch {
    return [];
  }
}

export function setClientCachedEnrollments(enrollments: Enrollment[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLIENT_ENROLLMENTS_STORAGE_KEY, JSON.stringify(enrollments));
  } catch {
    // ignore
  }
}

export function getClientCachedProgress(): LessonProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLIENT_PROGRESS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LessonProgress[]) : [];
  } catch {
    return [];
  }
}

export function setClientCachedProgress(progress: LessonProgress[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLIENT_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

const PERMANENT_CODE_STORAGE_PREFIX = 'lumina_lms_fixed_code_';

export function getPermanentSecretCode(userId: string, courseId: string): string | null {
  if (typeof window === 'undefined' || !userId || !courseId) return null;
  try {
    const key = `${PERMANENT_CODE_STORAGE_PREFIX}${userId}_${courseId}`;
    return window.localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

export function setPermanentSecretCode(userId: string, courseId: string, code: string): void {
  if (typeof window === 'undefined' || !userId || !courseId || !code) return;
  try {
    const key = `${PERMANENT_CODE_STORAGE_PREFIX}${userId}_${courseId}`;
    window.localStorage.setItem(key, code);
  } catch {
    // ignore
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const stored = getStoredToken();
  if (stored) {
    headers.Authorization = `Bearer ${stored}`;
    return headers;
  }
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers.Authorization = `Bearer ${idToken}`;
    } catch {
      // Ignore token error
    }
  }
  return headers;
}

let clientFirestoreQuotaExhaustedUntil = 0;

export function isClientFirestoreQuotaExhausted(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem('lms_fs_quota_exhausted');
      if (stored && Number(stored) > Date.now()) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return Date.now() < clientFirestoreQuotaExhaustedUntil;
}

export function markClientFirestoreQuotaExhausted(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const isQuota =
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    (typeof err === 'object' && err !== null && (err as { code?: string | number }).code === 8);
  if (isQuota) {
    clientFirestoreQuotaExhaustedUntil = Date.now() + 60 * 60 * 1000;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          'lms_fs_quota_exhausted',
          String(Date.now() + 60 * 60 * 1000)
        );
      } catch {
        // ignore
      }
    }
    console.warn(
      'Firestore write quota reached on free tier. Operations continue smoothly using authoritative server storage.'
    );
  }
}

/**
 * Syncs a user profile to Cloud Firestore when authenticated via Firebase Auth,
 * strictly adhering to firestore.rules validation blueprints.
 */
async function syncUserToFirestore(profile: UserProfile): Promise<void> {
  if (!auth.currentUser || isClientFirestoreQuotaExhausted()) return;
  const uid = auth.currentUser.uid;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const isBootstrap =
        auth.currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
        auth.currentUser.email?.toLowerCase() === 'admin@lumina.edu';
      await setDoc(ref, {
        uid,
        displayName: profile.displayName.slice(0, 100),
        email: (auth.currentUser.email || profile.email).slice(0, 254),
        role: isBootstrap ? 'admin' : (profile.role || 'student'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    markClientFirestoreQuotaExhausted(err);
    console.warn('Firestore user sync notice:', err);
  }
}

export async function registerStudentAccount(params: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ user: UserProfile; token: string }> {
  let fbUid: string | null = null;
  let fbIdToken: string | null = null;

  try {
    const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
    fbUid = cred.user.uid;
    await updateProfile(cred.user, { displayName: params.displayName });
    fbIdToken = await cred.user.getIdToken();
  } catch (fbErr: unknown) {
    const code = (fbErr as { code?: string })?.code;
    if (code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(auth, params.email, params.password);
        fbUid = cred.user.uid;
        fbIdToken = await cred.user.getIdToken();
      } catch {
        // Continue with server registration
      }
    }
  }

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(fbIdToken ? { Authorization: `Bearer ${fbIdToken}` } : {}),
    },
    body: JSON.stringify({
      action: 'register',
      uid: fbUid || undefined,
      displayName: params.displayName,
      email: params.email,
      password: params.password,
    }),
  });

  const data = (await res.json()) as { user?: UserProfile; token?: string; error?: string };
  if (!res.ok || !data.user || !data.token) {
    throw new Error(data.error || 'Registration failed.');
  }

  setStoredToken(data.token);
  setClientCachedUser(data.user);
  await syncUserToFirestore(data.user);
  return { user: data.user, token: data.token };
}

export async function loginWithEmailPassword(params: {
  email: string;
  password: string;
}): Promise<{ user: UserProfile; token: string }> {
  let fbIdToken: string | null = null;

  try {
    const cred = await signInWithEmailAndPassword(auth, params.email, params.password);
    fbIdToken = await cred.user.getIdToken();
  } catch (fbErr: unknown) {
    const code = (fbErr as { code?: string })?.code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, params.email, params.password);
        fbIdToken = await newCred.user.getIdToken();
      } catch {
        // continue to server verification
      }
    }
  }

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(fbIdToken ? { Authorization: `Bearer ${fbIdToken}` } : {}),
    },
    body: JSON.stringify({
      action: 'login',
      email: params.email,
      password: params.password,
    }),
  });

  const data = (await res.json()) as { user?: UserProfile; token?: string; error?: string };
  if (!res.ok || !data.user || !data.token) {
    throw new Error(data.error || 'Invalid email or password.');
  }

  setStoredToken(data.token);
  setClientCachedUser(data.user);
  await syncUserToFirestore(data.user);
  return { user: data.user, token: data.token };
}

export async function loginWithGooglePopup(): Promise<{ user: UserProfile; token: string }> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const idToken = await cred.user.getIdToken();

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ action: 'firebase-sync' }),
    });

    const data = (await res.json()) as { user?: UserProfile; token?: string; error?: string };
    if (!res.ok || !data.user || !data.token) {
      throw new Error(data.error || 'Failed to verify Google account.');
    }

    setStoredToken(data.token);
    setClientCachedUser(data.user);
    await syncUserToFirestore(data.user);
    return { user: data.user, token: data.token };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'auth/unauthorized-domain' || errObj?.message?.includes('unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your Vercel domain';
      const customErr = new Error(
        `Firebase Error: This domain (${currentHost}) is not authorized in Firebase Console. Please add "${currentHost}" to Firebase Console > Authentication > Settings > Authorized Domains, or sign in using Email & Password below.`
      );
      (customErr as unknown as Record<string, unknown>).code = 'auth/unauthorized-domain';
      (customErr as unknown as Record<string, unknown>).domain = currentHost;
      throw customErr;
    }
    throw err;
  }
}

export async function requestPasswordReset(email: string): Promise<string> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset-password', email }),
  });

  const data = (await res.json()) as { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Unable to process password reset request.');
  }

  return (
    data.message ||
    'If an account exists for that email address, password reset instructions have been sent.'
  );
}

export async function updateUserDisplayName(displayName: string): Promise<UserProfile> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'update-profile', displayName }),
  });

  const data = (await res.json()) as { user?: UserProfile; error?: string };
  if (!res.ok || !data.user) {
    throw new Error(data.error || 'Failed to update profile.');
  }

  if (auth.currentUser && !isClientFirestoreQuotaExhausted()) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: data.user.displayName.slice(0, 100),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      markClientFirestoreQuotaExhausted(err);
      console.warn('Firestore update profile notice:', err);
    }
  }

  return data.user;
}

export async function logoutAccount(): Promise<void> {
  setStoredToken(null);
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error
  }
}

export async function fetchCoursesList(params?: {
  search?: string;
  type?: 'all' | 'free' | 'paid';
  includeAll?: boolean;
}): Promise<EnrichedCourse[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.type && params.type !== 'all') searchParams.set('type', params.type);
  if (params?.includeAll) searchParams.set('includeAll', '1');

  const res = await fetch(`/api/courses?${searchParams.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = (await res.json()) as { courses?: EnrichedCourse[]; error?: string };
  if (!res.ok || !data.courses) {
    throw new Error(data.error || 'Failed to load courses.');
  }
  return data.courses;
}

export async function fetchCourseDetails(courseId: string): Promise<{
  course: Course;
  curriculum: PublicLessonSummary[];
  enrollment: Enrollment | null;
  progress: CourseProgressSummary | null;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = (await res.json()) as {
    course?: Course;
    curriculum?: PublicLessonSummary[];
    enrollment?: Enrollment | null;
    progress?: CourseProgressSummary | null;
    error?: string;
  };
  if (!res.ok || !data.course) {
    throw new Error(data.error || 'Course not found.');
  }
  return {
    course: data.course,
    curriculum: data.curriculum || [],
    enrollment: data.enrollment ?? null,
    progress: data.progress ?? null,
  };
}

export async function enrollInCourse(courseId: string): Promise<Enrollment> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/enrollments', {
    method: 'POST',
    headers,
    body: JSON.stringify({ courseId }),
  });
  const data = (await res.json()) as { enrollment?: Enrollment; error?: string };
  if (!res.ok || !data.enrollment) {
    throw new Error(data.error || 'Unable to enroll in course.');
  }

  // Cache enrollment locally
  const currentEnrollments = getClientCachedEnrollments();
  setClientCachedEnrollments([
    data.enrollment,
    ...currentEnrollments.filter((e) => e.courseId !== courseId),
  ]);

  // Sync to Cloud Firestore if authenticated via Firebase Auth
  if (auth.currentUser && !isClientFirestoreQuotaExhausted()) {
    const uid = auth.currentUser.uid;
    const enrollmentId = makeEnrollmentId(uid, courseId);
    try {
      await setDoc(
        doc(db, 'enrollments', enrollmentId),
        {
          id: enrollmentId,
          userId: uid,
          courseId,
          accessStatus: 'active',
          status: 'ACTIVE',
          enrolledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      markClientFirestoreQuotaExhausted(err);
      console.warn('Firestore enrollment sync notice:', err);
    }
  }

  return data.enrollment;
}

export async function fetchAuthorizedLessons(courseId: string): Promise<{
  course: Course;
  lessons: Lesson[];
  enrollment: Enrollment | null;
  progress: CourseProgressSummary;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/lessons?courseId=${encodeURIComponent(courseId)}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = (await res.json()) as {
    course?: Course;
    lessons?: Lesson[];
    enrollment?: Enrollment | null;
    progress?: CourseProgressSummary;
    error?: string;
  };
  if (!res.ok || !data.course || !data.lessons || !data.progress) {
    throw new Error(data.error || 'Access denied to course lessons.');
  }
  return {
    course: data.course,
    lessons: data.lessons,
    enrollment: data.enrollment ?? null,
    progress: data.progress,
  };
}

export async function toggleLessonCompletion(params: {
  courseId: string;
  lessonId: string;
  isCompleted: boolean;
}): Promise<{ record: LessonProgress; summary: CourseProgressSummary }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/progress', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    record?: LessonProgress;
    summary?: CourseProgressSummary;
    error?: string;
  };
  if (!res.ok || !data.record || !data.summary) {
    throw new Error(data.error || 'Failed to update lesson progress.');
  }

  // Cache progress locally
  const currentProg = getClientCachedProgress();
  setClientCachedProgress([
    data.record,
    ...currentProg.filter((p) => p.lessonId !== params.lessonId),
  ]);

  if (auth.currentUser && !isClientFirestoreQuotaExhausted()) {
    const uid = auth.currentUser.uid;
    const progressId = makeProgressId(uid, params.lessonId);
    try {
      await setDoc(
        doc(db, 'lessonProgress', progressId),
        {
          id: progressId,
          userId: uid,
          courseId: params.courseId,
          lessonId: params.lessonId,
          isCompleted: params.isCompleted,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      markClientFirestoreQuotaExhausted(err);
      console.warn('Firestore progress sync notice:', err);
    }
  }

  return { record: data.record, summary: data.summary };
}

export async function createCourseAdmin(payload: {
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  courseType: 'free' | 'paid';
  price: number;
  isPublished: boolean;
}): Promise<Course> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/courses', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { course?: Course; error?: string };
  if (!res.ok || !data.course) {
    throw new Error(data.error || 'Failed to create course.');
  }

  if (
    auth.currentUser &&
    auth.currentUser.emailVerified &&
    auth.currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() &&
    !isClientFirestoreQuotaExhausted()
  ) {
    try {
      await setDoc(doc(db, 'courses', data.course.id), {
        id: data.course.id,
        title: data.course.title,
        description: data.course.description,
        thumbnailUrl: data.course.thumbnailUrl,
        category: data.course.category,
        courseType: data.course.courseType,
        price: data.course.price,
        isPublished: data.course.isPublished,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      markClientFirestoreQuotaExhausted(err);
      console.warn('Firestore course direct sync notice (persisted in server DB):', err);
    }
  }

  return data.course;
}

export async function updateCourseAdmin(
  courseId: string,
  payload: Partial<{
    title: string;
    description: string;
    thumbnailUrl: string;
    category: string;
    courseType: 'free' | 'paid';
    price: number;
    isPublished: boolean;
  }>
): Promise<Course> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { course?: Course; error?: string };
  if (!res.ok || !data.course) {
    throw new Error(data.error || 'Failed to update course.');
  }
  return data.course;
}

export async function deleteCourseAdmin(courseId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
    headers,
  });
  const data = (await res.json()) as { deleted?: boolean; error?: string };
  if (!res.ok || !data.deleted) {
    throw new Error(data.error || 'Failed to delete course.');
  }

  if (
    auth.currentUser &&
    auth.currentUser.emailVerified &&
    auth.currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() &&
    !isClientFirestoreQuotaExhausted()
  ) {
    try {
      const snap = await getDoc(doc(db, 'courses', courseId));
      if (snap.exists()) {
        await deleteDoc(doc(db, 'courses', courseId));
      }
    } catch (err) {
      markClientFirestoreQuotaExhausted(err);
      console.warn('Firestore course delete sync notice (deleted in server DB):', err);
    }
  }
}

export async function createLessonAdmin(payload: {
  courseId: string;
  title: string;
  youtubeUrl: string;
  lessonOrder: number;
  isPublished: boolean;
}): Promise<Lesson> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/lessons', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { lesson?: Lesson; error?: string };
  if (!res.ok || !data.lesson) {
    throw new Error(data.error || 'Failed to add lesson.');
  }
  return data.lesson;
}

export async function updateLessonAdmin(
  lessonId: string,
  payload: Partial<{
    title: string;
    youtubeUrl: string;
    lessonOrder: number;
    isPublished: boolean;
  }>
): Promise<Lesson> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { lesson?: Lesson; error?: string };
  if (!res.ok || !data.lesson) {
    throw new Error(data.error || 'Failed to update lesson.');
  }
  return data.lesson;
}

export async function deleteLessonAdmin(lessonId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'DELETE',
    headers,
  });
  const data = (await res.json()) as { deleted?: boolean; error?: string };
  if (!res.ok || !data.deleted) {
    throw new Error(data.error || 'Failed to delete lesson.');
  }
}

export async function setStudentEnrollmentAdmin(params: {
  userId: string;
  courseId: string;
  accessStatus: AccessStatus;
}): Promise<Enrollment> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/enrollments', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { enrollment?: Enrollment; error?: string };
  if (!res.ok || !data.enrollment) {
    throw new Error(data.error || 'Failed to update student enrollment.');
  }
  return data.enrollment;
}

export interface AdminOverviewPayload {
  stats: {
    totalCourses: number;
    publishedCourses: number;
    totalLessons: number;
    publishedLessons: number;
    totalStudents: number;
    totalUsers: number;
    activeEnrollments: number;
    totalEnrollments: number;
    totalRevenue?: number;
    pendingApprovals?: number;
    rejectedEnrollments?: number;
  };
  courses: Course[];
  lessons: Lesson[];
  users: UserProfile[];
  enrollments: Enrollment[];
  progressRecords: LessonProgress[];
}

export async function fetchAdminOverview(): Promise<AdminOverviewPayload> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/overview', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = (await res.json()) as AdminOverviewPayload & { error?: string };
  if (!res.ok || !data.stats) {
    throw new Error(data.error || 'Failed to fetch admin overview.');
  }
  return data;
}

export interface InitiatePaidEnrollmentResponse {
  enrollment: Enrollment;
  secretCode: string;
  course: {
    id: string;
    title: string;
    price: number;
    category: string;
  };
  bkashConfig: {
    merchantNumber: string;
    personalNumber: string;
    whatsappNumber: string;
    whatsappDisplayNumber?: string;
    accountName: string;
  };
  isExistingPending: boolean;
}

export async function initiatePaidEnrollment(params: {
  courseId: string;
  secretCode?: string;
  trxId?: string;
  senderPhone?: string;
}): Promise<InitiatePaidEnrollmentResponse> {
  const user = getClientCachedUser();
  const cachedPermCode = user ? getPermanentSecretCode(user.uid, params.courseId) : null;
  const initialEnrollments = getClientCachedEnrollments();
  const existingCached = initialEnrollments.find((e) => e.courseId === params.courseId);
  const codeToSend =
    params.secretCode || existingCached?.secretCode || cachedPermCode || undefined;

  const headers = await getAuthHeaders();
  const res = await fetch('/api/enrollment/initiate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      ...(codeToSend ? { secretCode: codeToSend } : {}),
    }),
  });
  const data = (await res.json()) as Partial<InitiatePaidEnrollmentResponse> & { error?: string };
  if (!res.ok || !data.enrollment || !data.secretCode || !data.course || !data.bkashConfig) {
    throw new Error(data.error || 'Unable to initiate bKash course enrollment.');
  }

  // Save permanent code locally for this student and course
  if (user && data.secretCode) {
    setPermanentSecretCode(user.uid, params.courseId, data.secretCode);
  }

  // Cache pending enrollment locally
  setClientCachedEnrollments([
    data.enrollment,
    ...initialEnrollments.filter((e) => e.courseId !== params.courseId),
  ]);

  // Sync pending enrollment to Cloud Firestore if authenticated via Firebase Auth
  if (auth.currentUser && !isClientFirestoreQuotaExhausted()) {
    const uid = auth.currentUser.uid;
    const enrollmentId = makeEnrollmentId(uid, params.courseId);
    const trimmedTrxId = params.trxId?.trim() ? params.trxId.trim().slice(0, 64) : undefined;
    const trimmedSenderPhone = params.senderPhone?.trim()
      ? params.senderPhone.trim().slice(0, 32)
      : undefined;
    try {
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      await setDoc(
        enrollmentRef,
        {
          id: enrollmentId,
          userId: uid,
          courseId: params.courseId,
          accessStatus: 'pending',
          status: 'PENDING',
          secretCode: data.secretCode,
          paymentMethod: 'bKash',
          ...(trimmedTrxId ? { trxId: trimmedTrxId } : {}),
          ...(trimmedSenderPhone ? { senderPhone: trimmedSenderPhone } : {}),
          enrolledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      markClientFirestoreQuotaExhausted(err);
      console.warn('Firestore initiate enrollment notice:', err);
    }
  }

  return {
    enrollment: data.enrollment,
    secretCode: data.secretCode,
    course: data.course,
    bkashConfig: data.bkashConfig,
    isExistingPending: Boolean(data.isExistingPending),
  };
}

export interface VerifiedSecretCodeEnrollment extends Enrollment {
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  secretCode: string;
  paymentMethod: string;
  createdAt: string;
  activatedAt: string | null;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  coursePrice: number;
  courseType: 'free' | 'paid';
  courseCategory?: string;
}

export async function verifySecretCodeAdmin(
  secretCode: string
): Promise<VerifiedSecretCodeEnrollment> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/enrollment/verify-code', {
    method: 'POST',
    headers,
    body: JSON.stringify({ secretCode }),
  });
  const data = (await res.json()) as {
    verified?: boolean;
    enrollment?: VerifiedSecretCodeEnrollment;
    error?: string;
  };
  if (!res.ok || !data.enrollment) {
    throw new Error(data.error || 'Failed to verify Secret Code.');
  }
  return data.enrollment;
}

export async function approveEnrollmentByCodeAdmin(params: {
  secretCode: string;
  action?: 'APPROVE' | 'REJECT';
}): Promise<{ enrollment: VerifiedSecretCodeEnrollment; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/enrollment/approve-by-code', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    enrollment?: VerifiedSecretCodeEnrollment;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.enrollment) {
    throw new Error(data.error || 'Failed to approve Secret Code.');
  }
  return {
    enrollment: data.enrollment,
    message: data.message || 'Enrollment updated successfully.',
  };
}

export interface AdminEnrollmentsListResponse {
  enrollments: VerifiedSecretCodeEnrollment[];
  metrics: {
    totalEnrolledStudents: number;
    uniqueActiveStudents: number;
    totalRevenue: number;
    pendingApprovals: number;
    rejectedEnrollments: number;
    activeCourses: number;
    totalEnrollments: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export async function fetchAdminEnrollments(params?: {
  status?: 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED';
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminEnrollmentsListResponse> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`/api/admin/enrollments?${query.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = (await res.json()) as AdminEnrollmentsListResponse & { error?: string };
  if (!res.ok || !data.enrollments || !data.metrics) {
    throw new Error(data.error || 'Failed to fetch admin enrollments.');
  }
  return data;
}

export async function updateAdminEnrollmentStatus(params: {
  enrollmentId: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
}): Promise<Enrollment> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/enrollments', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { enrollment?: Enrollment; error?: string };
  if (!res.ok || !data.enrollment) {
    throw new Error(data.error || 'Failed to update enrollment status.');
  }
  return data.enrollment;
}

