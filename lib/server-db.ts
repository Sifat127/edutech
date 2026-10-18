import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  makeEnrollmentId,
  makeProgressId,
  type UserProfile,
  type Course,
  type Lesson,
  type Enrollment,
  type LessonProgress,
} from './lms-logic';

export interface StoredUserRecord extends UserProfile {
  passwordHash?: string;
  passwordSalt?: string;
  resetRequestedAt?: string;
}

export interface DatabaseSchema {
  users: Record<string, StoredUserRecord>;
  courses: Record<string, Course>;
  lessons: Record<string, Lesson>;
  enrollments: Record<string, Enrollment>;
  lessonProgress: Record<string, LessonProgress>;
}

const DATA_DIR = path.join(os.tmpdir(), 'lumina-lms-data');
const DB_FILE = path.join(DATA_DIR, 'lms-db.json');
const TOKEN_SECRET = `lumina-lms-secret-${firebaseConfig.projectId}-${firebaseConfig.appId}`;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

export function verifyPassword(password: string, hash?: string, salt?: string): boolean {
  if (!hash || !salt) return false;
  const computed = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(computed.hash, 'hex'), Buffer.from(hash, 'hex'));
}

export function createSessionToken(payload: { uid: string; email: string }): string {
  const data = JSON.stringify({
    uid: payload.uid,
    email: payload.email,
    iat: Date.now(),
  });
  const base64Data = Buffer.from(data, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Data)
    .digest('base64url');
  return `lms.${base64Data}.${signature}`;
}

export function verifySessionToken(token: string): { uid: string; email: string } | null {
  if (!token.startsWith('lms.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, base64Data, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Data)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf8'));
    if (typeof decoded.uid === 'string' && typeof decoded.email === 'string') {
      return { uid: decoded.uid, email: decoded.email };
    }
    return null;
  } catch {
    return null;
  }
}

function createInitialSeedDatabase(): DatabaseSchema {
  const now = '2026-10-15T10:00:00.000Z';
  const adminPass = hashPassword('AdminPass123!');
  const studentPass = hashPassword('StudentPass123!');

  const users: Record<string, StoredUserRecord> = {
    admin_bootstrap: {
      uid: 'admin_bootstrap',
      displayName: 'Elena Vance (Platform Admin)',
      email: 'admin@lumina.edu',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
      passwordHash: adminPass.hash,
      passwordSalt: adminPass.salt,
    },
    student_alex: {
      uid: 'student_alex',
      displayName: 'Alex Rivera',
      email: 'alex.rivera@student.edu',
      role: 'student',
      createdAt: now,
      updatedAt: now,
      passwordHash: studentPass.hash,
      passwordSalt: studentPass.salt,
    },
    student_maya: {
      uid: 'student_maya',
      displayName: 'Maya Chen',
      email: 'maya.chen@student.edu',
      role: 'student',
      createdAt: now,
      updatedAt: now,
      passwordHash: studentPass.hash,
      passwordSalt: studentPass.salt,
    },
  };

  const courses: Record<string, Course> = {
    course_ts_fundamentals: {
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
    },
    course_ui_systems: {
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
    },
    course_cloud_architecture: {
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
    },
    course_db_security: {
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
    },
  };

  const lessons: Record<string, Lesson> = {
    lesson_ts_1: {
      id: 'lesson_ts_1',
      courseId: 'course_ts_fundamentals',
      title: 'Foundations of Structural Typing & Compiler Flags',
      youtubeVideoId: 'BwuLxPH8IDs',
      lessonOrder: 1,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_ts_2: {
      id: 'lesson_ts_2',
      courseId: 'course_ts_fundamentals',
      title: 'Generics, Utility Types & Discriminated Unions',
      youtubeVideoId: 'W6NZfCO5SIk',
      lessonOrder: 2,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_ts_3: {
      id: 'lesson_ts_3',
      courseId: 'course_ts_fundamentals',
      title: 'End-to-End Type Safety Across API Boundaries',
      youtubeVideoId: 'rfscVS0vtbw',
      lessonOrder: 3,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_ui_1: {
      id: 'lesson_ui_1',
      courseId: 'course_ui_systems',
      title: 'Typographic Hierarchy, Measure & Contrast Ratios',
      youtubeVideoId: 'BwuLxPH8IDs',
      lessonOrder: 1,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_ui_2: {
      id: 'lesson_ui_2',
      courseId: 'course_ui_systems',
      title: 'Composable Primitives & Accessible Keyboard Flows',
      youtubeVideoId: 'W6NZfCO5SIk',
      lessonOrder: 2,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_ui_3: {
      id: 'lesson_ui_3',
      courseId: 'course_ui_systems',
      title: 'Responsive Grid Architecture & Viewport Presence',
      youtubeVideoId: 'BwuLxPH8IDs',
      lessonOrder: 3,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_cloud_1: {
      id: 'lesson_cloud_1',
      courseId: 'course_cloud_architecture',
      title: 'Stateless Compute & Container Runtime Contracts',
      youtubeVideoId: 'BwuLxPH8IDs',
      lessonOrder: 1,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_cloud_2: {
      id: 'lesson_cloud_2',
      courseId: 'course_cloud_architecture',
      title: 'Distributed Consensus & Idempotent API Mutations',
      youtubeVideoId: 'aircAruvnKk',
      lessonOrder: 2,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_cloud_3: {
      id: 'lesson_cloud_3',
      courseId: 'course_cloud_architecture',
      title: 'Observability, Structured Logging & Health Probes',
      youtubeVideoId: 'rfscVS0vtbw',
      lessonOrder: 3,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_cloud_4_draft: {
      id: 'lesson_cloud_4_draft',
      courseId: 'course_cloud_architecture',
      title: 'Multi-Region Traffic Failover Drills (Unpublished Draft)',
      youtubeVideoId: 'W6NZfCO5SIk',
      lessonOrder: 4,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    },
    lesson_sec_1: {
      id: 'lesson_sec_1',
      courseId: 'course_db_security',
      title: 'Attribute-Based Access Control & Schema Validation',
      youtubeVideoId: 'BwuLxPH8IDs',
      lessonOrder: 1,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    lesson_sec_2: {
      id: 'lesson_sec_2',
      courseId: 'course_db_security',
      title: 'Mitigating Privilege Escalation & Resource Poisoning',
      youtubeVideoId: 'aircAruvnKk',
      lessonOrder: 2,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
  };

  const alexTsEnrollmentId = makeEnrollmentId('student_alex', 'course_ts_fundamentals');
  const alexCloudPendingId = makeEnrollmentId('student_alex', 'course_cloud_architecture');
  const mayaCloudEnrollmentId = makeEnrollmentId('student_maya', 'course_cloud_architecture');

  const enrollments: Record<string, Enrollment> = {
    [alexTsEnrollmentId]: {
      id: alexTsEnrollmentId,
      userId: 'student_alex',
      courseId: 'course_ts_fundamentals',
      accessStatus: 'active',
      status: 'ACTIVE',
      secretCode: 'EDU-3T79F2',
      paymentMethod: 'Free',
      createdAt: '2026-10-16T10:00:00.000Z',
      activatedAt: '2026-10-16T10:00:00.000Z',
      enrolledAt: '2026-10-16T10:00:00.000Z',
      updatedAt: '2026-10-16T10:00:00.000Z',
    },
    [alexCloudPendingId]: {
      id: alexCloudPendingId,
      userId: 'student_alex',
      courseId: 'course_cloud_architecture',
      accessStatus: 'pending',
      status: 'PENDING',
      secretCode: 'EDU-8F29K1',
      paymentMethod: 'bKash',
      createdAt: '2026-10-17T08:30:00.000Z',
      activatedAt: null,
      enrolledAt: '2026-10-17T08:30:00.000Z',
      updatedAt: '2026-10-17T08:30:00.000Z',
    },
    [mayaCloudEnrollmentId]: {
      id: mayaCloudEnrollmentId,
      userId: 'student_maya',
      courseId: 'course_cloud_architecture',
      accessStatus: 'active',
      status: 'ACTIVE',
      secretCode: 'EDU-4M92C7',
      paymentMethod: 'bKash',
      createdAt: '2026-10-16T11:45:00.000Z',
      activatedAt: '2026-10-16T12:00:00.000Z',
      enrolledAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
    },
  };

  const alexProgressId = makeProgressId('student_alex', 'lesson_ts_1');
  const lessonProgress: Record<string, LessonProgress> = {
    [alexProgressId]: {
      id: alexProgressId,
      userId: 'student_alex',
      courseId: 'course_ts_fundamentals',
      lessonId: 'lesson_ts_1',
      isCompleted: true,
      completedAt: '2026-10-16T11:30:00.000Z',
      updatedAt: '2026-10-16T11:30:00.000Z',
    },
  };

  return {
    users,
    courses,
    lessons,
    enrollments,
    lessonProgress,
  };
}

function backfillEnrollments(db: DatabaseSchema): boolean {
  let mutated = false;
  const usedCodes = new Set<string>();
  for (const e of Object.values(db.enrollments)) {
    if (e.secretCode) usedCodes.add(e.secretCode);
  }

  for (const e of Object.values(db.enrollments)) {
    const course = db.courses[e.courseId];
    if (!e.status) {
      e.status =
        e.accessStatus === 'active'
          ? 'ACTIVE'
          : e.accessStatus === 'pending'
          ? 'PENDING'
          : 'REJECTED';
      mutated = true;
    }
    if (!e.paymentMethod) {
      e.paymentMethod = course?.courseType === 'free' ? 'Free' : 'bKash';
      mutated = true;
    }
    if (!e.createdAt) {
      e.createdAt = e.enrolledAt;
      mutated = true;
    }
    if (e.activatedAt === undefined) {
      e.activatedAt = e.accessStatus === 'active' ? e.updatedAt || e.enrolledAt : null;
      mutated = true;
    }
    if (!e.secretCode) {
      const deterministicSuffix = crypto
        .createHash('sha256')
        .update(e.id)
        .digest('hex')
        .toUpperCase()
        .replace(/[^2-9A-HJ-NP-Z]/g, '8')
        .slice(0, 6);
      const code = `EDU-${deterministicSuffix}`;
      e.secretCode = usedCodes.has(code)
        ? `EDU-${Math.random().toString(36).toUpperCase().slice(2, 8).padEnd(6, '9')}`
        : code;
      usedCodes.add(e.secretCode);
      mutated = true;
    }
  }

  // Ensure demo pending enrollment EDU-8F29K1 exists if student_alex has no enrollment for course_cloud_architecture
  const alexPendingKey = makeEnrollmentId('student_alex', 'course_cloud_architecture');
  if (
    db.users.student_alex &&
    db.courses.course_cloud_architecture &&
    !db.enrollments[alexPendingKey]
  ) {
    db.enrollments[alexPendingKey] = {
      id: alexPendingKey,
      userId: 'student_alex',
      courseId: 'course_cloud_architecture',
      accessStatus: 'pending',
      status: 'PENDING',
      secretCode: 'EDU-8F29K1',
      paymentMethod: 'bKash',
      createdAt: '2026-10-17T08:30:00.000Z',
      activatedAt: null,
      enrolledAt: '2026-10-17T08:30:00.000Z',
      updatedAt: '2026-10-17T08:30:00.000Z',
    };
    mutated = true;
  }

  const seededIdsToUpgrade = [
    'lesson_ts_3',
    'lesson_ui_1',
    'lesson_cloud_1',
    'lesson_cloud_4_draft',
    'lesson_sec_1',
  ];
  for (const lid of seededIdsToUpgrade) {
    if (db.lessons[lid] && db.lessons[lid].youtubeVideoId === 'M7lc1UVf-VE') {
      db.lessons[lid].youtubeVideoId = 'BwuLxPH8IDs';
      mutated = true;
    }
  }

  return mutated;
}

const serverFirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const serverAuth = getAuth(serverFirebaseApp);
const serverFirestore = getFirestore(serverFirebaseApp, firebaseConfig.firestoreDatabaseId);

let firestoreQuotaExhaustedUntil = 0;

export function isFirestoreQuotaExhausted(): boolean {
  return Date.now() < firestoreQuotaExhaustedUntil;
}

export function markFirestoreQuotaExhausted(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const isQuota =
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    (typeof err === 'object' && err !== null && (err as { code?: string | number }).code === 8);
  if (isQuota) {
    firestoreQuotaExhaustedUntil = Date.now() + 60 * 60 * 1000; // Backoff for 1 hour
    console.warn(
      'Cloud Firestore daily write quota limit reached (Free tier). Using high-performance local JSON datastore.'
    );
  }
}

let isServerAuthenticated = false;
let authPromise: Promise<boolean> | null = null;

async function ensureServerAuth(): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return false;
  if (isServerAuthenticated && serverAuth.currentUser) return true;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      await signInWithEmailAndPassword(serverAuth, 'admin@lumina.edu', 'AdminPass123!');
      isServerAuthenticated = true;
      return true;
    } catch (err) {
      console.warn('Server Firebase Auth sign-in warning:', err);
      return false;
    } finally {
      authPromise = null;
    }
  })();
  return authPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function syncFromFirestore(): Promise<DatabaseSchema | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const authed = await withTimeout(ensureServerAuth(), 2000, false);
    if (!authed) return null;
    const stateRef = doc(serverFirestore, 'app_state', 'database_snapshot');
    const snap = await withTimeout(getDoc(stateRef), 2000, null);
    if (snap && snap.exists()) {
      const data = snap.data() as { schemaJson?: string };
      if (data.schemaJson) {
        const parsed = JSON.parse(data.schemaJson) as DatabaseSchema;
        if (parsed && parsed.users && parsed.courses && parsed.lessons) {
          backfillEnrollments(parsed);
          memoryCache = parsed;
          try {
            if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
          } catch {
            // ignore
          }
          return parsed;
        }
      }
    }
  } catch (err) {
    markFirestoreQuotaExhausted(err);
    if (!isFirestoreQuotaExhausted()) {
      console.warn('Failed to load database from Cloud Firestore:', err);
    }
  }
  return null;
}

export async function syncToFirestore(db: DatabaseSchema): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const authed = await withTimeout(ensureServerAuth(), 2000, false);
    if (!authed) return;
    const stateRef = doc(serverFirestore, 'app_state', 'database_snapshot');
    await withTimeout(
      setDoc(stateRef, {
        schemaJson: JSON.stringify(db),
        updatedAt: new Date().toISOString(),
        userCount: Object.keys(db.users).length,
        courseCount: Object.keys(db.courses).length,
        enrollmentCount: Object.keys(db.enrollments).length,
        progressCount: Object.keys(db.lessonProgress).length,
      }),
      2500,
      undefined
    );
  } catch (err) {
    markFirestoreQuotaExhausted(err);
    if (!isFirestoreQuotaExhausted()) {
      console.warn('Failed to sync database to Cloud Firestore:', err);
    }
  }
}

export async function readDbAsync(): Promise<DatabaseSchema> {
  if (memoryCache) return memoryCache;

  // 1. Instant check: local disk file
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && parsed.users && parsed.courses && parsed.lessons) {
        backfillEnrollments(parsed);
        memoryCache = parsed;
        void syncFromFirestore();
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Local DB file read warning:', err);
  }

  // 2. Primary fallback if disk empty: Load from Cloud Firestore
  const fromCloud = await syncFromFirestore();
  if (fromCloud) return fromCloud;

  // 3. Seed initial data
  const initial = createInitialSeedDatabase();
  memoryCache = initial;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
  } catch {
    // ignore
  }
  void syncToFirestore(initial);
  return initial;
}

let memoryCache: DatabaseSchema | null = null;

export function readDb(): DatabaseSchema {
  if (memoryCache) return memoryCache;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && parsed.users && parsed.courses && parsed.lessons) {
        if (backfillEnrollments(parsed)) {
          writeDb(parsed);
        } else {
          memoryCache = parsed;
        }
        void syncFromFirestore();
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh LMS database store:', err);
  }

  // Trigger background sync from Cloud Firestore
  void syncFromFirestore();

  const initial = createInitialSeedDatabase();
  writeDb(initial);
  return initial;
}

export function writeDb(db: DatabaseSchema): void {
  memoryCache = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to persist LMS database file:', err);
  }
  void syncToFirestore(db);
}

export async function writeDbAsync(db: DatabaseSchema): Promise<void> {
  memoryCache = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to persist LMS database file:', err);
  }
  void syncToFirestore(db);
}

export function toPublicUserProfile(record: StoredUserRecord): UserProfile {
  return {
    uid: record.uid,
    displayName: record.displayName,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Verifies the caller's Authorization Bearer token on the server.
 * Supports both:
 * 1. Server-signed HMAC session tokens (`lms.<payload>.<sig>`)
 * 2. Firebase Auth ID tokens verified directly against Google Identity Toolkit REST API
 */
export async function authenticateRequest(request: Request): Promise<UserProfile | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const db = await readDbAsync();

  // 1. Check server-signed HMAC session token
  const sessionData = verifySessionToken(token);
  if (sessionData) {
    let existingUser = db.users[sessionData.uid];
    if (!existingUser) {
      // Vercel serverless persistence: restore verified user from token if container was cold-started
      const email = sessionData.email.toLowerCase();
      const isBootstrapAdmin =
        email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
        email === 'admin@lumina.edu' ||
        (process.env.ADMIN_BOOTSTRAP_EMAIL &&
          email === process.env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase());
      const now = new Date().toISOString();
      existingUser = {
        uid: sessionData.uid,
        displayName: email.split('@')[0] || 'Student',
        email,
        role: isBootstrapAdmin ? 'admin' : 'student',
        createdAt: now,
        updatedAt: now,
      };
      db.users[sessionData.uid] = existingUser;
      writeDb(db);
    }
    return toPublicUserProfile(existingUser);
  }

  // 2. Verify Firebase Auth ID token via Google Identity Toolkit REST API
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!res.ok) {
      return null;
    }

    const body = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };

    const fbUser = body.users?.[0];
    if (!fbUser || !fbUser.localId) {
      return null;
    }

    const uid = fbUser.localId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const email = (fbUser.email || '').toLowerCase();
    const isBootstrapAdmin =
      email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
      (process.env.ADMIN_BOOTSTRAP_EMAIL &&
        email === process.env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase());

    const now = new Date().toISOString();
    let userRecord = db.users[uid];

    if (!userRecord) {
      userRecord = {
        uid,
        displayName: fbUser.displayName || email.split('@')[0] || 'Student',
        email: email || `${uid}@user.local`,
        role: isBootstrapAdmin ? 'admin' : 'student',
        createdAt: now,
        updatedAt: now,
      };
      db.users[uid] = userRecord;
      writeDb(db);
    } else if (isBootstrapAdmin && userRecord.role !== 'admin') {
      userRecord.role = 'admin';
      userRecord.updatedAt = now;
      writeDb(db);
    }

    return toPublicUserProfile(userRecord);
  } catch {
    return null;
  }
}
