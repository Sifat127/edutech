'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  KeyRound,
  Search,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  approveEnrollmentByCodeAdmin,
  fetchAdminEnrollments,
  setStudentEnrollmentAdmin,
  updateAdminEnrollmentStatus,
  verifySecretCodeAdmin,
  type VerifiedSecretCodeEnrollment,
} from '@/lib/lms-client';
import {
  calculateAdminEnrollmentMetrics,
  normalizeSecretCode,
  toEnrollmentStatusUpper,
  type Course,
  type Enrollment,
  type UserProfile,
} from '@/lib/lms-logic';

interface AdminEnrollmentManagerProps {
  courses: Course[];
  users: UserProfile[];
  enrollments: Enrollment[];
  initialGrantUserId?: string;
  initialGrantCourseId?: string;
  onDataChanged: () => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type StatusFilterOption = 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED';

export function AdminEnrollmentManager({
  courses,
  users,
  enrollments,
  initialGrantUserId,
  initialGrantCourseId,
  onDataChanged,
  onNotify,
}: AdminEnrollmentManagerProps) {
  // Secret Code Direct Verification & Activation State
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [approvingCode, setApprovingCode] = useState(false);
  const [verifiedRecord, setVerifiedRecord] = useState<VerifiedSecretCodeEnrollment | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Filterable Enrollment Table State
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [serverEnrollments, setServerEnrollments] = useState<VerifiedSecretCodeEnrollment[] | null>(
    null
  );
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Manual Grant Form State
  const [grantUserId, setGrantUserId] = useState(
    initialGrantUserId || users.find((u) => u.role === 'student')?.uid || users[0]?.uid || ''
  );
  const [grantCourseId, setGrantCourseId] = useState(
    initialGrantCourseId || courses[0]?.id || ''
  );
  const [grantingAccess, setGrantingAccess] = useState(false);

  useEffect(() => {
    if (initialGrantUserId) setGrantUserId(initialGrantUserId);
  }, [initialGrantUserId]);

  useEffect(() => {
    if (initialGrantCourseId) setGrantCourseId(initialGrantCourseId);
  }, [initialGrantCourseId]);

  const loadServerEnrollments = useCallback(async () => {
    try {
      const response = await fetchAdminEnrollments({
        status: 'ALL',
        limit: 100,
      });
      setServerEnrollments(response.enrollments);
    } catch {
      // Fall back to props-derived enriched enrollments if needed
    }
  }, []);

  useEffect(() => {
    void loadServerEnrollments();
  }, [loadServerEnrollments, enrollments]);

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);

  const metrics = useMemo(() => {
    return calculateAdminEnrollmentMetrics({ courses, enrollments });
  }, [courses, enrollments]);

  const allEnrichedEnrollments: VerifiedSecretCodeEnrollment[] = useMemo(() => {
    if (serverEnrollments) return serverEnrollments;
    return enrollments
      .map((enrollment) => {
        const student = userMap.get(enrollment.userId);
        const course = courseMap.get(enrollment.courseId);
        const statusUpper = toEnrollmentStatusUpper(enrollment);
        return {
          ...enrollment,
          status: statusUpper,
          secretCode: enrollment.secretCode || `EDU-${enrollment.id.slice(-6).toUpperCase()}`,
          paymentMethod:
            enrollment.paymentMethod || (course?.courseType === 'free' ? 'Free' : 'bKash'),
          createdAt: enrollment.createdAt || enrollment.enrolledAt,
          activatedAt: enrollment.activatedAt ?? null,
          studentName: student?.displayName || enrollment.userId,
          studentEmail: student?.email || 'Unknown',
          courseTitle: course?.title || enrollment.courseId,
          coursePrice: course?.price ?? 0,
          courseType: course?.courseType ?? 'paid',
          courseCategory: course?.category ?? 'General',
        };
      })
      .sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [serverEnrollments, enrollments, userMap, courseMap]);

  const pendingCodeRecords = useMemo(
    () => allEnrichedEnrollments.filter((e) => e.status === 'PENDING'),
    [allEnrichedEnrollments]
  );

  const filteredEnrollments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEnrichedEnrollments.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (q) {
        const matchesCode = item.secretCode.toLowerCase().includes(q);
        const matchesEmail = item.studentEmail.toLowerCase().includes(q);
        const matchesName = item.studentName.toLowerCase().includes(q);
        const matchesCourse = item.courseTitle.toLowerCase().includes(q);
        const matchesTrx = (item.trxId || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesEmail && !matchesName && !matchesCourse && !matchesTrx) {
          return false;
        }
      }
      return true;
    });
  }, [allEnrichedEnrollments, statusFilter, searchQuery]);

  const handleVerifySecretCode = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    const targetCode = normalizeSecretCode(overrideCode ?? secretCodeInput);
    if (!targetCode) {
      setVerifyError('Please enter a Secret Code (e.g., EDU-8F29K1).');
      return;
    }

    try {
      setVerifyingCode(true);
      setVerifyError(null);
      setSecretCodeInput(targetCode);
      const record = await verifySecretCodeAdmin(targetCode);
      setVerifiedRecord(record);
    } catch (err) {
      setVerifiedRecord(null);
      setVerifyError(
        err instanceof Error ? err.message : 'No enrollment found for this Secret Code.'
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleApproveOrRejectVerifiedCode = async (action: 'APPROVE' | 'REJECT') => {
    if (!verifiedRecord) return;
    try {
      setApprovingCode(true);
      const { enrollment, message } = await approveEnrollmentByCodeAdmin({
        secretCode: verifiedRecord.secretCode,
        action,
      });
      setVerifiedRecord(enrollment);
      onNotify(message, action === 'APPROVE' ? 'success' : 'info');
      await Promise.all([onDataChanged(), loadServerEnrollments()]);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Failed to update enrollment by Secret Code.',
        'error'
      );
    } finally {
      setApprovingCode(false);
    }
  };

  const handleTableRowStatusChange = async (
    record: VerifiedSecretCodeEnrollment,
    nextStatus: 'ACTIVE' | 'REJECTED'
  ) => {
    try {
      setUpdatingRowId(record.id);
      if (record.secretCode) {
        const { message, enrollment } = await approveEnrollmentByCodeAdmin({
          secretCode: record.secretCode,
          action: nextStatus === 'ACTIVE' ? 'APPROVE' : 'REJECT',
        });
        if (verifiedRecord?.id === record.id) {
          setVerifiedRecord(enrollment);
        }
        onNotify(message, nextStatus === 'ACTIVE' ? 'success' : 'info');
      } else {
        await updateAdminEnrollmentStatus({
          enrollmentId: record.id,
          status: nextStatus,
        });
        onNotify(
          nextStatus === 'ACTIVE'
            ? `Approved enrollment for ${record.studentName}.`
            : `Rejected enrollment for ${record.studentName}.`,
          nextStatus === 'ACTIVE' ? 'success' : 'info'
        );
      }
      await Promise.all([onDataChanged(), loadServerEnrollments()]);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Failed to update enrollment status.',
        'error'
      );
    } finally {
      setUpdatingRowId(null);
    }
  };

  const handleManualGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId || !grantCourseId) {
      onNotify('Select both a student and a course.', 'error');
      return;
    }
    try {
      setGrantingAccess(true);
      await setStudentEnrollmentAdmin({
        userId: grantUserId,
        courseId: grantCourseId,
        accessStatus: 'active',
      });
      await Promise.all([onDataChanged(), loadServerEnrollments()]);
      onNotify('Course access granted and activated for student.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to grant access.', 'error');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      onNotify(`Secret Code ${code} copied.`, 'info');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Admin Enrollment Metrics / Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Enrolled Students</span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p
            data-testid="metric-total-enrolled"
            className="text-3xl font-bold text-slate-900 font-mono"
          >
            {metrics.totalEnrolledStudents}
          </p>
          <p className="text-xs text-slate-500">
            {metrics.uniqueActiveStudents} Unique Active Learners
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Revenue / Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            data-testid="metric-total-revenue"
            className="text-3xl font-bold text-emerald-700 font-mono"
          >
            ${metrics.totalRevenue}
          </p>
          <p className="text-xs text-slate-500">Verified bKash Paid Enrollments</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p
            data-testid="metric-pending-approvals"
            className="text-3xl font-bold text-amber-700 font-mono"
          >
            {metrics.pendingApprovals}
          </p>
          <p className="text-xs text-slate-500">Awaiting Secret Code Activation</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Courses</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p
            data-testid="metric-active-courses"
            className="text-3xl font-bold text-slate-900 font-mono"
          >
            {metrics.activeCourses}
          </p>
          <p className="text-xs text-slate-500">Published in Course Catalog</p>
        </div>
      </div>

      {/* 2. Direct Secret Code Verification & Course Activation Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-indigo-600">
              bKash Secret Code Verification Engine
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Enter Secret Code to Activate Course
            </h2>
            <p className="text-xs text-slate-500">
              Paste the student&apos;s Secret Code from WhatsApp to inspect their pending purchase
              and unlock course access in one click.
            </p>
          </div>

          {pendingCodeRecords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Pending Codes:</span>
              {pendingCodeRecords.slice(0, 4).map((item) => (
                <button
                  key={item.secretCode}
                  type="button"
                  onClick={() => void handleVerifySecretCode(undefined, item.secretCode)}
                  className="px-2.5 py-1 text-xs font-mono font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors cursor-pointer"
                >
                  {item.secretCode}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => void handleVerifySecretCode(e)}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="relative flex-1">
            <label htmlFor="admin-secret-code-input" className="sr-only">
              Enter Secret Code to Activate Course
            </label>
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="admin-secret-code-input"
              type="text"
              value={secretCodeInput}
              onChange={(e) => setSecretCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter Secret Code to Activate Course (e.g., EDU-8F29K1)"
              className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 uppercase placeholder:normal-case placeholder:font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={verifyingCode}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
          >
            {verifyingCode ? 'Verifying Code...' : 'Verify Secret Code'}
          </button>
        </form>

        {verifyError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs font-medium text-red-900">
            {verifyError}
          </div>
        )}

        {/* Visual Verification Preview Card */}
        {verifiedRecord && (
          <div
            data-testid="verified-secret-code-preview"
            className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-slate-900">
                  {verifiedRecord.secretCode}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span
                  className={`text-xs font-bold ${
                    verifiedRecord.status === 'ACTIVE'
                      ? 'text-emerald-700'
                      : verifiedRecord.status === 'PENDING'
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {verifiedRecord.status}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="text-xs text-slate-600">
                  Payment: {verifiedRecord.paymentMethod}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setVerifiedRecord(null);
                  setSecretCodeInput('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-start sm:self-auto cursor-pointer"
              >
                Clear Preview
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-slate-500 font-medium">Student Details</p>
                <p className="text-sm font-bold text-slate-900">{verifiedRecord.studentName}</p>
                <p className="text-slate-600">{verifiedRecord.studentEmail}</p>
              </div>

              <div className="space-y-1">
                <p className="text-slate-500 font-medium">Course & Fee</p>
                <p className="text-sm font-bold text-slate-900">{verifiedRecord.courseTitle}</p>
                <p className="text-slate-600 tabular-nums">
                  {verifiedRecord.courseType === 'paid'
                    ? `Paid Course ($${verifiedRecord.coursePrice})`
                    : 'Free Course ($0)'}
                </p>
              </div>

              <div className="space-y-1 tabular-nums">
                <p className="text-slate-500 font-medium">Payment & Timestamps</p>
                <p className="text-slate-800">
                  Requested: {new Date(verifiedRecord.createdAt).toLocaleString()}
                </p>
                {verifiedRecord.trxId && (
                  <p className="font-mono text-slate-900">TrxID: {verifiedRecord.trxId}</p>
                )}
                {verifiedRecord.senderPhone && (
                  <p className="font-mono text-slate-700">Sender: {verifiedRecord.senderPhone}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200">
              {verifiedRecord.status !== 'REJECTED' && (
                <button
                  type="button"
                  disabled={approvingCode}
                  onClick={() => void handleApproveOrRejectVerifiedCode('REJECT')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Enrollment</span>
                </button>
              )}

              {verifiedRecord.status !== 'ACTIVE' ? (
                <button
                  type="button"
                  disabled={approvingCode}
                  onClick={() => void handleApproveOrRejectVerifiedCode('APPROVE')}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {approvingCode ? 'Activating...' : 'Confirm Approval & Activate Course'}
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Course is Active & Unlocked for Student</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Comprehensive Filterable Enrollment Management Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Enrollment & bKash Purchase Ledger ({filteredEnrollments.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Filter by verification status or search by Secret Code, student email, or course.
              </p>
            </div>

            {/* Segmented Status Filter Controls */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
              {(
                [
                  { id: 'ALL', label: `All (${allEnrichedEnrollments.length})` },
                  { id: 'PENDING', label: `Pending (${metrics.pendingApprovals})` },
                  { id: 'ACTIVE', label: `Active (${metrics.totalEnrolledStudents})` },
                  { id: 'REJECTED', label: `Rejected (${metrics.rejectedEnrollments})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <label htmlFor="enrollment-table-search" className="sr-only">
              Search by Secret Code, Student Email, or Course Title
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="enrollment-table-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Secret Code (e.g. EDU-8F29K1), student email, name, or course title..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Student Name / Email</th>
                <th className="py-3 px-4">Course Title</th>
                <th className="py-3 px-4">Secret Code</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Requested Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {filteredEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    No enrollments match the current filter or search query.
                  </td>
                </tr>
              ) : (
                filteredEnrollments.map((record) => {
                  const isRowUpdating = updatingRowId === record.id;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{record.studentName}</p>
                        <p className="text-[11px] text-slate-500">{record.studentEmail}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{record.courseTitle}</p>
                        <p className="text-[11px] text-slate-500">
                          {record.courseType === 'paid'
                            ? `Paid ($${record.coursePrice}) · ${record.paymentMethod}`
                            : 'Free ($0)'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleVerifySecretCode(undefined, record.secretCode)}
                            title="Inspect Secret Code"
                            className="font-mono font-bold text-slate-900 hover:text-indigo-600 cursor-pointer"
                          >
                            {record.secretCode}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyCode(record.secretCode)}
                            aria-label={`Copy ${record.secretCode}`}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {copiedCode === record.secretCode ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            record.status === 'ACTIVE'
                              ? 'text-emerald-700'
                              : record.status === 'PENDING'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {record.status === 'ACTIVE'
                            ? 'Active'
                            : record.status === 'PENDING'
                            ? 'Pending'
                            : 'Rejected'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <p>{new Date(record.createdAt).toLocaleDateString()}</p>
                        {record.activatedAt && record.status === 'ACTIVE' && (
                          <p className="text-[10px] text-slate-400">
                            Activated {new Date(record.activatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                        {record.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={isRowUpdating}
                            onClick={() => void handleTableRowStatusChange(record, 'ACTIVE')}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50 cursor-pointer"
                          >
                            Approve
                          </button>
                        )}

                        {record.status !== 'REJECTED' && (
                          <button
                            type="button"
                            disabled={isRowUpdating}
                            onClick={() => void handleTableRowStatusChange(record, 'REJECTED')}
                            className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Manual Direct Grant Form (Fallback / Admin Override) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Manual Student Enrollment Assignment
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Directly assign and activate a course for any registered student account.
          </p>
        </div>

        <form
          onSubmit={(e) => void handleManualGrantSubmit(e)}
          className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end"
        >
          <div className="sm:col-span-5 space-y-1.5">
            <label
              htmlFor="grant-student-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Select Student
            </label>
            <select
              id="grant-student-select"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5 space-y-1.5">
            <label
              htmlFor="grant-course-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Select Course
            </label>
            <select
              id="grant-course-select"
              value={grantCourseId}
              onChange={(e) => setGrantCourseId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.courseType === 'paid' ? `Paid $${c.price}` : 'Free'})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={grantingAccess}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {grantingAccess ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
