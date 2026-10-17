'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { useLms } from '@/components/lms-provider';
import { loginWithEmailPassword, loginWithGooglePopup } from '@/lib/lms-client';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const { setSessionUser, notify } = useLms();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateAfterLogin = (role: 'student' | 'admin') => {
    if (redirectUrl && redirectUrl.startsWith('/')) {
      router.push(redirectUrl);
      return;
    }
    router.push(role === 'admin' ? '/admin' : '/dashboard');
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { user, token } = await loginWithEmailPassword({
        email: email.trim(),
        password,
      });
      setSessionUser(user, token);
      notify(`Welcome back, ${user.displayName}!`, 'success');
      navigateAfterLogin(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const { user, token } = await loginWithGooglePopup();
      setSessionUser(user, token);
      notify(`Signed in as ${user.displayName}`, 'success');
      navigateAfterLogin(user.role);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In popup was closed or blocked by the browser.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCredentialLogin = async (quickEmail: string, quickPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      setEmail(quickEmail);
      setPassword(quickPassword);
      const { user, token } = await loginWithEmailPassword({
        email: quickEmail,
        password: quickPassword,
      });
      setSessionUser(user, token);
      notify(`Signed in as ${user.displayName}`, 'success');
      navigateAfterLogin(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-indigo-600">Account Access</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Log In to DIU EduTech
          </h1>
          <p className="text-sm text-slate-600">
            Sign in with your email and password or Google account.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-red-900"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-xs text-slate-500 whitespace-nowrap">
            Or continue with
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <span>Sign In with Google (Firebase Auth)</span>
        </button>

        {/* Quick Test Accounts for Instant Evaluation */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <p className="text-xs font-semibold text-slate-500">
            Quick Evaluation Accounts (Pre-configured):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                handleQuickCredentialLogin('alex.rivera@student.edu', 'StudentPass123!')
              }
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Sign In as Student
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickCredentialLogin('admin@lumina.edu', 'AdminPass123!')}
              className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              Sign In as Admin
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-slate-600 pt-2">
          Don&apos;t have a student account?{' '}
          <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <Suspense
        fallback={
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full h-96 animate-pulse" />
          </main>
        }
      >
        <LoginFormContent />
      </Suspense>
      <Footer />
    </div>
  );
}
