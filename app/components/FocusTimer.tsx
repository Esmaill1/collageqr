"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const SESSION_MS = 20 * 60 * 1000;
const GRACE_MS = 10 * 1000;

type Phase = "idle" | "running" | "left" | "paused" | "completed" | "error";

interface StoredSession {
  sessionToken: string;
  virtualStart: number;
}

interface CompleteResponse {
  ok: boolean;
  signingToken: string;
  desk: {
    id: string;
    totalMinutes: number;
    level: number;
    levelLabel: string;
  };
}

interface StartResponse {
  ok: boolean;
  sessionToken: string;
  sessionId: string;
  startedAt: number;
  durationMs: number;
}

interface WakeLockSentinel {
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}
type NavWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

function formatClock(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  dashOffset,
  center,
  ariaLabel,
  pulse = false,
  ringDim = false,
  clockDim = false,
}: {
  dashOffset: number;
  center: string;
  ariaLabel: string;
  pulse?: boolean;
  ringDim?: boolean;
  clockDim?: boolean;
}) {
  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={ariaLabel}
      className="relative flex items-center justify-center"
      style={{ width: 200, height: 200 }}
    >
      <svg
        viewBox="0 0 200 200"
        width={200}
        height={200}
        style={{
          opacity: ringDim ? 0.3 : 1,
          transition: "opacity var(--transition-base)",
        }}
      >
        <circle
          cx="100"
          cy="100"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--grid-line)"
          strokeWidth="10"
        />
        <circle
          cx="100"
          cy="100"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 100 100)"
          className={pulse ? "pulse-soft" : undefined}
        />
      </svg>
      <span
        className="absolute font-semibold tabular-nums"
        style={{
          fontSize: "var(--text-3xl)",
          color: clockDim ? "var(--ink-muted)" : "var(--ink)",
          transition: "color var(--transition-base)",
        }}
      >
        {center}
      </span>
    </div>
  );
}

export default function FocusTimer({
  deskId,
  onSessionComplete,
}: {
  deskId: string;
  onSessionComplete: (signingToken: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingMs, setRemainingMs] = useState(SESSION_MS);
  const [graceLeftMs, setGraceLeftMs] = useState<number | null>(null);
  const [errorHint, setErrorHint] = useState("");
  const [canRetry, setCanRetry] = useState(false);

  const sessionRef = useRef<StoredSession | null>(null);
  const graceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRemainingRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const completingRef = useRef<boolean>(false);
  const startingRef = useRef<boolean>(false);

  const storageKey = `desklore:focus:${deskId}`;

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const persistSession = useCallback(
    (session: StoredSession | null) => {
      try {
        if (session) {
          localStorage.setItem(storageKey, JSON.stringify(session));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        /* storage unavailable: session stays in memory only */
      }
    },
    [storageKey],
  );

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as NavWithWakeLock;
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      /* wake lock unsupported or denied: the timer still works */
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      /* already released */
    }
    wakeLockRef.current = null;
  }, []);

  const clearGrace = useCallback(() => {
    if (graceTimeoutRef.current !== null) {
      clearTimeout(graceTimeoutRef.current);
      graceTimeoutRef.current = null;
    }
    setGraceLeftMs(null);
  }, []);

  const teardown = useCallback(() => {
    clearGrace();
    void releaseWakeLock();
  }, [clearGrace, releaseWakeLock]);

  // Begin a fresh focus session: POST /api/sessions/start, persist the returned
  // token + server-authoritative startedAt (virtualStart), grab the wake lock,
  // and enter the running phase. Uses startedAt from the server so client clock
  // skew can't drift the 20-minute window the server later verifies (≥19m30s).
  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskId }),
      });
      const data = (await res.json()) as Partial<StartResponse> & {
        error?: string;
      };

      if (
        res.ok &&
        typeof data.sessionToken === "string" &&
        typeof data.startedAt === "number"
      ) {
        const session: StoredSession = {
          sessionToken: data.sessionToken,
          virtualStart: data.startedAt,
        };
        sessionRef.current = session;
        persistSession(session);
        setRemainingMs(SESSION_MS);
        void requestWakeLock();
        updatePhase("running");
        return;
      }

      setCanRetry(false);
      setErrorHint(
        data.error === "desk-not-found"
          ? "الترابيزة دي لسه مسجّلة. جرّب تلتقط الستيكر تاني."
          : data.error === "missing-desk-id"
            ? "معرفتش تبدأ — ناقص رقم الترابيزة."
            : "جلسة التركيز مقدرتش تبدأ. حاول تاني.",
      );
      updatePhase("error");
    } catch {
      setCanRetry(false);
      setErrorHint("السيرفر مش واصل. شيك على النت وحاول تاني.");
      updatePhase("error");
    } finally {
      startingRef.current = false;
    }
  }, [deskId, persistSession, requestWakeLock, updatePhase]);

  const completeSession = useCallback(
    async (session: StoredSession) => {
      if (completingRef.current) return;
      completingRef.current = true;
      try {
        const res = await fetch("/api/sessions/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: session.sessionToken }),
        });
        const data = (await res.json()) as Partial<CompleteResponse> & {
          error?: string;
        };

        if (res.ok && typeof data.signingToken === "string") {
          updatePhase("completed");
          sessionRef.current = null;
          persistSession(null);
          teardown();
          onSessionComplete(data.signingToken);
          return;
        }

        sessionRef.current = null;
        persistSession(null);
        teardown();
        setCanRetry(false);
        setErrorHint(
          data.error === "session-too-short"
            ? "مستعجل كده؟ الترابيزة دي بتحسب بس جلسات 20 دقيقة كاملة. المرة الجاية شوف بوست تاني."
            : data.error === "invalid-or-expired-token"
              ? "سجل الجلسة اختفى — ابدأ جلسة 20 دقيقة جديدة عشان توقّع على الترابيزة دي."
              : "جلسة التركيز مقدرتش تخلص. حاول تاني.",
        );
        updatePhase("error");
      } catch {
        completingRef.current = false;
        teardown();
        setCanRetry(true);
        setErrorHint("السيرفر مش واصل. شيك على النت وحاول تاني.");
        updatePhase("error");
      }
    },
    [onSessionComplete, persistSession, teardown, updatePhase],
  );

  useEffect(() => {
    let stored: StoredSession | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredSession>;
        if (
          typeof parsed.sessionToken === "string" &&
          typeof parsed.virtualStart === "number"
        ) {
          stored = { sessionToken: parsed.sessionToken, virtualStart: parsed.virtualStart };
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      stored = null;
    }

    if (stored) {
      sessionRef.current = stored;
      updatePhase("running");
      void requestWakeLock();
    }

    return () => {
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskId]);

  useEffect(() => {
    if (phase !== "running" && phase !== "left") return;

    const tick = () => {
      const session = sessionRef.current;
      if (!session) return;
      const remaining = session.virtualStart + SESSION_MS - Date.now();
      if (remaining <= 0) {
        setRemainingMs(0);
        void completeSession(session);
        return;
      }
      setRemainingMs(remaining);
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [phase, completeSession]);

  useEffect(() => {
    if (phase !== "running" && phase !== "left") return;

    const releaseLockInGrace = () => {
      if (graceTimeoutRef.current !== null) {
        clearTimeout(graceTimeoutRef.current);
        graceTimeoutRef.current = null;
      }
      setGraceLeftMs(null);
      updatePhase("running");
    };

    const resumeRun = () => {
      const session = sessionRef.current;
      if (!session) return;
      releaseLockInGrace();
      void requestWakeLock();
    };

    const resumeFromPaused = () => {
      const session = sessionRef.current;
      if (!session) return;
      session.virtualStart = Date.now() + pausedRemainingRef.current - SESSION_MS;
      resumeRun();
    };

    const onVisible = () => {
      if (phaseRef.current === "left") {
        resumeRun();
      } else if (phaseRef.current === "paused") {
        resumeFromPaused();
      }
    };

    const onBackgrounded = () => {
      if (phaseRef.current !== "running") return;
      const session = sessionRef.current;
      if (!session) return;

      updatePhase("left");
      setGraceLeftMs(GRACE_MS);

      graceTimeoutRef.current = setTimeout(() => {
        graceTimeoutRef.current = null;
        setGraceLeftMs(null);
        if (phaseRef.current === "left") {
          const remainingAtPause = Math.max(
            0,
            session.virtualStart + SESSION_MS - Date.now(),
          );
          pausedRemainingRef.current = remainingAtPause;
          if (remainingAtPause <= 0) {
            void completeSession(session);
          } else {
            updatePhase("paused");
          }
        }
      }, GRACE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        onVisible();
      } else {
        onBackgrounded();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onBackgrounded);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onBackgrounded);
    };
  }, [phase, requestWakeLock, completeSession, updatePhase]);

  const giveUp = useCallback(() => {
    completingRef.current = false;
    sessionRef.current = null;
    persistSession(null);
    teardown();
    updatePhase("idle");
    setRemainingMs(SESSION_MS);
    setCanRetry(false);
    setErrorHint("");
  }, [persistSession, teardown, updatePhase]);

  const clock = formatClock(remainingMs);
  const elapsedMs = Math.min(SESSION_MS, Math.max(0, SESSION_MS - remainingMs));
  const dashOffset = RING_CIRCUMFERENCE * (1 - elapsedMs / SESSION_MS);

  if (phase === "completed") {
    return (
      <section className="card flex flex-col items-center gap-[var(--space-3)] p-[var(--space-6)]">
        <ProgressRing dashOffset={0} center="✓" ariaLabel="خلصت جلسة التركيز" />
        <p
          aria-live="polite"
          className="text-center font-bold"
          style={{ fontSize: "var(--text-lg)", color: "var(--accent)" }}
        >
          +20 XP للترابيزة دي.
        </p>
        <p
          className="text-center"
          style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}
        >
          كسبت توكن توقيع — شغّال لمدة 15 دقيقة.
        </p>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section
        role="alert"
        className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]"
      >
        <p
          className="text-center font-semibold"
          style={{ fontSize: "var(--text-base)", color: "var(--danger)" }}
        >
          {errorHint}
        </p>
        {canRetry && sessionRef.current !== null ? (
          <button
            type="button"
            onClick={() => {
              setErrorHint("");
              clearGrace();
              updatePhase("running");
            }}
            className="btn btn-primary btn-block"
          >
            حاول تاني تكمل
          </button>
        ) : (
          <button
            type="button"
            onClick={giveUp}
            className="btn btn-ghost btn-block"
          >
            رجوع
          </button>
        )}
      </section>
    );
  }

  if (phase === "paused") {
    return (
      <section className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]">
        <ProgressRing
          dashOffset={dashOffset}
          center={clock}
          ariaLabel="المؤقت وقف"
          ringDim
          clockDim
        />
        <p
          aria-live="polite"
          className="text-center font-semibold"
          style={{ fontSize: "var(--text-base)", color: "var(--ink)" }}
        >
          المؤقت وقف… ارجع للتبويبة عشان تكمل.
        </p>
        <button type="button" onClick={giveUp} className="btn btn-ghost btn-sm">
          سيبها
        </button>
      </section>
    );
  }

  if (phase === "idle") {
    return (
      <section className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]">
        <p
          className="text-center font-bold"
          style={{ fontSize: "var(--text-lg)", color: "var(--ink)" }}
        >
          خلّص 20 دقيقة عشان توقّع على ترابيزة {deskId}.
        </p>
        <button
          type="button"
          onClick={() => void start()}
          className="btn btn-primary btn-block"
          style={{ fontSize: "var(--text-xl)" }}
        >
          ابدأ الجلسة
        </button>
        <p
          className="text-center"
          style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}
        >
          سيب التبويبة ده عشان المؤقت يقف.
        </p>
      </section>
    );
  }

  return (
    <section className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]">
      {phase === "left" && graceLeftMs !== null ? (
        <p
          aria-live="polite"
          className="font-bold"
          style={{ fontSize: "var(--text-lg)", color: "var(--accent)" }}
        >
          سماح {Math.ceil(graceLeftMs / 1000)} ثانية…
        </p>
      ) : null}
      <ProgressRing
        dashOffset={dashOffset}
        center={clock}
        ariaLabel={
          phase === "left"
            ? "فترة سماح قبل ما المؤقت يقف"
            : `جلسة التركيز شغالة، متبقي ${clock}`
        }
        pulse={phase === "running"}
        clockDim={phase === "left"}
      />
      <p
        className="text-center"
        style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}
      >
        سيب التبويبة ده عشان المؤقت يقف.
      </p>
      <button type="button" onClick={giveUp} className="btn btn-ghost btn-sm">
        سيبها
      </button>
    </section>
  );
}
