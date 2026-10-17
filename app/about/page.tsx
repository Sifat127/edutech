'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Lock, PlayCircle, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
        <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-10 space-y-4">
          <p className="text-xs font-semibold text-indigo-600">About DIU EduTech</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Focused Online Learning with Verified Access Control
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
            DIU EduTech is an online learning management system designed for technical and
            creative curricula. We combine structured lesson sequences, embedded YouTube video
            playback, and server-verified enrollment rules in a distraction-free environment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Free & Paid Course Tracks</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Students can browse the public catalog and enroll immediately in any published free
              course. Paid courses display full curriculum outlines publicly and unlock video
              lessons once an administrator approves an active enrollment.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <PlayCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Embedded YouTube Unlisted Video Delivery
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Lessons are streamed inside our learning interface using the official YouTube
              embedded player (`https://www.youtube.com/embed/VIDEO_ID?rel=0`). Note that YouTube
              Unlisted videos are accessible to anyone with the direct video link; platform
              authorization protects lesson metadata and course progress routes.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Role-Based Security & Server Verification
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              New accounts default to the student role. Course creation, lesson management, and
              paid enrollment approvals are restricted to verified administrators on the server and
              in Cloud Firestore Security Rules.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Real-Time Progress & Curriculum Navigation
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mark individual lessons as completed while you watch, resume from where you left off
              on your Student Dashboard, and navigate seamlessly between previous and next lessons.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Ready to start learning?</h2>
            <p className="text-sm text-slate-600">
              Explore our published courses or register a free student account today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/courses"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Browse Courses
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Create Account
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
