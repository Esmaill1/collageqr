"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Community "Peel Off" report control (PRD §4 Layer 3).
 * One POST per device is deduped server-side by the reports table's
 * unique (capsuleId, deviceHash); the 3rd unique device hides the note.
 */

type PeelState =
  | { kind: "idle" }
  | { kind: "reported"; count: number }
  | { kind: "already-reported" };

const HIDE_THRESHOLD = 3;

const REPORT_ENDPOINT = "/api/capsules";

export default function PeelOffButton({
  capsuleId,
  reportCount,
  status,
}: {
  capsuleId: string;
  reportCount: number;
  status: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PeelState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const done = state.kind !== "idle" || status === "HIDDEN";

  async function handleClick() {
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await fetch(`${REPORT_ENDPOINT}/${capsuleId}/report`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          reportCount?: number;
          status?: string;
        };
        if (data.status === "HIDDEN") {
          // 3 unique devices — disable locally, then hide it from the feed.
          setState({
            kind: "reported",
            count: data.reportCount ?? HIDE_THRESHOLD,
          });
          router.refresh();
        } else {
          setState({
            kind: "reported",
            count: data.reportCount ?? reportCount + 1,
          });
        }
      } else if (res.status === 409) {
        setState({ kind: "already-reported" });
      }
      // Any other failure leaves the control quiet; the server remains
      // the source of truth and a retry re-checks dedup.
    } catch {
      // Network error — stay idle so the student can try again.
    } finally {
      setBusy(false);
    }
  }

  let label: string;
  if (state.kind === "already-reported") {
    label = "اتبلغت قبل كده";
  } else if (state.kind === "reported") {
    label = `اتبلغ (${state.count}/3)`;
  } else if (busy) {
    label = "…";
  } else {
    label = "✕ شيل";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || done}
      title="بلّغ عن الورقة دي للمشرفين"
      className="text-[10px] uppercase tracking-wide text-ink opacity-35 transition-opacity hover:opacity-70 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
