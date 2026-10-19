"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Wax-seal envelope modal (PRD §3.3 P1). Rendered by app/page.tsx when
 * getDeskFeed surfaces a claimableSealed envelope authored by a device
 * other than the current one. Content arrives ONLY after the atomic
 * claim-open below — never SSR'd into the page payload.
 */

interface ClaimedCapsule {
  textContent: string | null;
  doodleData: string | null;
  authorAlias: string | null;
}

type Stage = "sealed" | "opened" | "pinned" | "deleted";

export default function SealedEnvelope({
  capsuleId,
}: {
  capsuleId: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("sealed");
  const [claimed, setClaimed] = useState<ClaimedCapsule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Presentational only: triggers the backdrop fade-in after first paint.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const call = async (init: RequestInit, nextStage: Stage) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/capsules/${capsuleId}`, init);
      const data = (await res.json().catch(() => null)) as
        | { capsule?: ClaimedCapsule }
        | null;

      if (!res.ok) {
        setError(
          res.status === 409
            ? "حد تاني فتح الظرف ده قبل كده."
            : `ختم الشمع مش عايز يفتح (${res.status}). حاول تاني.`,
        );
        return;
      }
      if (data?.capsule) setClaimed(data.capsule);
      setStage(nextStage);
      if (nextStage !== "opened") router.refresh();
    } catch {
      setError("النت وقع — الظرف فضل مختوم. حاول تاني.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    await call(
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      },
      "opened",
    );
  };

  const handlePin = async () => {
    await call(
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pin" }),
      },
      "pinned",
    );
  };

  const handleKeepSecret = async () => {
    await call({ method: "DELETE" }, "deleted");
  };

  const close = () => {
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{
        opacity: shown ? 1 : 0,
        transition: "opacity var(--transition-base) ease",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="ظرف مختوم"
    >
      <div
        className="card w-full max-w-[420px] p-6 text-center"
        style={{
          backgroundColor: "var(--paper-raised)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        {stage === "sealed" && (
          <>
            <div className="text-5xl" aria-hidden="true">
              ✉️
            </div>
            <h2
              className="mt-3 text-lg font-bold"
              style={{ color: "var(--ink)" }}
            >
              مظروف مختوم، سيبه للي بعدك
            </h2>
            <p
              className="mt-1 text-xs leading-relaxed"
              style={{ color: "var(--ink-muted)" }}
            >
              اللي كان قاعد هنا قبل كده كتب حاجة للي هيقعدها بعد كده. يعني انت.
              بتتقرا مرة واحدة بس.
            </p>
            {error ? (
              <p
                className="mt-2 text-sm font-semibold"
                style={{ color: "var(--danger)" }}
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleOpen}
              disabled={busy}
              className="btn btn-primary btn-block mt-4"
            >
              {busy ? "بيكسر الختم..." : "اكسر ختم الشمع"}
            </button>
          </>
        )}

        {stage === "opened" && (
          <>
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--accent)" }}
            >
              ✉ اتفتح — اقراه تحت
            </p>
            {claimed?.authorAlias ? (
              <p
                className="mt-1 text-sm italic"
                style={{ color: "var(--ink-muted)" }}
              >
                — {claimed.authorAlias}
              </p>
            ) : (
              <p
                className="mt-1 text-sm italic"
                style={{ color: "var(--ink-muted)" }}
              >
                — طالب مجهول
              </p>
            )}
            {claimed?.textContent ? (
              <p
                className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                {claimed.textContent}
              </p>
            ) : (
              <p
                className="mt-3 text-sm"
                style={{ color: "var(--ink-muted)" }}
              >
                (ملاحظة فاضية)
              </p>
            )}
            {claimed?.doodleData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={claimed.doodleData}
                alt="رسمة بكسل جوّه المظروف"
                className="mx-auto mt-3 w-full rounded"
                style={{ imageRendering: "pixelated", border: "1px solid var(--grid-line)" }}
                width={128}
                height={64}
              />
            ) : null}
            {error ? (
              <p
                className="mt-2 text-sm font-semibold"
                style={{ color: "var(--danger)" }}
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <p
              className="mt-4 text-xs font-semibold"
              style={{ color: "var(--ink)" }}
            >
              تعمل له إيه دلوقتي؟
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handlePin}
                disabled={busy}
                className="btn btn-primary flex-1"
              >
                {busy ? "..." : "📌 ثبّت على الحيطة"}
              </button>
              <button
                type="button"
                onClick={handleKeepSecret}
                disabled={busy}
                className="btn btn-danger flex-1"
              >
                {busy ? "..." : "🤫 سيبها سر (امسح)"}
              </button>
            </div>
          </>
        )}

        {(stage === "pinned" || stage === "deleted") && (
          <>
            <div className="text-4xl" aria-hidden="true">
              {stage === "pinned" ? "📌" : "🤫"}
            </div>
            <p
              className="mt-3 text-sm font-bold"
              style={{ color: "var(--ink)" }}
            >
              {stage === "pinned"
                ? "اتثبّت على حيطة الترابيزة دي."
                : "اتمسح سرًا — المظروف راح خالص."}
            </p>
            <button
              type="button"
              onClick={close}
              className="btn btn-ghost btn-block mt-4"
            >
              ارجع للحيطة
            </button>
          </>
        )}
      </div>
    </div>
  );
}
