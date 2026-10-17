'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useLms } from './lms-provider';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useLms();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600 rounded"
        >
          DIU EduTech
        </Link>

        {/* Zone 2: Single-line Navigation Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <Link
            href="/"
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              pathname === '/' ? 'text-indigo-600 font-semibold' : ''
            }`}
          >
            Home
          </Link>
          <Link
            href="/courses"
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              pathname === '/courses' ? 'text-indigo-600 font-semibold' : ''
            }`}
          >
            Courses
          </Link>
          <Link
            href="/courses?type=free"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Free Courses
          </Link>
          <Link
            href="/about"
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              pathname === '/about' ? 'text-indigo-600 font-semibold' : ''
            }`}
          >
            About
          </Link>
          {user && (
            <Link
              href={user.role === 'admin' ? '/admin' : '/dashboard'}
              className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
                  ? 'text-indigo-600 font-semibold'
                  : ''
              }`}
            >
              {user.role === 'admin' ? 'Admin Dashboard' : 'Student Dashboard'}
            </Link>
          )}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="hidden md:flex items-center gap-5 shrink-0">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  Student View
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Log Out
              </button>
              <Link
                href={user.role === 'admin' ? '/admin' : '/dashboard'}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
              >
                {user.role === 'admin' ? 'Manage Platform' : 'My Learning'}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="p-2.5 rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-slate-800 hover:text-indigo-600"
          >
            Home
          </Link>
          <Link
            href="/courses"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-slate-800 hover:text-indigo-600"
          >
            Courses
          </Link>
          <Link
            href="/courses?type=free"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-slate-800 hover:text-indigo-600"
          >
            Free Courses
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-slate-800 hover:text-indigo-600"
          >
            About
          </Link>
          {user ? (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-sm font-semibold text-indigo-600"
              >
                Student Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-sm font-semibold text-indigo-600"
                >
                  Admin Dashboard
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center py-2.5 text-sm font-medium text-slate-800 border border-slate-300 rounded-lg"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
