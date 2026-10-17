'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Lock,
  Maximize2,
  Pause,
  Play,
  PlayCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { useLms } from '@/components/lms-provider';
import {
  enrollInCourse,
  fetchAuthorizedLessons,
  fetchCourseDetails,
  toggleLessonCompletion,
} from '@/lib/lms-client';
import {
  buildYouTubeEmbedUrl,
  type Course,
  type CourseProgressSummary,
  type Lesson,
} from '@/lib/lms-logic';

function CourseLearningContent() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId || '';
  const searchParams = useSearchParams();
  const requestedLessonId = searchParams.get('lesson');
  const router = useRouter();

  const { user, authLoading, refreshUserData, notify } = useLms();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<CourseProgressSummary | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);
  const [togglingComplete, setTogglingComplete] = useState(false);
  const [enrollingFree, setEnrollingFree] = useState(false);
  const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);
  const [isPlayingLesson, setIsPlayingLesson] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState<boolean>(false);

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isDraggingSeekRef = useRef<boolean>(false);
  const seekUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendPlayerCommand = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  }, []);

  const registerIframeListeners = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    win.postMessage(
      JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onReady'] }),
      '*'
    );
    win.postMessage(
      JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
      '*'
    );
  }, []);

  useEffect(() => {
    if (!isPlayingLesson) return;
    const interval = setInterval(() => {
      registerIframeListeners();
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlayingLesson, registerIframeListeners]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data) as {
          event?: string;
          info?: {
            currentTime?: number;
            duration?: number;
            playerState?: number;
          };
        };
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number' && !isDraggingSeekRef.current) {
            setCurrentTime(data.info.currentTime);
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            setDuration(data.info.duration);
          }
          if (data.info.playerState === 1) {
            setIsPaused(false);
          } else if (data.info.playerState === 2) {
            setIsPaused(true);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadAuthorizedWorkspace = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      setAccessDeniedReason(null);
      const data = await fetchAuthorizedLessons(courseId);
      setCourse(data.course);
      setLessons(data.lessons);
      setProgress(data.progress);

      if (requestedLessonId && data.lessons.some((l) => l.id === requestedLessonId)) {
        setCurrentLessonId(requestedLessonId);
      } else if (
        data.progress.nextLessonId &&
        data.lessons.some((l) => l.id === data.progress.nextLessonId)
      ) {
        setCurrentLessonId(data.progress.nextLessonId);
      } else {
        setCurrentLessonId(data.lessons[0]?.id ?? null);
      }
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'You are not authorized to access this course.';
      setAccessDeniedReason(reason);
      // Try fetching public course summary so we can show helpful context
      try {
        const pub = await fetchCourseDetails(courseId);
        setCourse(pub.course);
      } catch {
        // Ignore if course doesn't exist
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, requestedLessonId]);

  useEffect(() => {
    if (!authLoading) {
      void loadAuthorizedWorkspace();
    }
  }, [authLoading, loadAuthorizedWorkspace, user]);

  const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
  const currentLesson = currentIndex >= 0 ? lessons[currentIndex] : lessons[0] ?? null;
  const previousLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  const isCurrentCompleted =
    currentLesson && progress
      ? progress.completedLessonIds.includes(currentLesson.id)
      : false;

  const handleSelectLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setIsPlayingLesson(false);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setMobileCurriculumOpen(false);
    router.replace(`/learn/${encodeURIComponent(courseId)}?lesson=${encodeURIComponent(lessonId)}`, {
      scroll: false,
    });
  };

  const formatVideoTime = (secs: number): string => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const total = Math.floor(secs);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const rem = total % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${mins}:${String(rem).padStart(2, '0')}`;
  };

  const handleSeekStart = () => {
    isDraggingSeekRef.current = true;
    setIsDraggingSeek(true);
    if (seekUnlockTimerRef.current) {
      clearTimeout(seekUnlockTimerRef.current);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);
    sendPlayerCommand('seekTo', [targetTime, true]);
  };

  const handleSeekEnd = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const targetTime = Number((e.currentTarget as HTMLInputElement).value);
    setCurrentTime(targetTime);
    sendPlayerCommand('seekTo', [targetTime, true]);
    if (seekUnlockTimerRef.current) {
      clearTimeout(seekUnlockTimerRef.current);
    }
    seekUnlockTimerRef.current = setTimeout(() => {
      isDraggingSeekRef.current = false;
      setIsDraggingSeek(false);
    }, 450);
  };

  const handleTogglePlayPause = () => {
    if (!isPlayingLesson) {
      setIsPlayingLesson(true);
      setIsPaused(false);
      return;
    }
    if (isPaused) {
      sendPlayerCommand('playVideo');
      setIsPaused(false);
    } else {
      sendPlayerCommand('pauseVideo');
      setIsPaused(true);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted) {
      sendPlayerCommand('unMute');
      setIsMuted(false);
    } else {
      sendPlayerCommand('mute');
      setIsMuted(true);
    }
  };

  const handleChangeSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    sendPlayerCommand('setPlaybackRate', [nextSpeed]);
  };

  const handleToggleCaptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    if (next) {
      sendPlayerCommand('loadModule', ['captions']);
      sendPlayerCommand('setOption', ['captions', 'track', { languageCode: 'en' }]);
    } else {
      sendPlayerCommand('unloadModule', ['captions']);
    }
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = playerContainerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  };

  const handleToggleComplete = async () => {
    if (!currentLesson || !course) return;
    const nextState = !isCurrentCompleted;
    try {
      setTogglingComplete(true);
      const { summary } = await toggleLessonCompletion({
        courseId: course.id,
        lessonId: currentLesson.id,
        isCompleted: nextState,
      });
      setProgress(summary);
      await refreshUserData();
      notify(
        nextState ? 'Lesson marked as completed!' : 'Lesson marked as incomplete.',
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update progress.', 'error');
    } finally {
      setTogglingComplete(false);
    }
  };

  const handleQuickFreeEnroll = async () => {
    if (!user) {
      router.push(`/login?redirect=/learn/${encodeURIComponent(courseId)}`);
      return;
    }
    try {
      setEnrollingFree(true);
      await enrollInCourse(courseId);
      await refreshUserData();
      await loadAuthorizedWorkspace();
      notify('Enrolled in free course! Loading lessons...', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Enrollment failed.', 'error');
    } finally {
      setEnrollingFree(false);
    }
  };

  if (loading || authLoading) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl border border-slate-200 h-[520px] animate-pulse p-8" />
      </main>
    );
  }

  /* Access Denied / Enrollment Required State */
  if (accessDeniedReason) {
    return (
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-slate-700" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-indigo-600">Course Access Verification</p>
            <h1 className="text-xl font-bold text-slate-900">
              {course ? course.title : 'Lesson Access Restricted'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">{accessDeniedReason}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!user ? (
              <Link
                href={`/login?redirect=/courses/${encodeURIComponent(courseId)}`}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Log In to Continue
              </Link>
            ) : course?.courseType === 'free' ? (
              <button
                type="button"
                disabled={enrollingFree}
                onClick={handleQuickFreeEnroll}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {enrollingFree ? 'Enrolling...' : 'Enroll Now for Free'}
              </button>
            ) : null}

            <Link
              href={`/courses/${encodeURIComponent(courseId)}`}
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              View Course Details
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
      {/* Top Context Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
        <div className="space-y-1 min-w-0">
          <Link
            href={`/courses/${course?.id || ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Course Overview</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
            {course?.title}
          </h1>
        </div>

        {progress && (
          <div className="flex items-center gap-4 shrink-0 bg-white border border-slate-200 rounded-lg px-4 py-2.5 tabular-nums">
            <div className="text-xs">
              <span className="text-slate-500">Completed: </span>
              <span className="font-semibold text-slate-900">
                {progress.completedCount} / {progress.totalPublishedLessons} ({progress.percentage}%)
              </span>
            </div>
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-transform origin-left"
                style={{
                  transform: `scaleX(${Math.max(0, Math.min(100, progress.percentage)) / 100})`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Collapsible Curriculum Toggle */}
      <div className="lg:hidden mb-6">
        <button
          type="button"
          onClick={() => setMobileCurriculumOpen((prev) => !prev)}
          aria-expanded={mobileCurriculumOpen}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
        >
          <span>
            Course Curriculum ({lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'})
          </span>
          {mobileCurriculumOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {mobileCurriculumOpen && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {lessons.map((lesson, idx) => {
              const active = currentLesson?.id === lesson.id;
              const completed = progress?.completedLessonIds.includes(lesson.id) ?? false;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => handleSelectLesson(lesson.id)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                    active ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">
                    {String(idx + 1).padStart(2, '0')}. {lesson.title}
                  </span>
                  {completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lessons.length === 0 || !currentLesson ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <PlayCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-semibold text-slate-900">No Published Lessons Available</h2>
          <p className="text-sm text-slate-600">
            This course does not currently have any published lessons.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Embedded YouTube Player & Controls */}
          <div className="lg:col-span-8 space-y-6">
            <div
              ref={playerContainerRef}
              onContextMenu={(e) => e.preventDefault()}
              className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-xs aspect-video w-full select-none"
            >

              {!isPlayingLesson ? (
                /* Custom DIU EduTech Cover Screen — hides initial YouTube title, channel icon, red play button & Watch on YouTube badge */
                <div className="absolute inset-0 z-[110] flex flex-col justify-between p-6 sm:p-8 bg-slate-950 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400">
                      <span>DIU EduTech</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Lesson {currentIndex + 1} of {lessons.length}
                      </span>
                    </span>
                    <span className="text-xs font-mono text-slate-400 truncate max-w-xs">
                      {course?.title}
                    </span>
                  </div>

                  <div className="my-auto flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlayingLesson(true);
                        setIsPaused(false);
                      }}
                      aria-label={`Play lesson: ${currentLesson.title}`}
                      className="group inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-transform hover:scale-105 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <PlayCircle className="w-9 h-9 sm:w-10 sm:h-10" />
                    </button>
                    <div className="space-y-1">
                      <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">
                        {currentLesson.title}
                      </h2>
                      <p className="text-xs text-slate-400">
                        Click play to stream this lesson inside DIU EduTech
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
                    <span>Protected Course Stream</span>
                    <span>
                      {isCurrentCompleted ? 'Status: Completed' : 'Status: In Progress'}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Granular Corner Transparent Overlays (z-[100]): Specifically target and disable the YouTube title/channel link, Share button, 'Watch on YouTube' link, and YouTube logo in the iframe corners */}
                  {/* Top-Left Corner Overlay: Disables YouTube channel avatar & title link */}
                  <div
                    aria-hidden="true"
                    data-testid="yt-corner-overlay-top-left"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute top-0 left-0 w-72 sm:w-80 h-20 z-[100] bg-transparent pointer-events-auto cursor-default select-none"
                  />

                  {/* Top-Right Corner Overlay: Disables YouTube Share & Watch Later buttons */}
                  <div
                    aria-hidden="true"
                    data-testid="yt-corner-overlay-top-right"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute top-0 right-0 w-48 sm:w-56 h-20 z-[100] bg-transparent pointer-events-auto cursor-default select-none"
                  />

                  {/* Bottom-Left Corner Overlay: Disables 'Watch on YouTube' link/badge */}
                  <div
                    aria-hidden="true"
                    data-testid="yt-corner-overlay-bottom-left"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute bottom-0 left-0 w-60 sm:w-72 h-28 z-[100] bg-transparent pointer-events-auto cursor-default select-none"
                  />

                  {/* Bottom-Right Corner Overlay: Disables YouTube logo & watermark */}
                  <div
                    aria-hidden="true"
                    data-testid="yt-corner-overlay-bottom-right"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute bottom-0 right-0 w-44 sm:w-52 h-28 z-[100] bg-transparent pointer-events-auto cursor-default select-none"
                  />

                  {/* Top Full-Width Shield: Covers the entire YouTube title bar and blocks the top-right Volume/CC/Settings buttons */}
                  <div
                    aria-hidden="true"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute top-0 left-0 right-0 h-[44px] z-[110] bg-slate-950 px-4 flex items-center justify-between pointer-events-auto cursor-default select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-indigo-400 shrink-0">
                        DIU EduTech
                      </span>
                      <span className="text-slate-600 text-[11px]" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-[11px] font-medium text-slate-200 truncate">
                        Lesson {currentIndex + 1}: {currentLesson.title}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Platform Control Bar: Covers native YouTube bottom area while providing custom Play/Pause, Seek Slider, Speed, Subtitles, Mute & Fullscreen */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-0 left-0 right-0 h-[52px] z-[110] bg-slate-950 border-t border-slate-900 px-4 flex items-center justify-between gap-3 pointer-events-auto"
                  >
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleTogglePlayPause}
                        aria-label={isPaused ? 'Play video' : 'Pause video'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors cursor-pointer"
                      >
                        {isPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Play</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleMute}
                        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                        className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-red-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Interactive Custom Video Seek Bar (front/back scrubbing to any timestamp) */}
                    <div className="flex-1 flex items-center gap-2.5 min-w-0 px-1">
                      <span className="text-[11px] font-mono text-slate-300 tabular-nums shrink-0">
                        {formatVideoTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={duration > 0 ? Math.ceil(duration) : 5400}
                        step={1}
                        value={Math.min(currentTime, duration > 0 ? Math.ceil(duration) : 5400)}
                        onMouseDown={handleSeekStart}
                        onTouchStart={handleSeekStart}
                        onPointerDown={handleSeekStart}
                        onChange={handleSeekChange}
                        onMouseUp={handleSeekEnd}
                        onTouchEnd={handleSeekEnd}
                        onPointerUp={handleSeekEnd}
                        onKeyUp={handleSeekEnd}
                        aria-label="Seek video timeline"
                        className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 ${
                          isDraggingSeek ? 'ring-1 ring-indigo-400' : ''
                        }`}
                      />
                      {duration > 0 && (
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0 hidden sm:inline">
                          {formatVideoTime(duration)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleCaptions}
                        aria-label="Toggle subtitles"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          captionsEnabled
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Captions className="w-3.5 h-3.5" />
                        <span>CC</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleChangeSpeed}
                        aria-label="Change playback speed"
                        className="px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer tabular-nums"
                      >
                        {playbackSpeed}x Speed
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleFullscreen}
                        aria-label="Toggle fullscreen"
                        className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              <iframe
                ref={iframeRef}
                onLoad={() => {
                  registerIframeListeners();
                  setTimeout(registerIframeListeners, 800);
                }}
                key={`${currentLesson.youtubeVideoId}_${isPlayingLesson ? 'play' : 'idle'}`}
                src={buildYouTubeEmbedUrl(currentLesson.youtubeVideoId, {
                  autoplay: isPlayingLesson,
                  cc: captionsEnabled,
                })}
                title={currentLesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                tabIndex={-1}
                className="w-full h-full border-0 select-none"
              />
            </div>

            {/* Lesson Title, Complete Toggle & Prev/Next Controls */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-indigo-600 tabular-nums">
                    Lesson {currentIndex + 1} of {lessons.length}
                    {!currentLesson.isPublished ? ' · Draft Preview' : ''}
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">{currentLesson.title}</h2>
                </div>

                <button
                  type="button"
                  disabled={togglingComplete}
                  onClick={handleToggleComplete}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrentCompleted
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {togglingComplete
                      ? 'Updating...'
                      : isCurrentCompleted
                      ? 'Completed'
                      : 'Mark as Complete'}
                  </span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={!previousLesson}
                  onClick={() => previousLesson && handleSelectLesson(previousLesson.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous Lesson</span>
                </button>

                <button
                  type="button"
                  disabled={!nextLesson}
                  onClick={() => nextLesson && handleSelectLesson(nextLesson.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span>Next Lesson</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Desktop Lesson Curriculum Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-24">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Lesson Curriculum</h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'}
              </span>
            </div>

            <ol className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {lessons.map((lesson, idx) => {
                const isActive = currentLesson.id === lesson.id;
                const isCompleted = progress?.completedLessonIds.includes(lesson.id) ?? false;

                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectLesson(lesson.id)}
                      className={`w-full text-left px-5 py-3.5 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                        isActive ? 'bg-indigo-50/90' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`font-mono text-xs font-semibold mt-0.5 tabular-nums ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-xs sm:text-sm leading-snug ${
                              isActive
                                ? 'font-semibold text-indigo-950'
                                : 'font-medium text-slate-800'
                            }`}
                          >
                            {lesson.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {isActive ? 'Currently Playing' : `Lesson #${lesson.lessonOrder}`}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 mt-0.5">
                        {isCompleted ? (
                          <CheckCircle2
                            aria-label="Completed"
                            className="w-4 h-4 text-emerald-600"
                          />
                        ) : (
                          <Circle aria-label="Not completed" className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      )}
    </main>
  );
}

export default function CourseLearningPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <Suspense
        fallback={
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
          </main>
        }
      >
        <CourseLearningContent />
      </Suspense>
      <Footer />
    </div>
  );
}
