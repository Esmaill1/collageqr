import type { CSSProperties } from "react";
import type { CapsuleFeedItem } from "@/lib/feed";
import { doodleBmpDataUri } from "@/lib/capsule";
import PeelOffButton from "@/app/components/PeelOffButton";

const DATE_FORMAT = new Intl.DateTimeFormat("ar-EG", {
  month: "short",
  day: "numeric",
});

/**
 * URL stripping at render time, in case anything slips past the
 * submit-time strip (PRD §3.3: text notes carry no URLs).
 */
function stripUrls(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(www\.)?\S+\.(com|net|org|io|edu|gov)\S*/gi, "")
    .trim();
}

/** Deterministic hand-pinned tilt: stable per capsule, varied across the board. */
const TILT_CLASSES = ["pin-tilt-l", "pin-tilt-r", "pin-tilt-l2", "pin-tilt-r2"] as const;

function tiltFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return TILT_CLASSES[Math.abs(hash) % 4];
}

function CardFooter({
  capsule,
  tone,
}: {
  capsule: CapsuleFeedItem;
  tone: "sticky" | "paper";
}) {
  if (!capsule.authorAlias && !capsule.createdAt) return null;
  return (
    <footer className="mt-3 flex items-center justify-between">
      <span
        className="text-xs italic"
        style={{ color: tone === "sticky" ? "var(--sticky-ink)" : "var(--ink-muted)" }}
      >
        {capsule.authorAlias ? `— ${capsule.authorAlias}` : ""}
      </span>
      <span className="flex items-center gap-3">
        {/* Wave 7: CapsuleFeedItem carries no reportCount/status — feed is
            PUBLISHED-only, so defaults are safe; the server reports the
            real count in the peel-off response. */}
        <PeelOffButton
          capsuleId={capsule.id}
          reportCount={0}
          status={"PUBLISHED"}
        />
        <time
          dateTime={capsule.createdAt.toISOString()}
          className="text-xs"
          style={{ color: "var(--ink-faint)" }}
        >
          {DATE_FORMAT.format(capsule.createdAt)}
        </time>
      </span>
    </footer>
  );
}

function TextBody({ capsule }: { capsule: CapsuleFeedItem }) {
  const text = stripUrls(capsule.textContent);
  if (!text) return null;
  // Color is inherited: --sticky-ink on the sticky note, --ink elsewhere.
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {text}
    </p>
  );
}

function DoodleBody({ capsule }: { capsule: CapsuleFeedItem }) {
  if (!capsule.doodleData) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={capsule.doodleData}
      alt={`رسمة بكسل${capsule.authorAlias ? ` للـ ${capsule.authorAlias}` : ""}`}
      className="w-full"
      style={{ imageRendering: "pixelated" }}
      width={128}
      height={64}
      loading="lazy"
    />
  );
}

function CassetteBody({ capsule }: { capsule: CapsuleFeedItem }) {
  const meta = capsule.trackMetadata;
  const trackUrl = capsule.trackUrl;
  let domain: string | null = null;
  if (trackUrl) {
    try {
      domain = new URL(trackUrl).hostname.replace(/^www\./, "");
    } catch {
      domain = null;
    }
  }

  return (
    <div>
      <div className="flex items-start gap-2">
        <span
          className="cassette-spin inline-block text-lg leading-none"
          aria-hidden="true"
        >
          📼
        </span>
        <p className="text-sm leading-relaxed">
          {meta?.title ? (
            <>
              <span className="font-semibold">{meta.title}</span>
              {meta.artist && (
                <span style={{ color: "var(--ink-muted)" }}> · {meta.artist}</span>
              )}
            </>
          ) : domain ? (
            <span>
              أغنية من{" "}
              <span className="font-semibold break-all">{domain}</span>
            </span>
          ) : (
            <span className="break-all">{trackUrl}</span>
          )}
        </p>
      </div>
      {meta?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt=""
          aria-hidden="true"
          className="mt-2 h-16 w-16 rounded object-cover"
          style={{ border: "1px solid var(--grid-line)" }}
          loading="lazy"
        />
      ) : null}
      <p
        className="mt-1 text-xs uppercase tracking-wide"
        style={{ color: "var(--ink-faint)" }}
      >
        كاسيت المكتب · أغنية مقترحة
      </p>
    </div>
  );
}

/**
 * Wave 6 (PRD §3.3 P2): the completed pass-doodle shows the full merged
 * bitmask as a rendered 1-bit BMP image. Parents never reach the feed —
 * getDeskFeed excludes them — so feed items always render the finished
 * merged piece.
 */
function PassDoodleBody({ capsule }: { capsule: CapsuleFeedItem }) {
  if (!capsule.doodleData) return null;
  const src = doodleBmpDataUri(capsule.doodleData);
  if (!src) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-accent">
        ✏️ رسمة جماعية
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`رسمة جماعية بكسل${capsule.authorAlias ? ` للـ ${capsule.authorAlias}` : ""}`}
        className="w-full"
        style={{ imageRendering: "pixelated" }}
        width={128}
        height={64}
        loading="lazy"
      />
    </div>
  );
}

function bodyFor(capsule: CapsuleFeedItem) {
  switch (capsule.type) {
    case "TEXT":
      return <TextBody capsule={capsule} />;
    case "DOODLE":
      return <DoodleBody capsule={capsule} />;
    case "CASSETTE":
      return <CassetteBody capsule={capsule} />;
    case "SEALED":
      // Sealed + unopened is excluded upstream in getDeskFeed; an opened
      // envelope slipping through renders its content.
      return (
        <>
          <p className="mb-2 text-xs font-semibold text-accent">
            ✉ مظروف متفتح
          </p>
          <TextBody capsule={capsule} />
          <DoodleBody capsule={capsule} />
        </>
      );
    case "PASS_DOODLE":
      return <PassDoodleBody capsule={capsule} />;
    default:
      return null;
  }
}

/** Corkboard signature: each capsule type is a different pinned paper. */
function surfaceFor(capsule: CapsuleFeedItem): { className: string; style: CSSProperties } {
  switch (capsule.type) {
    case "TEXT":
      // Sticky note: yellow paper, sticky-ink text, no inner border.
      return { className: "sticky-note", style: { padding: "var(--space-4)" } };
    case "DOODLE":
    case "PASS_DOODLE":
      // Polaroid: white frame with a wider bottom margin for the caption.
      return { className: "polaroid", style: {} };
    default:
      // CASSETTE + opened SEALED: liner-note card.
      return { className: "card", style: { padding: "var(--space-4)" } };
  }
}

export default function CapsuleCard({
  capsule,
  featured = false,
}: {
  capsule: CapsuleFeedItem;
  featured?: boolean;
}) {
  const surface = surfaceFor(capsule);
  const tone = capsule.type === "TEXT" ? "sticky" : "paper";
  return (
    <article
      className={`card-pinned ${surface.className} ${tiltFor(capsule.id)}`}
      style={
        featured
          ? {
              ...surface.style,
              outline: "2px solid var(--accent)",
              outlineOffset: "2px",
              boxShadow: "var(--shadow-lift)",
            }
          : surface.style
      }
    >
      <div className="pushpin" aria-hidden="true" />
      {bodyFor(capsule)}
      <CardFooter capsule={capsule} tone={tone} />
    </article>
  );
}
