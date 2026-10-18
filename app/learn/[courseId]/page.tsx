'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Lock,
  Maximize2,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  RotateCw,
  Settings,
  Volume1,
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
  buildYouTubeQualityCommands,
  clampVolume,
  computeSeekOffset,
  getQualityShortLabel,
  getQualityTargetDimensions,
  YOUTUBE_QUALITY_OPTIONS,
  type Course,
  type CourseProgressSummary,
  type Lesson,
  type VideoQualityCode,
} from '@/lib/lms-logic';

interface YTPlayerInstance {
  setSize?: (width: number, height: number) => void;
  setPlaybackQualityRange?: (minQuality: string, maxQuality?: string) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
  loadVideoById?: (opts: {
    videoId: string;
    startSeconds?: number;
    suggestedQuality?: string;
  }) => void;
  cueVideoById?: (opts: {
    videoId: string;
    startSeconds?: number;
    suggestedQuality?: string;
  }) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player?: new (
        element: HTMLIFrameElement | string,
        options?: {
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onPlaybackQualityChange?: (event: { data: string }) => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

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
  const [justMarkedComplete, setJustMarkedComplete] = useState(false);
  const [enrollingFree, setEnrollingFree] = useState(false);
  const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);
  const [isPlayingLesson, setIsPlayingLesson] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState<number>(100);
  const [previousVolume, setPreviousVolume] = useState<number>(100);
  const [volumeInputText, setVolumeInputText] = useState<string>('100');
  const [videoQuality, setVideoQuality] = useState<VideoQualityCode>('hd1080');
  const [initialStreamQuality, setInitialStreamQuality] = useState<VideoQualityCode>('hd1080');
  const [qualityMenuOpen, setQualityMenuOpen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState<boolean>(false);
  const [hudFeedback, setHudFeedback] = useState<string | null>(null);
  const [hudFeedbackKey, setHudFeedbackKey] = useState<number>(0);
  const [hostOrigin, setHostOrigin] = useState<string>('');
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number }>({
    width: 854,
    height: 480,
  });

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSeekRef = useRef<boolean>(false);
  const seekUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQualityEnforceTimeRef = useRef<number>(0);

  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const isPlayingLessonRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const volumeRef = useRef<number>(100);
  const isMutedRef = useRef<boolean>(false);
  const videoQualityRef = useRef<VideoQualityCode>('hd1080');
  const playbackSpeedRef = useRef<number>(1);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    isPlayingLessonRef.current = isPlayingLesson;
  }, [isPlayingLesson]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    videoQualityRef.current = videoQuality;
  }, [videoQuality]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const el = playerContainerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPlayerSize((prev) =>
          Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
            ? prev
            : { width: rect.width, height: rect.height }
        );
      }
    };

    updateDimensions();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateDimensions();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [loading, accessDeniedReason, currentLessonId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostOrigin(window.location.origin);
      if (!document.getElementById('youtube-iframe-js-api')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-js-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, []);

  const showHudFeedback = useCallback((label: string) => {
    setHudFeedback(label);
    setHudFeedbackKey((prev) => prev + 1);
    if (hudTimerRef.current) {
      clearTimeout(hudTimerRef.current);
    }
    hudTimerRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 900);
  }, []);

  const sendPlayerCommand = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }),
      '*'
    );
  }, []);

  const enforceVideoQuality = useCallback(
    (
      q: VideoQualityCode,
      options?: {
        videoId?: string;
        startSeconds?: number;
        reloadStream?: boolean;
        isPaused?: boolean;
        force?: boolean;
      }
    ) => {
      const now = Date.now();
      if (!options?.force && !options?.reloadStream && now - lastQualityEnforceTimeRef.current < 2500) {
        return;
      }
      lastQualityEnforceTimeRef.current = now;

      const commands = buildYouTubeQualityCommands(q, options);
      for (const cmd of commands) {
        sendPlayerCommand(cmd.func, cmd.args);
      }

      const player = ytPlayerRef.current;
      if (player && ytPlayerReadyRef.current) {
        const dims = getQualityTargetDimensions(q);
        const effectiveQ = q === 'default' ? 'hd1080' : q;
        try {
          player.setSize?.(dims.width, dims.height);
          if (q === 'default') {
            player.setPlaybackQualityRange?.('hd720', 'hd1080');
          } else {
            player.setPlaybackQualityRange?.(effectiveQ, effectiveQ);
          }
          player.setPlaybackQuality?.(effectiveQ);
        } catch {
          // Ignore if player proxy is still initializing
        }
      }
    },
    [sendPlayerCommand]
  );

  const syncPlayerPreferences = useCallback(
    (forceQuality = false) => {
      const targetVol = isMutedRef.current ? 0 : volumeRef.current;
      sendPlayerCommand('setVolume', [targetVol]);
      if (isMutedRef.current || targetVol === 0) {
        sendPlayerCommand('mute');
      } else {
        sendPlayerCommand('unMute');
      }
      sendPlayerCommand('setPlaybackRate', [playbackSpeedRef.current]);
      enforceVideoQuality(videoQualityRef.current, { force: forceQuality });
    },
    [enforceVideoQuality, sendPlayerCommand]
  );

  const registerIframeListeners = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    const events = ['onReady', 'onStateChange', 'onPlaybackQualityChange'];
    for (const evt of events) {
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'addEventListener',
          args: [evt],
          id: 1,
          channel: 'widget',
        }),
        '*'
      );
    }

    if (iframeRef.current && window.YT?.Player && !ytPlayerRef.current) {
      try {
        ytPlayerReadyRef.current = false;
        ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              ytPlayerReadyRef.current = true;
              syncPlayerPreferences(true);
            },
            onStateChange: (evt) => {
              if (evt.data === 1 || evt.data === 3 || evt.data === 5) {
                enforceVideoQuality(videoQualityRef.current);
              }
            },
            onPlaybackQualityChange: (evt) => {
              const targetQ = videoQualityRef.current;
              if (targetQ !== 'default' && evt.data && evt.data !== targetQ) {
                enforceVideoQuality(targetQ);
              }
            },
          },
        });
      } catch {
        // Fallback to postMessage widget bridge
      }
    }
  }, [enforceVideoQuality, syncPlayerPreferences]);

  useEffect(() => {
    if (!isPlayingLesson) return;
    const interval = setInterval(() => {
      registerIframeListeners();
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlayingLesson, registerIframeListeners]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data) as {
          event?: string;
          info?:
            | number
            | string
            | {
                currentTime?: number;
                duration?: number;
                playerState?: number;
                playbackQuality?: string;
                availableQualityLevels?: string[];
              };
        };
        if (data.event === 'onReady') {
          syncPlayerPreferences(true);
        }
        if (data.event === 'onStateChange') {
          if (data.info === 1 || data.info === 3 || data.info === 5 || data.info === -1) {
            enforceVideoQuality(videoQualityRef.current);
          }
        }
        if (data.event === 'onPlaybackQualityChange' && typeof data.info === 'string') {
          const targetQ = videoQualityRef.current;
          if (targetQ !== 'default' && data.info !== targetQ) {
            enforceVideoQuality(targetQ);
          }
        }
        if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
          if (typeof data.info.currentTime === 'number' && !isDraggingSeekRef.current) {
            currentTimeRef.current = data.info.currentTime;
            setCurrentTime(data.info.currentTime);
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            durationRef.current = data.info.duration;
            setDuration(data.info.duration);
          }
          if (data.info.playerState === 1) {
            setIsPaused(false);
          } else if (data.info.playerState === 2) {
            setIsPaused(true);
          }
          if (
            typeof data.info.playbackQuality === 'string' &&
            videoQualityRef.current !== 'default' &&
            data.info.playbackQuality !== videoQualityRef.current
          ) {
            enforceVideoQuality(videoQualityRef.current);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enforceVideoQuality, syncPlayerPreferences]);

  useEffect(() => {
    if (!qualityMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        qualityMenuRef.current &&
        !qualityMenuRef.current.contains(event.target as Node)
      ) {
        setQualityMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [qualityMenuOpen]);

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

  const formatVideoTime = useCallback((secs: number): string => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const total = Math.floor(secs);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const rem = total % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${mins}:${String(rem).padStart(2, '0')}`;
  }, []);

  const handleSeekStart = () => {
    isDraggingSeekRef.current = true;
    setIsDraggingSeek(true);
    if (seekUnlockTimerRef.current) {
      clearTimeout(seekUnlockTimerRef.current);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    currentTimeRef.current = targetTime;
    setCurrentTime(targetTime);
    sendPlayerCommand('seekTo', [targetTime, true]);
  };

  const handleSeekEnd = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const targetTime = Number((e.currentTarget as HTMLInputElement).value);
    currentTimeRef.current = targetTime;
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

  const seekByDeltaSeconds = useCallback(
    (deltaSeconds: number) => {
      if (!isPlayingLessonRef.current) {
        setIsPlayingLesson(true);
        setIsPaused(false);
      }
      const nextTime = computeSeekOffset(
        currentTimeRef.current,
        deltaSeconds,
        durationRef.current
      );
      isDraggingSeekRef.current = true;
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      sendPlayerCommand('seekTo', [nextTime, true]);

      if (seekUnlockTimerRef.current) {
        clearTimeout(seekUnlockTimerRef.current);
      }
      seekUnlockTimerRef.current = setTimeout(() => {
        isDraggingSeekRef.current = false;
        setIsDraggingSeek(false);
      }, 550);

      const prefix = deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`;
      showHudFeedback(`${prefix} · ${formatVideoTime(nextTime)}`);
    },
    [formatVideoTime, sendPlayerCommand, showHudFeedback]
  );

  const handleTogglePlayPause = useCallback(() => {
    if (!isPlayingLessonRef.current) {
      setIsPlayingLesson(true);
      setIsPaused(false);
      showHudFeedback('Playing');
      return;
    }
    if (isPausedRef.current) {
      sendPlayerCommand('playVideo');
      setIsPaused(false);
      showHudFeedback('Playing');
    } else {
      sendPlayerCommand('pauseVideo');
      setIsPaused(true);
      showHudFeedback('Paused');
    }
  }, [sendPlayerCommand, showHudFeedback]);

  useEffect(() => {
    if (loading || authLoading || accessDeniedReason || !currentLesson) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) {
          return;
        }
        if (tagName === 'INPUT') {
          const inputType = (target as HTMLInputElement).type.toLowerCase();
          // Allow typing numbers or text in manual inputs (e.g. volume number box) without triggering video shortcuts
          if (inputType !== 'range') {
            return;
          }
        }
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePlayPause();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        seekByDeltaSeconds(10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        seekByDeltaSeconds(-10);
      } else if (e.key === 'Escape' && qualityMenuOpen) {
        setQualityMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    accessDeniedReason,
    authLoading,
    currentLesson,
    handleTogglePlayPause,
    loading,
    qualityMenuOpen,
    seekByDeltaSeconds,
  ]);

  const applyVolumeValue = useCallback(
    (rawValue: unknown, updateText = true) => {
      const nextVol = clampVolume(rawValue, volumeRef.current);
      setVolume(nextVol);
      volumeRef.current = nextVol;
      if (updateText) {
        setVolumeInputText(String(nextVol));
      }
      sendPlayerCommand('setVolume', [nextVol]);
      if (nextVol === 0) {
        setIsMuted(true);
        isMutedRef.current = true;
        sendPlayerCommand('mute');
        showHudFeedback('Muted (0%)');
      } else {
        setPreviousVolume(nextVol);
        if (isMutedRef.current) {
          setIsMuted(false);
          isMutedRef.current = false;
          sendPlayerCommand('unMute');
        }
        showHudFeedback(`Volume ${nextVol}%`);
      }
    },
    [sendPlayerCommand, showHudFeedback]
  );

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted || volume === 0) {
      const restored = previousVolume > 0 ? previousVolume : 100;
      setIsMuted(false);
      isMutedRef.current = false;
      setVolume(restored);
      volumeRef.current = restored;
      setVolumeInputText(String(restored));
      sendPlayerCommand('unMute');
      sendPlayerCommand('setVolume', [restored]);
      showHudFeedback(`Volume ${restored}%`);
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
      isMutedRef.current = true;
      setVolume(0);
      volumeRef.current = 0;
      setVolumeInputText('0');
      sendPlayerCommand('mute');
      sendPlayerCommand('setVolume', [0]);
      showHudFeedback('Muted (0%)');
    }
  };

  const handleVolumeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    applyVolumeValue(e.target.value, true);
  };

  const handleVolumeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const raw = e.target.value;
    setVolumeInputText(raw);
    if (raw.trim() === '') return;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const clamped = clampVolume(numeric, volumeRef.current);
      applyVolumeValue(clamped, false);
    }
  };

  const handleVolumeInputBlur = () => {
    if (volumeInputText.trim() === '') {
      setVolumeInputText(String(isMuted ? 0 : volume));
      return;
    }
    applyVolumeValue(volumeInputText, true);
  };

  const handleSelectQuality = (code: VideoQualityCode) => {
    setVideoQuality(code);
    videoQualityRef.current = code;
    setQualityMenuOpen(false);
    if (!isPlayingLessonRef.current) {
      setInitialStreamQuality(code);
      enforceVideoQuality(code, { force: true });
    } else {
      const resumeAt = currentTimeRef.current;
      enforceVideoQuality(code, {
        videoId: currentLesson?.youtubeVideoId,
        startSeconds: resumeAt,
        reloadStream: true,
        isPaused: isPausedRef.current,
        force: true,
      });
      setTimeout(() => {
        enforceVideoQuality(code, { force: true });
      }, 350);
    }
    const label = getQualityShortLabel(code);
    showHudFeedback(`Quality: ${label}`);
  };

  const handleChangeSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    sendPlayerCommand('setPlaybackRate', [nextSpeed]);
    showHudFeedback(`Speed: ${nextSpeed}x`);
  };

  const handleToggleCaptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    if (next) {
      sendPlayerCommand('loadModule', ['captions']);
      sendPlayerCommand('setOption', ['captions', 'track', { languageCode: 'en' }]);
      showHudFeedback('Subtitles On');
    } else {
      sendPlayerCommand('unloadModule', ['captions']);
      showHudFeedback('Subtitles Off');
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
      if (nextState) {
        setJustMarkedComplete(true);
        setTimeout(() => setJustMarkedComplete(false), 1400);
      }
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

                  {/* On-Screen HUD Feedback Badge for Keyboard Shortcuts / Quality / Volume with Subtle Fade-In & Fade-Out */}
                  <AnimatePresence mode="wait">
                    {hudFeedback && (
                      <motion.div
                        key={hudFeedbackKey}
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        aria-live="polite"
                        data-testid="player-hud-feedback"
                        className="absolute top-14 left-1/2 -translate-x-1/2 z-[125] px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-semibold text-white shadow-lg pointer-events-none"
                      >
                        {hudFeedback}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bottom Platform Control Bar: Covers native YouTube bottom area while providing custom Play/Pause, ±10s Seek, Measurable Volume (0-100%), Seek Slider, Quality Switcher, Speed, Subtitles & Fullscreen */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-0 left-0 right-0 min-h-[54px] z-[110] bg-slate-950 border-t border-slate-900 px-3 sm:px-4 py-1.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-2.5 pointer-events-auto"
                  >
                    {/* Left Control Group: Play/Pause, -10s/+10s, Mute & Manual Measurable Volume (0-100%) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleTogglePlayPause}
                        aria-label={isPaused ? 'Play video' : 'Pause video'}
                        title="Play / Pause (Space)"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors cursor-pointer"
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
                        onClick={() => seekByDeltaSeconds(-10)}
                        aria-label="Rewind 10 seconds"
                        title="Backward 10s (Left Arrow)"
                        className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-1 text-[11px] font-mono font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>10s</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => seekByDeltaSeconds(10)}
                        aria-label="Forward 10 seconds"
                        title="Forward 10s (Right Arrow)"
                        className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-1 text-[11px] font-mono font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>10s</span>
                      </button>

                      {/* Measurable Volume Control Group: Mute Toggle + Slider + Direct 0-100% Input */}
                      <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md px-1.5 py-1">
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          aria-label={isMuted || volume === 0 ? 'Unmute audio' : 'Mute audio'}
                          title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                          className="p-0.5 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-3.5 h-3.5 text-red-400" />
                          ) : volume < 50 ? (
                            <Volume1 className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                        </button>

                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeSliderChange}
                          aria-label="Volume slider"
                          className="hidden sm:block w-14 md:w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />

                        <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded px-1 py-0.5">
                          <input
                            id="player-volume-input"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={isMuted ? '0' : volumeInputText}
                            onChange={handleVolumeInputChange}
                            onBlur={handleVolumeInputBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            aria-label="Manual volume percentage"
                            className="w-7 text-right text-[11px] font-mono font-semibold text-white bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[10px] font-mono text-slate-400 select-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Custom Video Seek Bar (front/back scrubbing to any timestamp) */}
                    <div className="w-full sm:w-auto sm:flex-1 order-first sm:order-none flex items-center gap-2 min-w-0 px-0.5">
                      <span
                        data-testid="player-current-time"
                        className="text-[11px] font-mono text-slate-300 tabular-nums shrink-0"
                      >
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
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0 hidden md:inline">
                          {formatVideoTime(duration)}
                        </span>
                      )}
                    </div>

                    {/* Right Control Group: Subtitles, Video Quality Switcher, Playback Speed & Fullscreen */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleCaptions}
                        aria-label="Toggle subtitles"
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          captionsEnabled
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Captions className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">CC</span>
                      </button>

                      {/* Video Quality Selector Popover */}
                      <div ref={qualityMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQualityMenuOpen((prev) => !prev);
                          }}
                          aria-label="Video quality"
                          aria-expanded={qualityMenuOpen}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors cursor-pointer tabular-nums ${
                            qualityMenuOpen
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <Settings className="w-3 h-3 text-indigo-400" />
                          <span>{getQualityShortLabel(videoQuality)}</span>
                        </button>

                        {qualityMenuOpen && (
                          <div
                            role="menu"
                            aria-label="Select video quality"
                            className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1.5 z-[130]"
                          >
                            <div className="px-3 py-1 border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Video Quality
                            </div>
                            {YOUTUBE_QUALITY_OPTIONS.map((option) => {
                              const active = videoQuality === option.code;
                              return (
                                <button
                                  key={option.code}
                                  type="button"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectQuality(option.code);
                                  }}
                                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                                      : 'text-slate-200 hover:bg-slate-800'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span>{option.label}</span>
                                    {option.badge && (
                                      <span className="px-1 py-0.2 text-[9px] font-bold bg-indigo-500/30 text-indigo-300 rounded">
                                        {option.badge}
                                      </span>
                                    )}
                                  </span>
                                  {active && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleChangeSpeed}
                        aria-label="Change playback speed"
                        className="px-2 py-1 text-[11px] font-mono font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer tabular-nums"
                      >
                        {playbackSpeed}x
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

              {(() => {
                const targetDims = getQualityTargetDimensions(videoQuality);
                const containerW = playerSize.width > 0 ? playerSize.width : 854;
                const containerH = playerSize.height > 0 ? playerSize.height : 480;
                return (
                  <div className="absolute inset-0 overflow-hidden">
                    <iframe
                      ref={iframeRef}
                      width={targetDims.width}
                      height={targetDims.height}
                      data-selected-quality={videoQuality}
                      data-target-resolution={`${targetDims.width}x${targetDims.height}`}
                      onLoad={() => {
                        ytPlayerRef.current = null;
                        ytPlayerReadyRef.current = false;
                        registerIframeListeners();
                        syncPlayerPreferences(true);
                        setTimeout(() => {
                          registerIframeListeners();
                          syncPlayerPreferences(true);
                        }, 450);
                      }}
                      key={`${currentLesson.youtubeVideoId}_${isPlayingLesson ? 'play' : 'idle'}`}
                      src={buildYouTubeEmbedUrl(currentLesson.youtubeVideoId, {
                        autoplay: isPlayingLesson,
                        vq: initialStreamQuality,
                        origin: hostOrigin,
                      })}
                      title={currentLesson.title}
                      allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      tabIndex={-1}
                      style={{
                        width: `${targetDims.width}px`,
                        height: `${targetDims.height}px`,
                        transform: `scale(${containerW / targetDims.width}, ${containerH / targetDims.height})`,
                        transformOrigin: 'top left',
                      }}
                      className="border-0 select-none block"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Keyboard Shortcuts & Playout Controls Helper Bar */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 border border-slate-300 rounded text-slate-800">
                    Space
                  </kbd>
                  <span>Play / Pause</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 border border-slate-300 rounded text-slate-800">
                    ←
                  </kbd>
                  <span>-10s Backward</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 border border-slate-300 rounded text-slate-800">
                    →
                  </kbd>
                  <span>+10s Forward</span>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 tabular-nums">
                <span>Volume: {isMuted ? 0 : volume}%</span>
                <span>·</span>
                <span>Quality: {getQualityShortLabel(videoQuality)}</span>
              </div>
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

                <motion.button
                  type="button"
                  disabled={togglingComplete}
                  onClick={handleToggleComplete}
                  animate={{
                    scale: justMarkedComplete ? [1, 1.05, 1] : 1,
                    backgroundColor: justMarkedComplete
                      ? '#059669'
                      : isCurrentCompleted
                      ? '#ecfdf5'
                      : '#4f46e5',
                    color: justMarkedComplete
                      ? '#ffffff'
                      : isCurrentCompleted
                      ? '#065f46'
                      : '#ffffff',
                    borderColor: justMarkedComplete
                      ? '#059669'
                      : isCurrentCompleted
                      ? '#a7f3d0'
                      : 'transparent',
                  }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-indigo-600 transition-shadow ${
                    isCurrentCompleted && !justMarkedComplete
                      ? 'hover:bg-emerald-100'
                      : !isCurrentCompleted && !justMarkedComplete
                      ? 'hover:bg-indigo-700'
                      : ''
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isCurrentCompleted ? (
                      <motion.span
                        key="icon-completed"
                        initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="inline-flex items-center justify-center"
                      >
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            justMarkedComplete ? 'text-white' : 'text-emerald-700'
                          }`}
                        />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="icon-uncompleted"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white/90" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={
                        togglingComplete
                          ? 'updating'
                          : justMarkedComplete
                          ? 'done-flash'
                          : isCurrentCompleted
                          ? 'completed'
                          : 'mark'
                      }
                      initial={{ y: 3, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -3, opacity: 0 }}
                      transition={{ duration: 0.16 }}
                    >
                      {togglingComplete
                        ? 'Updating...'
                        : justMarkedComplete
                        ? 'Completed! 🎉'
                        : isCurrentCompleted
                        ? 'Completed'
                        : 'Mark as Complete'}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
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
