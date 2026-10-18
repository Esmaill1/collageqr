"use client";

import { useState } from "react";
import { BADGES } from "@/lib/badges";

/**
 * Physical Spot Micro-Reviews (PRD §3.1 P1): after a focus session
 * unlocks a signing token, the occupant may toggle up to 2 predefined
 * attribute badges. Badges do NOT consume the capsule signing token —
 * the server verifies it separately via lib/jwt (tokenUsed untouched).
 */

const MAX_BADGES = 2;

export default function BadgePicker({
  deskId,
  signingToken,
}: {
  deskId: string;
  signingToken: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < MAX_BADGES
          ? [...prev, key]
          : prev,
    );
  };

  const submit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/desks/${deskId}/badges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signingToken, badges: selected }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(
          data?.error === "invalid-token"
            ? "التوكن بتاعك خلص — اعمل سيشن فوكس تانية عشان تقيّم."
            : data?.error === "already-voted"
              ? "أنت قيّمت الترابيزة دي قبل كده."
              : `معرفناش نحفظ تقييمك (${res.status}). جرّب تاني.`,
        );
        return;
      }
      setVoted(true);
    } catch {
      setError("حصل لخبطة في الشبكة — التقييم مش اتحفظ. جرّب تاني.");
    } finally {
      setSubmitting(false);
    }
  };

  if (voted) {
    return (
      <aside
        className="mt-3 border-dashed p-3 text-center"
        style={{ border: "1px dashed var(--grid-line)" }}
        aria-label="تقييمات الترابيزة"
      >
        <p className="text-xs text-ink opacity-70">
          ⭐شكرًا — تقييمك بقى ظاهر فوق في الهيدر.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="mt-3 p-3"
      style={{ border: "1px dashed var(--grid-line)" }}
      aria-label="قيّم الترابيزة دي"
    >
      <p className="text-xs font-semibold text-ink">
        قيّم المكان ده <span className="font-normal opacity-60">(اختر كحد أقصى وصفين)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {BADGES.map((badge) => {
          const isOn = selected.includes(badge.key);
          return (
            <button
              key={badge.key}
              type="button"
              onClick={() => toggle(badge.key)}
              aria-pressed={isOn}
              className={
                isOn
                  ? "rounded-full border border-accent px-2.5 py-1 text-xs font-bold text-accent"
                  : "rounded-full border px-2.5 py-1 text-xs text-ink"
              }
              style={
                isOn ? undefined : { borderColor: "var(--grid-line)" }
              }
            >
              {badge.emoji} {badge.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-bold text-accent" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={submit}
        disabled={selected.length === 0 || submitting}
        className={
          selected.length > 0 && !submitting
            ? "mt-2 w-full border border-accent p-2 text-xs font-bold text-accent"
            : "mt-2 w-full border border-ink p-2 text-xs opacity-40 text-ink"
        }
      >
        {submitting ? "بيتسجّل..." : "احفظ التقييم"}
      </button>
    </aside>
  );
}
