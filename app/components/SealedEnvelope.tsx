"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ClaimedCapsule {
  textContent: string | null;
  authorAlias: string | null;
}

type Stage = "sealed" | "deferred" | "opened" | "pinned" | "deleted";

/**
 * Inline sealed-envelope card. It never blocks the desk or focus flow, and an
 * opener can recover the secret after a refresh because the server remembers
 * which device claimed it.
 */
export default function SealedEnvelope({
  capsuleId,
  initiallyOpened = false,
}: {
  capsuleId: string;
  initiallyOpened?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initiallyOpened ? "opened" : "sealed");
  const [claimed, setClaimed] = useState<ClaimedCapsule | null>(null);
  const [busy, setBusy] = useState(initiallyOpened);
  const [error, setError] = useState<string | null>(null);

  const loadOpened = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/capsules/${capsuleId}`);
        const data = (await res.json().catch(() => null)) as
          | { capsule?: ClaimedCapsule; error?: string }
          | null;
        if (!res.ok || !data?.capsule) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        setClaimed(data.capsule);
    } catch {
      setError("الرسالة اتفتحت قبل كده، بس مقدرناش نرجعها. جرّب تاني.");
    } finally {
      setBusy(false);
    }
  }, [capsuleId]);

  useEffect(() => {
    if (initiallyOpened) void loadOpened();
  }, [initiallyOpened, loadOpened]);

  const call = async (init: RequestInit, nextStage: Stage) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/capsules/${capsuleId}`, init);
      const data = (await res.json().catch(() => null)) as
        | { capsule?: ClaimedCapsule; error?: string }
        | null;

      if (!res.ok) {
        setError(
          res.status === 403
            ? "الرسالة دي اتفتحت من جهاز تاني."
            : res.status === 409
              ? "حد تاني فتح الرسالة دي قبل كده."
              : "حصلت مشكلة. جرّب تاني.",
        );
        return;
      }

      if (data?.capsule) setClaimed(data.capsule);
      setStage(nextStage);
      if (nextStage === "pinned" || nextStage === "deleted") {
        router.refresh();
      }
    } catch {
      setError("النت وقع — الرسالة لسه مستنية قرارك. جرّب تاني.");
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
    if (
      typeof window !== "undefined" &&
      !window.confirm("امسح الرسالة نهائيًا؟ مش هتقدر ترجعها بعد كده.")
    ) {
      return;
    }
    await call({ method: "DELETE" }, "deleted");
  };

  if (stage === "deferred") {
    return (
      <section className="card p-4" aria-label="رسالة مختومة">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            ✉ رسالة مختومة مستنياك
          </p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setStage("sealed")}>
            افتحها دلوقتي
          </button>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
          تقدر تكمّل جلسة التركيز الأول — الرسالة مش هتضيع.
        </p>
      </section>
    );
  }

  if (stage === "pinned" || stage === "deleted") {
    return (
      <section
        className="card p-4"
        style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}
        aria-live="polite"
      >
        <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
          {stage === "pinned"
            ? "اتثبتت الرسالة على حيطة الترابيزة."
            : "اتمسحت الرسالة بعد تأكيدك — ومش هتظهر تاني."}
        </p>
        <button type="button" onClick={() => router.refresh()} className="btn btn-sm btn-ghost mt-3">
          حدّث الحيطة
        </button>
      </section>
    );
  }

  return (
    <section className="card p-5" aria-label="رسالة مختومة للي بعدك">
      {stage === "sealed" ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-bold" style={{ color: "var(--ink)" }}>
                ✉ رسالة مختومة للي قعد قبلك
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                افتحها لما تكون مستعد. ولو مش وقتها، سيبها مستنياك.
              </p>
            </div>
            <span className="text-3xl" aria-hidden="true">✉️</span>
          </div>
          {error ? <p className="mt-3 text-sm font-semibold" style={{ color: "var(--danger)" }} role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleOpen} disabled={busy} className="btn btn-primary flex-1">
              {busy ? "بيفتح…" : "افتح الرسالة"}
            </button>
            <button type="button" onClick={() => setStage("deferred")} disabled={busy} className="btn btn-ghost flex-1">
              بعدين
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            {busy ? "بنرجّع الرسالة…" : "✉ الرسالة اتفتحت"}
          </p>
          {claimed?.authorAlias ? (
            <p className="mt-1 text-sm italic" style={{ color: "var(--ink-muted)" }} dir="auto">
              — <bdi>{claimed.authorAlias}</bdi>
            </p>
          ) : null}
           {claimed?.textContent ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ color: "var(--ink)" }} dir="auto">
              {claimed.textContent}
            </p>
          ) : busy ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }} role="status">بنجيبها…</p>
          ) : null}
          {error ? <p className="mt-3 text-sm font-semibold" style={{ color: "var(--danger)" }} role="alert">{error}</p> : null}
          {!claimed && error ? (
            <button type="button" onClick={() => void loadOpened()} disabled={busy} className="btn btn-ghost btn-block mt-3">
              حاول نرجّع الرسالة
            </button>
          ) : (
            <>
              <p className="mt-4 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                تحب تعمل إيه بالرسالة؟
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={handlePin} disabled={busy || !claimed} className="btn btn-primary flex-1">
                  {busy ? "بنحفظ…" : "📌 ثبّت على الحيطة"}
                </button>
                <button type="button" onClick={handleKeepSecret} disabled={busy || !claimed} className="btn btn-danger flex-1">
                  🤫 امسحها سرًا
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
