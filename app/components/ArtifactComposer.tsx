"use client";

import { useEffect, useState } from "react";
import PixelCanvas from "@/app/components/PixelCanvas";
import CassetteInput from "@/app/components/CassetteInput";
import BadgePicker from "@/app/components/BadgePicker";
import PassDoodleCanvas from "@/app/components/PassDoodleCanvas";
import { isValidHttpUrl } from "@/app/components/trackUrl";
import { stripUrls } from "@/lib/text";

const TEXT_MAX_CHARS = 160;
const ALIAS_MAX_CHARS = 40;

type ComposerMode = "TEXT" | "DOODLE" | "SONG" | "PASS";

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
  signingToken: string;
  onPublished: (capsule: CapsuleDto) => void;
  onCancel: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-request": "That song link doesn't look right — paste a full https:// URL.",
  "invalid-token": "Your signing token expired. Finish another focus session.",
  "session-not-found": "Session not found. Finish a new focus session.",
  "session-not-completed": "Your focus session isn't complete yet.",
  "token-used": "This signing token was already used — one mark per session.",
  "empty-capsule": "Write a note or paste a song link first.",
  "text-too-long": "Notes are limited to 160 characters.",
  "doodle-too-large": "Doodle too large.",
  "alias-too-long": "Alias is limited to 40 characters.",
  // Pass-the-Doodle continuation errors (Wave 6):
  "already-continued": "Someone just finished this one — refresh.",
  "parent-not-found": "That half-doodle is gone. Refresh and try again.",
};

function friendlyType(type: string): string {
  if (type === "DOODLE") return "doodle";
  if (type === "CASSETTE") return "song";
  if (type === "SEALED") return "sealed note for the next person";
  if (type === "PASS_DOODLE") return "doodle";
  return "note";
}

/**
 * Post-focus creation sheet (PRD §3.3): Text Note, 1-Bit Pixel Doodle (P0),
 * Desk Cassette + Sealed Envelope (P1), Pass-the-Doodle (P2). Displays after
 * the focus timer hands back the signing token; submits once and then the
 * token is consumed server-side. Also hosts the P1 physical-spot badge
 * ratings, which do not consume the token.
 */
export default function ArtifactComposer({
  deskId,
  signingToken,
  onPublished,
  onCancel,
}: ArtifactComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("TEXT");
  const [text, setText] = useState("");
  const [doodleData, setDoodleData] = useState<string | null>(null);
  const [trackUrl, setTrackUrl] = useState("");
  const [sealed, setSealed] = useState(false);
  const [alias, setAlias] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<CapsuleDto | null>(null);

  // Pass-the-Doodle state (P2). On tab activation the composer checks for a
  // pending half-doodle; continue vs start mode is decided by the result.
  const [passChecked, setPassChecked] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passPending, setPassPending] = useState<{ id: string; doodleData: string } | null>(null);
  const [passMerged, setPassMerged] = useState<string | null>(null);
  const [passTopHalf, setPassTopHalf] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "PASS" || passChecked || passLoading) return;
    setPassLoading(true);
    fetch(`/api/desks/${encodeURIComponent(deskId)}/pass-doodle`)
      .then((res) => (res.ok ? res.json() : { pending: null }))
      .then((data: { pending?: { id: string; doodleData: string } | null }) => {
        setPassPending(
          data.pending && data.pending.id && typeof data.pending.doodleData === "string"
            ? { id: data.pending.id, doodleData: data.pending.doodleData }
            : null,
        );
      })
      .catch(() => setPassPending(null))
      .finally(() => {
        setPassLoading(false);
        setPassChecked(true);
      });
  }, [mode, passChecked, passLoading, deskId]);

  const passMode: "continue" | "start" = passPending ? "continue" : "start";

  const cleanedText = stripUrls(text);
  const trimmedUrl = trackUrl.trim();
  const canSubmit =
    !submitting &&
    (mode === "TEXT"
      ? cleanedText.length > 0
      : mode === "DOODLE"
        ? doodleData !== null
        : mode === "SONG"
          ? isValidHttpUrl(trimmedUrl)
          : passMode === "continue"
            ? passMerged !== null
            : passTopHalf !== null);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    type ApiError = { error?: string };
    const readError = async (res: Response): Promise<string> => {
      const data = (await res.json().catch(() => null)) as ApiError | null;
      return (
        (data?.error && ERROR_MESSAGES[data.error]) ||
        `Could not leave your mark (${res.status}). Try again.`
      );
    };

    try {
      // Pass-doodle CONTINUATION: finish someone else's half-doodle.
      if (mode === "PASS" && passMode === "continue" && passPending) {
        const res = await fetch(`/api/capsules/${encodeURIComponent(passPending.id)}/continue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: signingToken, doodleData: passMerged }),
        });
        if (!res.ok) {
          setError(await readError(res));
          setSubmitting(false);
          return;
        }
        const data = (await res.json()) as { capsule: CapsuleDto };
        setPublished(data.capsule);
        onPublished(data.capsule);
        return;
      }

      const body: Record<string, unknown> = { sessionToken: signingToken };
      if (mode === "TEXT" && cleanedText.length > 0) body.textContent = cleanedText;
      if (mode === "DOODLE" && doodleData) body.doodleData = doodleData;
      if (mode === "SONG") body.trackUrl = trimmedUrl;
      if (mode === "TEXT" && sealed) body.isSealed = true;
      if (mode === "PASS" && passTopHalf) {
        body.doodleData = passTopHalf;
        body.isPassDoodle = true;
      }
      if (alias.trim()) body.authorAlias = alias.trim();

      const res = await fetch("/api/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(await readError(res));
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { capsule: CapsuleDto };
      setPublished(data.capsule);
      onPublished(data.capsule);
    } catch {
      setError("Network hiccup — your note didn't make it. Try again.");
      setSubmitting(false);
    }
  };

  if (published) {
    const passChild = published.type === "PASS_DOODLE" && published.passParentId != null;
    return (
      <section className="border border-accent p-4" aria-live="polite">
        <p className="text-sm font-bold text-accent">
          {published.type === "SEALED"
            ? "Your sealed note is waiting for the next person."
            : published.type === "PASS_DOODLE" && !passChild
              ? "Your half is pinned — waiting for the next artist."
              : published.type === "PASS_DOODLE" && passChild
                ? "The doodle is complete! Two artists, one piece."
                : `Pinned to Desk ${published.deskId}!`}
        </p>
        <p className="mt-1 text-xs opacity-70 text-ink">
          {published.type === "SEALED"
            ? "It stays hidden until a visitor scans this desk."
            : published.type === "PASS_DOODLE" && !passChild
              ? "The next person who scans draws the bottom half and your full doodle goes public."
              : `Scroll up to see your ${friendlyType(published.type)} at the top of the corkboard.`}
        </p>
      </section>
    );
  }

  const tabButton = (value: ComposerMode, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setMode(value)}
      className={
        mode === value
          ? "border border-accent px-3 py-1.5 text-sm font-bold text-accent"
          : "border border-ink px-3 py-1.5 text-sm opacity-70 text-ink"
      }
    >
      {label}
    </button>
  );

  return (
    <section className="border border-ink p-4" aria-label="Leave a mark">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">
          Leave a mark on Desk {deskId}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs opacity-60 text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tabButton("TEXT", "Text Note")}
        {tabButton("DOODLE", "Pixel Doodle")}
        {tabButton("SONG", "Song 🎵")}
        {tabButton("PASS", "Pass-doodle ✏️")}
      </div>

      {mode === "TEXT" ? (
        <>
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={TEXT_MAX_CHARS}
              rows={4}
              placeholder={sealed ? "What should ONLY the next person read?" : "What's it like sitting here? (max 160 chars)"}
              className="w-full border border-ink bg-bg p-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-[10px] opacity-60 text-ink">
              {TEXT_MAX_CHARS - cleanedText.length} left — links are stripped automatically.
            </p>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={sealed}
              onChange={(e) => setSealed(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            ✉ For the next person only (sealed envelope)
          </label>
        </>
      ) : mode === "DOODLE" ? (
        <div className="mt-3">
          <PixelCanvas onChange={setDoodleData} />
        </div>
      ) : mode === "SONG" ? (
        <CassetteInput value={trackUrl} onChange={setTrackUrl} />
      ) : passLoading || !passChecked ? (
        <p className="mt-3 text-sm text-ink opacity-70" aria-live="polite">
          Checking for a half-doodle waiting on this desk…
        </p>
      ) : passMode === "continue" && passPending ? (
        <div className="mt-3">
          <p className="text-sm font-bold text-accent">
            Someone started a doodle here — finish it!
          </p>
          <PassDoodleCanvas
            mode="continue"
            parentDoodleData={passPending.doodleData}
            onChange={setPassMerged}
          />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink opacity-80">
            Start a pass-doodle (draw the top half — the next person finishes it)
          </p>
          <PassDoodleCanvas mode="start" onChange={setPassTopHalf} />
        </div>
      )}

      <label className="mt-3 block text-xs opacity-70 text-ink">
        Alias (optional)
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value.slice(0, ALIAS_MAX_CHARS))}
          maxLength={ALIAS_MAX_CHARS}
          placeholder="e.g. Tired Architecture Student"
          className="mt-1 w-full border border-ink bg-bg p-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {error ? (
        <p className="mt-2 text-xs font-bold text-accent" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={
          canSubmit
            ? "mt-3 w-full border border-accent bg-accent p-2.5 text-sm font-bold text-bg"
            : "mt-3 w-full border border-ink p-2.5 text-sm opacity-40 text-ink"
        }
      >
        {submitting
          ? "Pinning..."
          : mode === "PASS" && passMode === "continue"
            ? "Finish the Doodle"
            : mode === "PASS"
              ? "Pin My Half"
              : sealed
                ? "Seal it for the Next Person"
                : "Pin to Desk"}
      </button>

      {/* P1 micro-reviews: badge ratings ride along with the token but never
          consume it (own verification, see app/api/desks/[id]/badges). */}
      <BadgePicker deskId={deskId} signingToken={signingToken} />
    </section>
  );
}
