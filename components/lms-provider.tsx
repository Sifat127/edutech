'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  fetchCoursesList,
  getAuthHeaders,
  getStoredToken,
  INITIAL_PUBLISHED_COURSES,
  logoutAccount,
  setStoredToken,
  type EnrichedCourse,
} from '@/lib/lms-client';
import type { Enrollment, LessonProgress, UserProfile } from '@/lib/lms-logic';

if (typeof window !== 'undefined') {
  try {
    let currentFetch = window.fetch.bind(window);
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get: () => currentFetch,
      set: (nextFetch) => {
        if (typeof nextFetch === 'function') {
          currentFetch = nextFetch;
        }
      },
    });
  } catch {
    // Ignore if already configured
  }
}

interface LmsContextValue {
  user: UserProfile | null;
  authLoading: boolean;
  courses: EnrichedCourse[];
  coursesLoading: boolean;
  enrollments: Enrollment[];
  progressRecords: LessonProgress[];
  setSessionUser: (user: UserProfile | null, token?: string | null) => void;
  refreshCourses: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  logout: () => Promise<void>;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const LmsContext = createContext<LmsContextValue | undefined>(undefined);

interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function LmsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [courses, setCourses] = useState<EnrichedCourse[]>(INITIAL_PUBLISHED_COURSES);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressRecords, setProgressRecords] = useState<LessonProgress[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const refreshCourses = useCallback(async () => {
    try {
      const list = await fetchCoursesList();
      setCourses(list);
    } catch {
      // Keep existing courses on transient failure
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    const token = getStoredToken();
    if (!token && !auth.currentUser) {
      setEnrollments([]);
      setProgressRecords([]);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const [enrollRes, progRes] = await Promise.all([
        fetch('/api/enrollments', { headers, cache: 'no-store' }),
        fetch('/api/progress', { headers, cache: 'no-store' }),
      ]);

      if (enrollRes.ok) {
        const eData = (await enrollRes.json()) as { enrollments?: Enrollment[] };
        setEnrollments(eData.enrollments || []);
      }
      if (progRes.ok) {
        const pData = (await progRes.json()) as { progressRecords?: LessonProgress[] };
        setProgressRecords(pData.progressRecords || []);
      }
    } catch {
      // Ignore network errors during background refresh
    }
  }, []);

  const setSessionUser = useCallback(
    (nextUser: UserProfile | null, token?: string | null) => {
      if (token !== undefined) {
        setStoredToken(token);
      }
      setUser(nextUser);
    },
    []
  );

  // Restore session on mount & listen to Firebase Auth state changes
  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const res = await fetch('/api/auth', {
            headers: { Authorization: `Bearer ${storedToken}` },
            cache: 'no-store',
          });
          if (res.ok) {
            const data = (await res.json()) as { user?: UserProfile };
            if (mounted && data.user) {
              setUser(data.user);
              setAuthLoading(false);
              return;
            }
          } else {
            setStoredToken(null);
          }
        } catch {
          // Proceed to Firebase Auth listener
        }
      }

      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!mounted) return;
        if (fbUser) {
          try {
            const idToken = await fbUser.getIdToken();
            const res = await fetch('/api/auth', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ action: 'firebase-sync' }),
            });
            if (res.ok) {
              const data = (await res.json()) as { user?: UserProfile; token?: string };
              if (mounted && data.user) {
                if (data.token) setStoredToken(data.token);
                setUser(data.user);
              }
            }
          } catch {
            // Ignore sync error
          }
        }
        if (mounted) {
          setAuthLoading(false);
        }
      });

      return unsubscribe;
    }

    let cleanup: (() => void) | undefined;
    bootstrapAuth().then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    void refreshCourses();
  }, [refreshCourses]);

  useEffect(() => {
    if (user) {
      void refreshUserData();
    } else {
      setEnrollments([]);
      setProgressRecords([]);
    }
  }, [user, refreshUserData]);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
    setEnrollments([]);
    setProgressRecords([]);
    notify('You have been logged out.', 'info');
  }, [notify]);

  return (
    <LmsContext.Provider
      value={{
        user,
        authLoading,
        courses,
        coursesLoading,
        enrollments,
        progressRecords,
        setSessionUser,
        refreshCourses,
        refreshUserData,
        logout,
        notify,
      }}
    >
      {children}
      {/* Accessible notification region */}
      {toasts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm font-medium shadow-md transition-opacity ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : toast.type === 'success'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </LmsContext.Provider>
  );
}

export function useLms(): LmsContextValue {
  const ctx = useContext(LmsContext);
  if (!ctx) {
    throw new Error('useLms must be used within an LmsProvider');
  }
  return ctx;
}
