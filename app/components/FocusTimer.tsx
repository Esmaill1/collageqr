"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FOCUS_DURATION_MS } from "@/lib/focus";

type Phase =
  | "idle"
  | "starting"
  | "running"
  | "completing"
  | "completed"
  | "error";

interface StoredSession {
  sessionToken: string;
  virtualStart: number;
  durationMs: number;
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
  serverNow: number;
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
}: {
  dashOffset: number;
  center: string;
  ariaLabel: string;
  pulse?: boolean;
}) {
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={ariaLabel}
      className="relative flex items-center justify-center"
      style={{ width: 200, height: 200 }}
    >
      <svg
        viewBox="0 0 200 200"
        width={200}
        height={200}
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
          color: "var(--ink)",
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
  onSessionStarted,
}: {
  deskId: string;
  onSessionComplete: (signingToken: string) => void;
  onSessionStarted?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingMs, setRemainingMs] = useState(FOCUS_DURATION_MS);
  const [errorHint, setErrorHint] = useState("");
  const [canRetry, setCanRetry] = useState(false);

  const sessionRef = useRef<StoredSession | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const completingRef = useRef<boolean>(false);
  const startingRef = useRef<boolean>(false);

  const storageKey = `desklore:focus:${deskId}`;

  const updatePhase = useCallback((next: Phase) => {
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

  const teardown = useCallback(() => {
    void releaseWakeLock();
  }, [releaseWakeLock]);

  // Begin a fresh focus session: POST /api/sessions/start, convert the returned
  // server timestamp into the client's clock domain, persist the token, grab
  // the wake lock, and enter the running phase. The timestamp stays authoritative
  // even if the browser throttles or suspends this tab.
  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setErrorHint("");
    updatePhase("starting");
    try {
      const requestStartedAt = Date.now();
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskId }),
      });
      const responseReceivedAt = Date.now();
      const data = (await res.json()) as Partial<StartResponse> & {
        error?: string;
      };

      if (
        res.ok &&
        typeof data.sessionToken === "string" &&
        typeof data.startedAt === "number"
      ) {
        const durationMs =
          typeof data.durationMs === "number" && data.durationMs > 0
            ? data.durationMs
            : FOCUS_DURATION_MS;
        const serverNow =
          typeof data.serverNow === "number" ? data.serverNow : data.startedAt;
        const estimatedClientOffset =
          serverNow - Math.round((requestStartedAt + responseReceivedAt) / 2);
        const session: StoredSession = {
          sessionToken: data.sessionToken,
          // Convert the server timestamp to the client's clock domain. The
          // completion endpoint remains authoritative; this only keeps the
          // visible timer honest when device clocks differ.
          virtualStart: data.startedAt - estimatedClientOffset,
          durationMs,
        };
        sessionRef.current = session;
        persistSession(session);
        setRemainingMs(durationMs);
        void requestWakeLock();
        updatePhase("running");
        onSessionStarted?.();
        return;
      }

      setCanRetry(false);
      setErrorHint(
        data.error === "desk-not-found"
          ? "المكان ده مش متاح."
          : data.error === "missing-desk-id"
            ? "مش قادر أبدأ الجلسة."
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
  }, [deskId, onSessionStarted, persistSession, requestWakeLock, updatePhase]);

  const completeSession = useCallback(
    async (session: StoredSession) => {
      if (completingRef.current) return;
      completingRef.current = true;
      updatePhase("completing");
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

        teardown();
        completingRef.current = false;
        const retryable =
          data.error !== "invalid-or-expired-token" &&
          data.error !== "session-not-found";
        setCanRetry(retryable);
        if (!retryable) {
          sessionRef.current = null;
          persistSession(null);
        }
        setErrorHint(
          data.error === "session-too-short"
            ? "لسه بدري شوية. حاول تاني."
            : data.error === "invalid-or-expired-token"
              ? "الجلسة انتهت. ابدأ من جديد."
              : data.error === "session-not-found"
                ? "الجلسة مش موجودة. ابدأ من جديد."
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
          stored = {
            sessionToken: parsed.sessionToken,
            virtualStart: parsed.virtualStart,
            durationMs:
              typeof parsed.durationMs === "number" && parsed.durationMs > 0
                ? parsed.durationMs
                : FOCUS_DURATION_MS,
          };
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      stored = null;
    }

    if (stored) {
      sessionRef.current = stored;
      const remaining = Math.max(
        0,
        stored.virtualStart + stored.durationMs - Date.now(),
      );
      setRemainingMs(remaining);
      updatePhase("running");
      void requestWakeLock();
      if (remaining <= 0) void completeSession(stored);
    }

    return () => {
      teardown();
    };
  }, [
    completeSession,
    deskId,
    requestWakeLock,
    storageKey,
    teardown,
    updatePhase,
  ]);

  useEffect(() => {
    if (phase !== "running") return;

    const tick = () => {
      const session = sessionRef.current;
      if (!session) return;
      const remaining = session.virtualStart + session.durationMs - Date.now();
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

  const giveUp = useCallback(() => {
    completingRef.current = false;
    sessionRef.current = null;
    persistSession(null);
    teardown();
    updatePhase("idle");
    setRemainingMs(FOCUS_DURATION_MS);
    setCanRetry(false);
    setErrorHint("");
  }, [persistSession, teardown, updatePhase]);

  const clock = formatClock(remainingMs);
  const durationMs = sessionRef.current?.durationMs ?? FOCUS_DURATION_MS;
  const elapsedMs = Math.min(durationMs, Math.max(0, durationMs - remainingMs));
  const dashOffset = RING_CIRCUMFERENCE * (1 - elapsedMs / durationMs);

  if (phase === "completed") {
    return (
      <section className="card flex flex-col items-center gap-[var(--space-3)] p-[var(--space-6)]">
        <ProgressRing dashOffset={0} center="✓" ariaLabel="خلصت جلسة التركيز" />
        <p
          aria-live="polite"
          className="text-center font-bold"
          style={{ fontSize: "var(--text-lg)", color: "var(--accent)" }}
        >
          خلصت.
        </p>
        <p
          className="text-center"
          style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}
        >
          اكتب حاجة لو حابب.
        </p>
      </section>
    );
  }

  if (phase === "completing") {
    return (
      <section className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]" aria-live="polite">
        <ProgressRing dashOffset={0} center="…" ariaLabel="بنثبت جلسة التركيز" />
        <p className="text-center text-sm font-semibold" style={{ color: "var(--accent)" }}>
          بنثبت الجلسة… ثانية واحدة.
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

  if (phase === "idle" || phase === "starting") {
    return (
      <section className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]">
        <p
          className="text-center font-bold"
          style={{ fontSize: "var(--text-lg)", color: "var(--ink)" }}
        >
          اقعد 10 دقايق، وبعدها اكتب لو حابب.
        </p>
        <button
          type="button"
          onClick={() => void start()}
          disabled={phase === "starting"}
          className="btn btn-primary btn-block"
          style={{ fontSize: "var(--text-xl)" }}
        >
          {phase === "starting" ? "بنبدأ…" : "ابدأ"}
        </button>
      </section>
    );
  }

  return (
    <section className="card flex flex-col items-center gap-[var(--space-4)] p-[var(--space-6)]">
      <ProgressRing
        dashOffset={dashOffset}
        center={clock}
        ariaLabel={`جلسة التركيز شغالة، متبقي ${clock}`}
        pulse
      />
      <button type="button" onClick={giveUp} className="btn btn-ghost btn-sm">
        إلغاء الجلسة
      </button>
    </section>
  );
}
