"use client";

import { isValidHttpUrl } from "@/app/components/trackUrl";

const SUPPORTED =
  "Spotify · YouTube Music · SoundCloud · Anghami";

/**
 * Desk Cassette input (PRD §3.3 P1). Collects a track URL only — metadata
 * (title/artist) is parsed server-side from OpenGraph at capsule creation
 * and rendered in CapsuleCard; no client-side preview fetch exists.
 */
export default function CassetteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const trimmed = value.trim();
  const looksValid = isValidHttpUrl(trimmed);
  const invalid = trimmed.length > 0 && !looksValid;

  return (
    <div className="mt-4">
      <label
        htmlFor="track-url"
        className="block text-sm font-semibold text-ink"
      >
        لينك الأغنية
      </label>
      <input
        id="track-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="الصق لينك (Spotify / YouTube / SoundCloud / Anghami)"
        className="input mt-2 break-all"
        aria-invalid={invalid ? true : undefined}
        aria-describedby="track-url-hint"
      />
      <p
        id="track-url-hint"
        className="mt-2 text-xs"
        style={{ color: invalid ? "var(--danger)" : "var(--ink-muted)" }}
      >
        {trimmed.length === 0
          ? SUPPORTED
          : looksValid
            ? "اسم الأغنية والمغني هيتجيبوا أوتوماتيك لما تثبّت."
            : "ده شكله مش لينك — الصق لينك https:// كامل."}
      </p>
    </div>
  );
}
