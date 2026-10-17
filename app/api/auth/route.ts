import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  createSessionToken,
  hashPassword,
  readDb,
  toPublicUserProfile,
  verifyPassword,
  writeDb,
} from '@/lib/server-db';
import { BOOTSTRAP_ADMIN_EMAIL } from '@/lib/lms-logic';

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    return NextResponse.json({ user }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const db = readDb();
    const now = new Date().toISOString();

    if (action === 'firebase-sync') {
      const user = await authenticateRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Invalid Firebase authentication token.' }, { status: 401 });
      }
      const token = createSessionToken({ uid: user.uid, email: user.email });
      return NextResponse.json({ user, token }, { status: 200 });
    }

    if (action === 'register') {
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (displayName.length < 2 || displayName.length > 100) {
        return NextResponse.json(
          { error: 'Display name must be between 2 and 100 characters.' },
          { status: 400 }
        );
      }
      if (!email || !email.includes('@') || email.length > 254) {
        return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      const existingByEmail = Object.values(db.users).find(
        (u) => u.email.toLowerCase() === email
      );
      if (existingByEmail) {
        return NextResponse.json(
          { error: 'An account with this email address already exists.' },
          { status: 409 }
        );
      }

      const uid =
        typeof body.uid === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(body.uid) && !db.users[body.uid]
          ? body.uid
          : `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

      const isBootstrap = email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      const { hash, salt } = hashPassword(password);

      // Never trust any client-submitted role field; always assign student unless bootstrap admin
      const newUser = {
        uid,
        displayName,
        email,
        role: isBootstrap ? ('admin' as const) : ('student' as const),
        createdAt: now,
        updatedAt: now,
        passwordHash: hash,
        passwordSalt: salt,
      };

      db.users[uid] = newUser;
      writeDb(db);

      const publicUser = toPublicUserProfile(newUser);
      const token = createSessionToken({ uid: publicUser.uid, email: publicUser.email });
      return NextResponse.json({ user: publicUser, token }, { status: 201 });
    }

    if (action === 'login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
      }

      const userRecord = Object.values(db.users).find((u) => u.email.toLowerCase() === email);
      if (!userRecord || !verifyPassword(password, userRecord.passwordHash, userRecord.passwordSalt)) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const publicUser = toPublicUserProfile(userRecord);
      const token = createSessionToken({ uid: publicUser.uid, email: publicUser.email });
      return NextResponse.json({ user: publicUser, token }, { status: 200 });
    }

    if (action === 'reset-password') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
      }

      const userRecord = Object.values(db.users).find((u) => u.email.toLowerCase() === email);
      if (userRecord) {
        userRecord.resetRequestedAt = now;
        writeDb(db);
      }

      return NextResponse.json(
        {
          message:
            'If an account exists for that email address, password reset instructions have been processed.',
        },
        { status: 200 }
      );
    }

    if (action === 'update-profile') {
      const caller = await authenticateRequest(request);
      if (!caller) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      }

      if ('role' in body && body.role !== caller.role) {
        return NextResponse.json(
          { error: 'Forbidden: Users cannot modify their own authorization role.' },
          { status: 403 }
        );
      }

      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
      if (displayName.length < 2 || displayName.length > 100) {
        return NextResponse.json(
          { error: 'Display name must be between 2 and 100 characters.' },
          { status: 400 }
        );
      }

      const record = db.users[caller.uid];
      if (!record) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
      }

      record.displayName = displayName;
      record.updatedAt = now;
      writeDb(db);

      return NextResponse.json({ user: toPublicUserProfile(record) }, { status: 200 });
    }

    return NextResponse.json({ error: 'Unsupported authentication action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
