"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
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
export default function DeskInteraction({ deskId }: { deskId: string }) {
  const router = useRouter();
  const [signingToken, setSigningToken] = useState<string | null>(null);

  const handlePublished = useCallback(
    (capsule: CapsuleDto) => {
      void capsule;
      // Re-fetch the SSR desk feed so the new capsule appears at the top
      // of the corkboard, then hide the composer.
      router.refresh();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setSigningToken(null);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <FocusTimer deskId={deskId} onSessionComplete={setSigningToken} />
      {signingToken ? (
        <ArtifactComposer
          deskId={deskId}
          signingToken={signingToken}
          onPublished={handlePublished}
          onCancel={() => setSigningToken(null)}
        />
      ) : null}
    </div>
  );
}
