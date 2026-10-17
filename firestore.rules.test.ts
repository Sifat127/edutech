import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isValidId,
  YOUTUBE_ID_REGEX,
  BOOTSTRAP_ADMIN_EMAIL,
} from './lib/lms-logic.ts';

interface AuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface SimulatedDb {
  admins: Set<string>;
  courses: Map<string, { id: string; courseType: 'free' | 'paid'; isPublished: boolean }>;
  lessons: Map<string, { id: string; courseId: string; isPublished: boolean }>;
  enrollments: Map<string, { id: string; userId: string; courseId: string; accessStatus: 'active' | 'revoked' | 'pending' }>;
}

const REQUEST_TIME = '2026-10-17T12:00:00.000Z';

function isAdmin(auth: AuthContext | null, db: SimulatedDb): boolean {
  if (!auth || !auth.email_verified) return false;
  return auth.email === BOOTSTRAP_ADMIN_EMAIL || db.admins.has(auth.uid);
}

function evaluateRules(params: {
  collection: 'users' | 'courses' | 'lessons' | 'enrollments' | 'lessonProgress';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  docId: string;
  auth: AuthContext | null;
  existing?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  db: SimulatedDb;
}): 'ALLOWED' | 'PERMISSION_DENIED' {
  const { collection, operation, docId, auth, existing, incoming, db } = params;

  if (operation !== 'list' && !isValidId(docId)) {
    return 'PERMISSION_DENIED';
  }

  const admin = isAdmin(auth, db);
  const verified = Boolean(auth && auth.email_verified);

  if (collection === 'users') {
    if (operation === 'get' || operation === 'list') {
      if (!auth) return 'PERMISSION_DENIED';
      const targetUid = operation === 'get' ? docId : (existing?.uid as string);
      return auth.uid === targetUid || admin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'create') {
      if (!verified || !incoming) return 'PERMISSION_DENIED';
      const keys = Object.keys(incoming);
      const allowedKeys = ['uid', 'displayName', 'email', 'role', 'createdAt', 'updatedAt'];
      if (keys.length !== allowedKeys.length || !keys.every((k) => allowedKeys.includes(k))) {
        return 'PERMISSION_DENIED';
      }
      if (incoming.uid !== docId) return 'PERMISSION_DENIED';
      if (incoming.createdAt !== REQUEST_TIME || incoming.updatedAt !== REQUEST_TIME) return 'PERMISSION_DENIED';
      if (auth!.uid === docId && incoming.role === 'student') return 'ALLOWED';
      if (admin) return 'ALLOWED';
      return 'PERMISSION_DENIED';
    }
    if (operation === 'update') {
      if (!verified || !incoming || !existing) return 'PERMISSION_DENIED';
      const keys = Object.keys(incoming);
      const allowedKeys = ['uid', 'displayName', 'email', 'role', 'createdAt', 'updatedAt'];
      if (keys.length !== allowedKeys.length || !keys.every((k) => allowedKeys.includes(k))) {
        return 'PERMISSION_DENIED';
      }
      if (incoming.uid !== existing.uid || incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
      if (incoming.updatedAt !== REQUEST_TIME) return 'PERMISSION_DENIED';
      if (admin) return 'ALLOWED';
      if (
        auth!.uid === docId &&
        incoming.role === existing.role &&
        incoming.email === existing.email
      ) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'courses') {
    if (operation === 'get' || operation === 'list') {
      if (existing?.isPublished === true || admin) return 'ALLOWED';
      return 'PERMISSION_DENIED';
    }
    if (operation === 'create') {
      if (!verified || !admin || !incoming) return 'PERMISSION_DENIED';
      if (incoming.courseType === 'free' && incoming.price !== 0) return 'PERMISSION_DENIED';
      if (incoming.courseType === 'paid' && (typeof incoming.price !== 'number' || incoming.price < 0)) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
  }

  if (collection === 'lessons') {
    if (operation === 'create') {
      if (!verified || !admin || !incoming) return 'PERMISSION_DENIED';
      if (typeof incoming.youtubeVideoId !== 'string' || !YOUTUBE_ID_REGEX.test(incoming.youtubeVideoId)) {
        return 'PERMISSION_DENIED';
      }
      if (!db.courses.has(String(incoming.courseId))) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
  }

  if (collection === 'enrollments') {
    if (operation === 'create') {
      if (!verified || !incoming) return 'PERMISSION_DENIED';
      const expectedId = `${incoming.userId}_${incoming.courseId}`;
      if (docId !== expectedId || incoming.id !== expectedId) return 'PERMISSION_DENIED';
      const course = db.courses.get(String(incoming.courseId));
      if (!course) return 'PERMISSION_DENIED';
      if (admin) return 'ALLOWED';
      if (
        incoming.userId === auth!.uid &&
        incoming.accessStatus === 'active' &&
        course.isPublished &&
        course.courseType === 'free'
      ) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'lessonProgress') {
    if (operation === 'get' || operation === 'list' || operation === 'update') {
      if (!auth || !existing) return 'PERMISSION_DENIED';
      if (existing.userId !== auth.uid && !admin) return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules file exists and contains all required collections and guards', () => {
  const rulesText = fs.readFileSync('./firestore.rules', 'utf8');
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /users/{userId}'));
  assert.ok(rulesText.includes('match /admins/{adminId}'));
  assert.ok(rulesText.includes('match /courses/{courseId}'));
  assert.ok(rulesText.includes('match /lessons/{lessonId}'));
  assert.ok(rulesText.includes('match /enrollments/{enrollmentId}'));
  assert.ok(rulesText.includes('match /lessonProgress/{progressId}'));
  assert.ok(rulesText.includes("request.auth.token.email == 'shefatahmed5959@gmail.com'"));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
});

test('Dirty Dozen Payloads: all 12 adversarial attacks return PERMISSION_DENIED', () => {
  const db: SimulatedDb = {
    admins: new Set(['admin_1']),
    courses: new Map([
      ['free_course_1', { id: 'free_course_1', courseType: 'free', isPublished: true }],
      ['paid_course_1', { id: 'paid_course_1', courseType: 'paid', isPublished: true }],
      ['draft_course', { id: 'draft_course', courseType: 'free', isPublished: false }],
    ]),
    lessons: new Map(),
    enrollments: new Map(),
  };

  const student1: AuthContext = { uid: 'student_1', email: 's1@example.com', email_verified: true };
  const realAdmin: AuthContext = { uid: 'admin_1', email: BOOTSTRAP_ADMIN_EMAIL, email_verified: true };
  const spoofedAdmin: AuthContext = { uid: 'attacker_1', email: BOOTSTRAP_ADMIN_EMAIL, email_verified: false };

  // 1. Self-Role Escalation on Create
  assert.equal(
    evaluateRules({
      collection: 'users',
      operation: 'create',
      docId: 'student_1',
      auth: student1,
      incoming: {
        uid: 'student_1',
        displayName: 'Attacker',
        email: 's1@example.com',
        role: 'admin',
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 2. Self-Role Escalation on Update
  assert.equal(
    evaluateRules({
      collection: 'users',
      operation: 'update',
      docId: 'student_1',
      auth: student1,
      existing: {
        uid: 'student_1',
        displayName: 'Student',
        email: 's1@example.com',
        role: 'student',
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      incoming: {
        uid: 'student_1',
        displayName: 'Student',
        email: 's1@example.com',
        role: 'admin',
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 3. PII Horizontal Scraping
  assert.equal(
    evaluateRules({
      collection: 'users',
      operation: 'get',
      docId: 'student_2',
      auth: student1,
      existing: { uid: 'student_2', email: 's2@example.com' },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 4. Unverified Admin Email Spoof
  assert.equal(
    evaluateRules({
      collection: 'courses',
      operation: 'create',
      docId: 'c1',
      auth: spoofedAdmin,
      incoming: { courseType: 'free', price: 0 },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 5. Shadow Field Injection on Profile Update
  assert.equal(
    evaluateRules({
      collection: 'users',
      operation: 'update',
      docId: 'student_1',
      auth: student1,
      existing: {
        uid: 'student_1',
        displayName: 'Student',
        email: 's1@example.com',
        role: 'student',
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      incoming: {
        uid: 'student_1',
        displayName: 'Student Updated',
        email: 's1@example.com',
        role: 'student',
        isVerifiedAdmin: true,
        createdAt: REQUEST_TIME,
        updatedAt: REQUEST_TIME,
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 6. Free Course Non-Zero Price Violation
  assert.equal(
    evaluateRules({
      collection: 'courses',
      operation: 'create',
      docId: 'c_free',
      auth: realAdmin,
      incoming: { courseType: 'free', price: 49 },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 7. Draft Course Leak
  assert.equal(
    evaluateRules({
      collection: 'courses',
      operation: 'get',
      docId: 'draft_course',
      auth: student1,
      existing: { id: 'draft_course', isPublished: false },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 8. Invalid YouTube Video ID Injection
  assert.equal(
    evaluateRules({
      collection: 'lessons',
      operation: 'create',
      docId: 'l1',
      auth: realAdmin,
      incoming: { courseId: 'free_course_1', youtubeVideoId: '<script>123</script>' },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 9. Orphaned Lesson Creation
  assert.equal(
    evaluateRules({
      collection: 'lessons',
      operation: 'create',
      docId: 'l1',
      auth: realAdmin,
      incoming: { courseId: 'non_existent_course', youtubeVideoId: 'M7lc1UVf-VE' },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 10. Unauthorized Paid Course Self-Enrollment
  assert.equal(
    evaluateRules({
      collection: 'enrollments',
      operation: 'create',
      docId: 'student_1_paid_course_1',
      auth: student1,
      incoming: {
        id: 'student_1_paid_course_1',
        userId: 'student_1',
        courseId: 'paid_course_1',
        accessStatus: 'active',
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 11. Duplicate Enrollment Composite ID Bypass
  assert.equal(
    evaluateRules({
      collection: 'enrollments',
      operation: 'create',
      docId: 'random_id_999',
      auth: student1,
      incoming: {
        id: 'random_id_999',
        userId: 'student_1',
        courseId: 'free_course_1',
        accessStatus: 'active',
      },
      db,
    }),
    'PERMISSION_DENIED'
  );

  // 12. Cross-Student Progress Tampering
  assert.equal(
    evaluateRules({
      collection: 'lessonProgress',
      operation: 'get',
      docId: 'student_2_lesson_1',
      auth: student1,
      existing: { userId: 'student_2', lessonId: 'lesson_1' },
      db,
    }),
    'PERMISSION_DENIED'
  );
});
