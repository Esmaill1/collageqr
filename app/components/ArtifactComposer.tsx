"use client";

import { useEffect, useState } from "react";
import { NOTE_MAX_CHARS, stripUrls } from "@/lib/text";

const TEXT_MAX_CHARS = NOTE_MAX_CHARS;
const ALIAS_MAX_CHARS = 40;

export interface CapsuleDto {
  id: string;
  deskId: string;
  type: string;
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  passParentId?: string | null;
  createdAt: string;
}

export interface ArtifactComposerProps {
  deskId: string;
  prompt: string;
  signingToken: string;
  onPublished: (capsule: CapsuleDto) => void;
  onCancel: () => void;
  onRestart: () => void;
  onRefresh: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-request": "الملاحظة دي مش قابلة للتثبيت — جرّب نص عادي أقصر.",
  "invalid-token": "توكن التوقيع بتاعك انتهى. خلّص جلسة تركيز تانية.",
  "session-not-found": "مش لاقيين الجلسة. خلّص جلسة تركيز جديدة.",
  "session-not-completed": "جلسة التركيز بتاعتك لسه مخلصتش.",
  "token-used": "الرسالة اتثبتت بالفعل — حدّث الحيطة عشان تشوفها.",
  "empty-capsule": "اكتب رسالة للي هيقعد هنا بعدك الأول.",
  "text-too-long": "الملاحظة أطول من 160 حرف.",
  "alias-too-long": "الاسم أطول من 40 حرف.",
};

/**
 * The connection-first contribution flow: one short text message, optionally
 * sealed for the next occupant. Other artifact formats remain future work and
 * are deliberately absent from this first pilot experience.
 */
export default function ArtifactComposer({
  deskId,
  prompt,
  signingToken,
  onPublished,
  onCancel,
  onRestart,
  onRefresh,
}: ArtifactComposerProps) {
  const [text, setText] = useState("");
  const [sealed, setSealed] = useState(false);
  const [alias, setAlias] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [published, setPublished] = useState<CapsuleDto | null>(null);
  const [draftSuppressed, setDraftSuppressed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const draftKey = `desklore:draft:${deskId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as {
          text?: unknown;
          alias?: unknown;
          sealed?: unknown;
        };
        if (typeof draft.text === "string") setText(draft.text);
        if (typeof draft.alias === "string") setAlias(draft.alias);
        if (typeof draft.sealed === "boolean") setSealed(draft.sealed);
      }
    } catch {
      // Draft persistence is a convenience; the composer still works without it.
    } finally {
      setHydrated(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (published || draftSuppressed) {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(draftKey, JSON.stringify({ text, alias, sealed }));
      }
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [alias, draftKey, draftSuppressed, hydrated, published, sealed, text]);

  const cleanedText = stripUrls(text);
  const canSubmit = !submitting && errorCode !== "token-used" && cleanedText.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setErrorCode(null);

    try {
      const res = await fetch("/api/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: signingToken,
          textContent: cleanedText,
          authorAlias: alias.trim() || undefined,
          isSealed: sealed,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { capsule?: CapsuleDto; error?: string }
        | null;

      if (!res.ok || !data?.capsule) {
        setErrorCode(data?.error ?? "unknown");
        if (data?.error === "token-used") {
          setDraftSuppressed(true);
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // Storage is only a convenience; the server result is final.
          }
        }
        setError(
          (data?.error && ERROR_MESSAGES[data.error]) ||
            `مش قادرين نثبت رسالتك (${res.status}). حاول تاني.`,
        );
        setSubmitting(false);
        return;
      }

      setPublished(data.capsule);
      onPublished(data.capsule);
    } catch {
      setErrorCode("network");
      setError("النت وقع — رسالتك موصلتش. حاول تاني.");
      setSubmitting(false);
    }
  };

  if (published) {
    return (
      <section
        className="card p-5"
        style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}
        aria-live="polite"
      >
        <p className="text-sm font-bold text-accent">
          {published.type === "SEALED"
            ? "رسالتك المختومة مستنّية اللي بعدك."
            : `رسالتك اتثبتت على ترابيزة ${published.deskId}!`}
        </p>
        <p className="mt-2 text-xs text-[color:var(--ink-muted)]">
          {published.type === "SEALED"
            ? "اللي هيقعد هنا بعدك هو أول واحد يقدر يفتحها."
            : "أنت كملت حكاية الترابيزة بجملة صغيرة للي بعدك."}
        </p>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-block mt-4">
          رجوع للحيطة
        </button>
      </section>
    );
  }

  return (
    <section className="card p-5" aria-label="سيب رسالة للي بعدك">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-ink">
            سيب رسالة للي هيقعد هنا بعدك — ترابيزة {deskId}
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
            {prompt}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-ghost">
          اغلق
        </button>
      </div>

      <div className="mt-4">
        <label htmlFor="compose-note" className="block text-sm font-semibold text-ink">
          رسالتك
        </label>
        <textarea
          id="compose-note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TEXT_MAX_CHARS}
          rows={4}
          placeholder="إيه اللي حابب تسيبه للي بعدك؟ (لحد 160 حرف)"
          aria-invalid={errorCode === "text-too-long" || errorCode === "empty-capsule" ? true : undefined}
          aria-describedby={error ? "compose-note-help compose-error" : "compose-note-help"}
          className="input mt-2"
          style={{ resize: "vertical", touchAction: "manipulation" }}
        />
        <p
          className="mt-2 text-xs font-semibold"
          style={{
            color:
              TEXT_MAX_CHARS - cleanedText.length <= 20
                ? "var(--danger)"
                : "var(--ink-faint)",
          }}
          aria-live="polite"
        >
          فاضّي {TEXT_MAX_CHARS - cleanedText.length} حرف
        </p>
        <p id="compose-note-help" className="text-xs text-[color:var(--ink-muted)]">
          اللينكات بتتمسح أوتوماتيك.
        </p>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={sealed}
          onChange={(e) => setSealed(e.target.checked)}
          className="accent-[var(--accent)]"
          style={{ width: 18, height: 18 }}
        />
          <span className="seal-glyph" aria-hidden="true" /> للي بعدك بس (ظرف مختوم)
      </label>

      <div className="mt-4">
        <label htmlFor="composer-alias" className="block text-sm font-semibold text-ink">
          الاسم (اختياري)
        </label>
        <input
          id="composer-alias"
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value.slice(0, ALIAS_MAX_CHARS))}
          maxLength={ALIAS_MAX_CHARS}
          placeholder="مثلاً: طالب عمارة مصدوم"
          dir="auto"
          aria-invalid={errorCode === "alias-too-long" ? true : undefined}
          aria-describedby={errorCode === "alias-too-long" && error ? "compose-error" : undefined}
          className="input mt-2"
        />
      </div>

      {error ? (
        <p id="compose-error" className="mt-3 text-sm font-bold" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </p>
      ) : null}

      {errorCode === "token-used" ? (
        <button type="button" onClick={onRefresh} className="btn btn-ghost btn-block mt-3">
          حدّث الحيطة
        </button>
      ) : errorCode === "invalid-token" || errorCode === "session-not-found" ? (
        <button type="button" onClick={onRestart} className="btn btn-ghost btn-block mt-3">
          ابدأ جلسة جديدة — الرسالة محفوظة
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        title={canSubmit ? undefined : "اكتب رسالة الأول"}
        className="btn btn-primary btn-block mt-3"
      >
        {submitting ? "بيثبت…" : sealed ? "اختمها للي بعدك" : "ثبت الرسالة"}
      </button>

      <p className="mt-3 text-center text-xs text-[color:var(--ink-faint)]">
        جلسة واحدة، رسالة واحدة، وحكاية جديدة للترابيزة.
      </p>
    </section>
  );
}
