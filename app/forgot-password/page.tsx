'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { requestPasswordReset } from '@/lib/lms-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const msg = await requestPasswordReset(email.trim());
      setSuccessMessage(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset link.');
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
            <p className="text-xs font-semibold text-indigo-600">Password Recovery</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reset Your Password
            </h1>
            <p className="text-sm text-slate-600">
              Enter your registered email address and we will send password reset instructions.
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

          {successMessage ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? 'Sending Reset Instructions...' : 'Send Reset Instructions'}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-100 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
