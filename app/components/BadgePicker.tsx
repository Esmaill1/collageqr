"use client";

import { useState } from "react";

/**
 * Physical Spot Micro-Reviews (PRD §3.1 P1): after a focus session
 * unlocks a signing token, the occupant may toggle up to 2 predefined
 * attribute badges. Badges do NOT consume the capsule signing token —
 * the server verifies it separately via lib/jwt (tokenUsed untouched).
 */

export const BADGES: { key: string; label: string }[] = [
  { key: "outlet", label: "⚡ Working Outlet" },
  { key: "cold_ac", label: "🥶 Freezing AC" },
  { key: "sunny", label: "☀️ Good Natural Light" },
  { key: "squeaky", label: "🪑 Squeaky Chair" },
  { key: "wobbly", label: "↕️ Wobbly Leg" },
  { key: "quiet", label: "🤫 Dead Quiet" },
];

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
            ? "Your signing token expired — finish another focus session."
            : data?.error === "already-voted"
              ? "You already rated this desk."
              : `Couldn't save your ratings (${res.status}). Try again.`,
        );
        return;
      }
      setVoted(true);
    } catch {
      setError("Network hiccup — ratings didn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (voted) {
    return (
      <aside
        className="mt-3 border-dashed p-3 text-center"
        style={{ border: "1px dashed var(--grid-line)" }}
        aria-label="Desk ratings"
      >
        <p className="text-xs text-ink opacity-70">
          ⭐Thanks — your desk ratings are on the header board.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="mt-3 p-3"
      style={{ border: "1px dashed var(--grid-line)" }}
      aria-label="Rate this desk"
    >
      <p className="text-xs font-semibold text-ink">
        Rate this spot <span className="font-normal opacity-60">(pick up to 2)</span>
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
              {badge.label}
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
        {submitting ? "Saving..." : "Save ratings"}
      </button>
    </aside>
  );
}
