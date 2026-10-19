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
      <aside className="card mt-3 p-4 text-center" aria-label="تقييمات الترابيزة">
        <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>
          ⭐ شكرًا — تقييمك بقى ظاهر فوق في الهيدر.
        </p>
      </aside>
    );
  }

  return (
    <aside className="card mt-3 p-4" aria-label="قيّم الترابيزة دي">
      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
        قيّم المكان ده{" "}
        <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
          (اختر كحد أقصى وصفين)
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BADGES.map((badge) => {
          const isOn = selected.includes(badge.key);
          const full = !isOn && selected.length >= MAX_BADGES;
          return (
            <button
              key={badge.key}
              type="button"
              onClick={() => toggle(badge.key)}
              aria-pressed={isOn}
              disabled={full}
              title={full ? "مكملين وصفين" : undefined}
              className={`btn btn-sm ${isOn ? "" : "btn-ghost"}`}
              style={{
                borderRadius: "var(--radius-pill)",
                ...(isOn
                  ? {
                      borderColor: "var(--accent)",
                      backgroundColor: "var(--accent-soft)",
                      color: "var(--accent)",
                      fontWeight: 700,
                    }
                  : {}),
              }}
            >
              {isOn ? "✓ " : ""}
              {badge.emoji} {badge.label}
            </button>
          );
        })}
      </div>
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
        onClick={submit}
        disabled={selected.length === 0 || submitting}
        aria-disabled={selected.length === 0 || submitting}
        title={selected.length === 0 ? "اختار وصف واحد على الأقل الأول" : undefined}
        className="btn btn-primary btn-block mt-3"
      >
        {submitting ? "بيتسجّل..." : "احفظ التقييم"}
      </button>
    </aside>
  );
}
