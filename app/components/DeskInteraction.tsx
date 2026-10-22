"use client";

import { useCallback, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SIGNING_TOKEN_TTL_MS } from "@/lib/focus";
import FocusTimer from "@/app/components/FocusTimer";
import ArtifactComposer, {
  type CapsuleDto,
} from "@/app/components/ArtifactComposer";

/**
 * Coordinates the focus session → artifact creation flow (PRD §2–§3.3):
 * the FocusTimer floating action bar renders always; once a focus session
 * completes and hands back a signing token, the ArtifactComposer appears
 * below it and is consumed by publishing a capsule (or cancelling).
 */
export default function DeskInteraction({
  deskId,
  prompt,
}: {
  deskId: string;
  prompt: string;
}) {
  const router = useRouter();
  const [signingToken, setSigningToken] = useState<string | null>(null);
  const [focusCycle, setFocusCycle] = useState(0);
  const signingStorageKey = `desklore:signing:${deskId}`;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(signingStorageKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as { token?: unknown; storedAt?: unknown };
      if (
        typeof stored.token !== "string" ||
        typeof stored.storedAt !== "number" ||
        Date.now() - stored.storedAt >= SIGNING_TOKEN_TTL_MS
      ) {
        sessionStorage.removeItem(signingStorageKey);
        return;
      }
      setSigningToken(stored.token);
    } catch {
      // The composer still works when sessionStorage is unavailable.
    }
  }, [signingStorageKey]);

  const forgetPersistedSigningToken = useCallback(() => {
    try {
      sessionStorage.removeItem(signingStorageKey);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [signingStorageKey]);

  const rememberSigningToken = useCallback(
    (token: string) => {
      setSigningToken(token);
      try {
        sessionStorage.setItem(
          signingStorageKey,
          JSON.stringify({ token, storedAt: Date.now() }),
        );
      } catch {
        // The token remains available in React state for this tab.
      }
    },
    [signingStorageKey],
  );

  const restartFocus = useCallback(() => {
    setSigningToken(null);
    forgetPersistedSigningToken();
    setFocusCycle((cycle) => cycle + 1);
  }, [forgetPersistedSigningToken]);

  const refreshAfterAlreadyPublished = useCallback(() => {
    forgetPersistedSigningToken();
    setSigningToken(null);
    setFocusCycle((cycle) => cycle + 1);
    router.refresh();
  }, [forgetPersistedSigningToken, router]);

  const handlePublished = useCallback(
    (capsule: CapsuleDto) => {
      void capsule;
      forgetPersistedSigningToken();
      // Re-fetch the SSR desk feed so the new capsule appears at the top
      // of the corkboard, then hide the composer.
      router.refresh();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [forgetPersistedSigningToken, router],
  );

  return (
    <section className="interaction-shell reveal reveal-delay-2">
      <div className="interaction-intro">
        <p className="section-kicker">02 / YOUR TURN</p>
        <h2>سيب أثر للي بعدك.</h2>
        <p>
          عشر دقايق تركيز، وبعدها جملة صغيرة تكمل حكاية الترابيزة.
        </p>
      </div>
      <div className="interaction-stack">
        <FocusTimer
          key={focusCycle}
          deskId={deskId}
          prompt={prompt}
          onSessionStarted={() => router.refresh()}
          onSessionComplete={rememberSigningToken}
        />
        {signingToken ? (
          <ArtifactComposer
            deskId={deskId}
            prompt={prompt}
            signingToken={signingToken}
            onPublished={handlePublished}
            onCancel={restartFocus}
            onRestart={restartFocus}
            onRefresh={refreshAfterAlreadyPublished}
          />
        ) : null}
      </div>
    </section>
  );
}
