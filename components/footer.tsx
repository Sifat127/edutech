import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-slate-900 inline-block"
            >
              DIU EduTech
            </Link>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Structured engineering and design curricula delivered through focused video lessons,
              verified access controls, and self-paced progress tracking.
            </p>
          </div>

          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-slate-900 tracking-wide">
              Curriculum
            </h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/courses" className="hover:text-slate-900 transition-colors">
                  All Courses
                </Link>
              </li>
              <li>
                <Link href="/courses?type=free" className="hover:text-slate-900 transition-colors">
                  Free Courses
                </Link>
              </li>
              <li>
                <Link href="/courses?type=paid" className="hover:text-slate-900 transition-colors">
                  Paid Courses
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-slate-900 transition-colors">
                  About the Platform
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-slate-900 tracking-wide">
              Account & Access
            </h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/login" className="hover:text-slate-900 transition-colors">
                  Student Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-slate-900 transition-colors">
                  Create Student Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
                  Student Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-slate-900 transition-colors">
                  Administrator Console
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 DIU EduTech. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/courses" className="hover:text-slate-800 transition-colors">
              Course Catalog
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/about" className="hover:text-slate-800 transition-colors">
              Architecture & Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
