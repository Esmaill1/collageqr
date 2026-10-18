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
          ? "This desk isn't registered yet. Try scanning the sticker again."
          : data.error === "missing-desk-id"
            ? "Couldn't start — missing desk id."
            : "Could not start the focus session. Please try again.",
      );
      updatePhase("error");
    } catch {
      setCanRetry(false);
      setErrorHint("Could not reach the server. Check the connection and retry.");
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
            ? "Too fast. This desk only counts full 20-minute sessions. Pick another post up next time."
            : data.error === "invalid-or-expired-token"
              ? "Session record vanished — start a fresh 20-minute run to sign this desk."
              : "Focus session could not be completed. Please try again.",
        );
        updatePhase("error");
      } catch {
        completingRef.current = false;
        teardown();
        setCanRetry(true);
        setErrorHint("Could not reach the server. Check the connection and retry.");
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

  if (phase === "completed") {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-accent p-3">
        <p className="text-sm font-bold text-accent">+20 XP to this desk.</p>
        <p className="text-xs text-ink opacity-70">
          You earned a signing token — valid for 15 minutes.
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-ink p-3">
        <p className="text-xs text-red-600">{errorHint}</p>
        {canRetry && sessionRef.current !== null ? (
          <button
            type="button"
            onClick={() => {
              setErrorHint("");
              clearGrace();
              updatePhase("running");
            }}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-[#f7f3ea]"
          >
            Retry completion
          </button>
        ) : (
          <button
            type="button"
            onClick={giveUp}
            className="rounded-md border border-ink px-4 py-2 text-sm text-ink"
          >
            Back
          </button>
        )}
      </div>
    );
  }

  if (phase === "paused") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-ink p-3">
        <p className="text-xs text-ink opacity-70">
          Timer paused — return to the tab to keep the streak.
        </p>
        <span className="text-3xl font-semibold tabular-nums text-ink opacity-40">
          {clock}
        </span>
        <button
          type="button"
          onClick={giveUp}
          className="text-xs text-ink opacity-50 underline"
        >
          Give up
        </button>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-ink p-3">
        <p className="text-sm font-bold text-ink">
          Complete 20 mins of focus to sign Desk {deskId}.
        </p>
        <button
          type="button"
          onClick={() => void start()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-[#f7f3ea]"
        >
          Start Session
        </button>
        <p className="text-xs text-ink opacity-60">
          Stay on this tab. The timer pauses if you leave.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-ink p-3">
      <span
        className="text-3xl font-semibold tabular-nums text-ink"
        aria-live="polite"
      >
        {clock}
      </span>
      <p className="text-xs text-ink opacity-60">
        {phase === "left" && graceLeftMs !== null
          ? `Grace ${Math.ceil(graceLeftMs / 1000)}s…`
          : "Leave this tab to pause the timer."}
      </p>
      <button
        type="button"
        onClick={giveUp}
        className="text-xs text-ink opacity-50 underline"
      >
        Give up
      </button>
    </div>
  );
}
