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
  const looksValid = isValidHttpUrl(value.trim());

  return (
    <div className="mt-3">
      <label className="block text-xs font-semibold text-ink" htmlFor="track-url">
        🎵 Drop a song for the next person at this desk
      </label>
      <input
        id="track-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a Spotify / YouTube / SoundCloud link"
        className="mt-1 w-full border border-ink bg-bg p-2 text-sm text-ink break-all focus:border-accent focus:outline-none"
        aria-describedby="track-url-hint"
      />
      <p id="track-url-hint" className="mt-1 text-[10px] opacity-60 text-ink">
        {value.trim().length === 0
          ? SUPPORTED
          : looksValid
            ? "Song title + artist are pulled in automatically when you pin."
            : "That doesn't look like a link — paste the full https:// URL."}
      </p>
    </div>
  );
}
