'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { useLms } from '@/components/lms-provider';
import { loginWithGooglePopup, registerStudentAccount } from '@/lib/lms-client';

export default function RegisterPage() {
  const router = useRouter();
  const { setSessionUser, notify } = useLms();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setDomainError(null);
      const { user, token } = await registerStudentAccount({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      setSessionUser(user, token);
      notify('Student account created! Welcome to DIU EduTech.', 'success');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      setError(null);
      setDomainError(null);
      const { user, token } = await loginWithGooglePopup();
      setSessionUser(user, token);
      notify(`Welcome, ${user.displayName}!`, 'success');
      router.push(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string; domain?: string };
      if (errObj?.code === 'auth/unauthorized-domain' || errObj?.message?.includes('unauthorized-domain')) {
        const host = errObj.domain || (typeof window !== 'undefined' ? window.location.hostname : 'your Vercel domain');
        setDomainError(host);
        setError(null);
      } else {
        setError(
          err instanceof Error ? err.message : 'Google Sign-In could not be completed.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-indigo-600">Student Registration</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Create Your Student Account
            </h1>
            <p className="text-sm text-slate-600">
              Enroll in free courses immediately and track your lesson completion progress.
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

          {domainError && (
            <div
              role="alert"
              data-testid="firebase-domain-warning"
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    Firebase Domain Authorization Required on Vercel
                  </p>
                  <p className="text-slate-600">
                    Firebase Authentication requires your Vercel deployment domain to be whitelisted for Google OAuth popups.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Your Current Vercel Domain:</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(domainError);
                      notify(`Copied "${domainError}" to clipboard!`, 'success');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Domain</span>
                  </button>
                </div>
                <p className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded select-all break-all">
                  {domainError}
                </p>
              </div>

              <div className="text-[11px] text-slate-700 space-y-1 pl-1">
                <p className="font-semibold text-slate-800">Quick 1-Minute Fix in Firebase Console:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                  <li>
                    Open{' '}
                    <a
                      href="https://console.firebase.google.com/project/second-gist-57c1c/authentication/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-600 underline inline-flex items-center gap-0.5"
                    >
                      <span>Firebase Auth Settings</span>
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </li>
                  <li>Scroll down to <strong>Authorized domains</strong> and click <strong>Add domain</strong></li>
                  <li>Paste <strong>{domainError}</strong> (or <code>vercel.app</code>) and save.</li>
                </ol>
              </div>

              <div className="pt-2 border-t border-amber-200/80 text-[11px] text-slate-700">
                💡 <strong>Instant Alternative:</strong> Complete the registration form below with your name, email, and password. It works immediately on Vercel without any domain setup!
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="register-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Email Address
              </label>
              <input
                id="register-email"
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
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <span>{loading ? 'Creating Account...' : 'Create Student Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs text-slate-500 whitespace-nowrap">
              Or sign up with
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignUp}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <span>Continue with Google (Firebase Auth)</span>
          </button>

          <p className="text-xs text-center text-slate-600 pt-2">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Log In
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
