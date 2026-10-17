'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  MessageCircle,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  initiatePaidEnrollment,
  type InitiatePaidEnrollmentResponse,
} from '@/lib/lms-client';
import {
  BKASH_PAYMENT_CONFIG,
  type Course,
  type Enrollment,
  type UserProfile,
} from '@/lib/lms-logic';

interface BkashCheckoutModalProps {
  course: Course;
  user: UserProfile | null;
  existingEnrollment?: Enrollment | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrollmentInitiated?: (enrollment: Enrollment) => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function BkashCheckoutModal({
  course,
  user,
  existingEnrollment,
  isOpen,
  onClose,
  onEnrollmentInitiated,
  onNotify,
}: BkashCheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [savingRef, setSavingRef] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<InitiatePaidEnrollmentResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [trxId, setTrxId] = useState(existingEnrollment?.trxId || '');
  const [senderPhone, setSenderPhone] = useState(existingEnrollment?.senderPhone || '');

  const initiateOrLoadSecretCode = useCallback(async () => {
    if (!user || !isOpen) return;
    try {
      setLoading(true);
      setError(null);
      const response = await initiatePaidEnrollment({
        courseId: course.id,
      });
      setCheckoutData(response);
      if (response.enrollment.trxId) {
        setTrxId(response.enrollment.trxId);
      }
      if (response.enrollment.senderPhone) {
        setSenderPhone(response.enrollment.senderPhone);
      }
      if (onEnrollmentInitiated) {
        onEnrollmentInitiated(response.enrollment);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate Secret Code for this course.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, isOpen, course.id, onEnrollmentInitiated]);

  useEffect(() => {
    if (isOpen && user) {
      void initiateOrLoadSecretCode();
    }
  }, [isOpen, user, initiateOrLoadSecretCode]);

  if (!isOpen) return null;

  const secretCode =
    checkoutData?.secretCode || existingEnrollment?.secretCode || '';
  const bkashConfig = checkoutData?.bkashConfig || BKASH_PAYMENT_CONFIG;

  const handleCopySecretCode = async () => {
    if (!secretCode) return;
    try {
      await navigator.clipboard.writeText(secretCode);
      setCopiedCode(true);
      onNotify?.(`Secret Code ${secretCode} copied to clipboard!`, 'success');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      onNotify?.('Unable to copy automatically. Please select and copy the code.', 'info');
    }
  };

  const handleCopyPhone = async (num: string, label: string) => {
    try {
      await navigator.clipboard.writeText(num.replace(/[^0-9+]/g, ''));
      setCopiedNumber(num);
      onNotify?.(`${label} copied to clipboard.`, 'success');
      setTimeout(() => setCopiedNumber(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSavePaymentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setSavingRef(true);
      const response = await initiatePaidEnrollment({
        courseId: course.id,
        trxId: trxId.trim() || undefined,
        senderPhone: senderPhone.trim() || undefined,
      });
      setCheckoutData(response);
      onEnrollmentInitiated?.(response.enrollment);
      onNotify?.(
        'bKash payment details saved! Contact support on WhatsApp with your Secret Code for fast activation.',
        'success'
      );
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'Unable to save payment reference.',
        'error'
      );
    } finally {
      setSavingRef(false);
    }
  };

  const whatsappMessage = [
    `Hello DIU EduTech Support,`,
    `I have sent the bKash course fee and would like to activate my course.`,
    ``,
    `• Course: ${course.title} ($${course.price})`,
    `• Secret Code: ${secretCode || 'Generating...'}`,
    `• Student Name: ${user?.displayName || ''}`,
    `• Student Email: ${user?.email || ''}`,
    trxId.trim() ? `• bKash TrxID: ${trxId.trim()}` : null,
    senderPhone.trim() ? `• Sender bKash Number: ${senderPhone.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappUrl = `https://wa.me/${bkashConfig.whatsappNumber}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bkash-checkout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 sm:p-7 space-y-6 shadow-xl my-8">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-indigo-600">
              Manual bKash Verification & Course Unlock
            </p>
            <h2
              id="bkash-checkout-modal-title"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Enroll in {course.title}
            </h2>
            <p className="text-xs text-slate-500 tabular-nums">
              Course Fee: <strong className="text-slate-900">${course.price}</strong> · Payment
              Method: <strong className="text-slate-900">bKash</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bKash checkout dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!user ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5 text-slate-700" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-900">
                Sign In to Generate Your Unique Secret Code
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Each bKash purchase generates a unique Secret Code tied to your student account and
                selected course. Please log in or create a student account first.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href={`/login?redirect=/courses/${encodeURIComponent(course.id)}`}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Log In to Continue
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Create Student Account
              </Link>
            </div>
          </div>
        ) : loading && !secretCode ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-700">
              Generating your unique enrollment Secret Code...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => void initiateOrLoadSecretCode()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Generated Secret Code Highlight Box */}
            <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Your Unique Enrollment Secret Code</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300">
                  <Clock className="w-3 h-3" />
                  <span>Status: PENDING</span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-lg px-4 py-3">
                <div>
                  <p
                    data-testid="generated-secret-code"
                    className="text-2xl font-mono font-bold tracking-wider text-white select-all"
                  >
                    {secretCode}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Linked to {user.email} · {course.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopySecretCode}
                  aria-label="Copy Secret Code"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Keep this Secret Code safe. Include it in your bKash reference or send it to our
                support team on WhatsApp so an administrator can immediately unlock your course.
              </p>
            </div>

            {/* Step-by-Step bKash Payment Instructions */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Step 1: Send Course Fee via bKash (${course.price})
                </h3>
                <span className="text-[11px] font-semibold text-slate-600">
                  {bkashConfig.accountName}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tabular-nums">
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">bKash Merchant (Payment)</p>
                    <p className="text-sm font-mono font-bold text-slate-900">
                      {bkashConfig.merchantNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyPhone(bkashConfig.merchantNumber, 'bKash Merchant number')
                    }
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    {copiedNumber === bkashConfig.merchantNumber ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">bKash Personal (Send Money)</p>
                    <p className="text-sm font-mono font-bold text-slate-900">
                      {bkashConfig.personalNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyPhone(bkashConfig.personalNumber, 'bKash Personal number')
                    }
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    {copiedNumber === bkashConfig.personalNumber ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Optional bKash TrxID & Sender Phone Form */}
              <form onSubmit={handleSavePaymentDetails} className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-slate-700">
                  Optional: Attach your bKash Transaction ID (TrxID) & Sender Number
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bkash-trxid-input" className="sr-only">
                      bKash Transaction ID (TrxID)
                    </label>
                    <input
                      id="bkash-trxid-input"
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder="bKash TrxID (e.g., BJM82K91L0)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="bkash-phone-input" className="sr-only">
                      Your bKash Sender Number
                    </label>
                    <input
                      id="bkash-phone-input"
                      type="tel"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="Sender Phone (e.g., 017XXXXXXXX)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingRef}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    {savingRef ? 'Saving...' : 'Save Payment Reference'}
                  </button>
                </div>
              </form>
            </div>

            {/* Step 2: Direct WhatsApp Support Verification */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    Step 2: Send Secret Code on WhatsApp for Instant Activation
                  </h3>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Click below to message our verification team on WhatsApp with your Secret Code{' '}
                    <strong className="font-mono">{secretCode}</strong>. Once verified, your course
                    access automatically changes from <strong>PENDING</strong> to{' '}
                    <strong>ACTIVE</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Secret Code via WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-900 font-mono">
                  <Phone className="w-3.5 h-3.5" />
                  <span>+{bkashConfig.whatsappNumber}</span>
                </span>
              </div>
            </div>

            {/* Footer Status & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Payment under review / Pending approval</span>
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <Link
                  href="/dashboard"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  View in Dashboard
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
