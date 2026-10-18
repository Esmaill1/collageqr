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

function CardFooter({ capsule }: { capsule: CapsuleFeedItem }) {
  if (!capsule.authorAlias && !capsule.createdAt) return null;
  return (
    <footer className="mt-3 flex items-center justify-between">
      <span className="text-xs italic text-ink opacity-60">
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
          className="text-xs text-ink opacity-40"
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
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
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
      className="w-full rounded"
      style={{ imageRendering: "pixelated", border: "1px solid var(--grid-line)" }}
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
        <p className="text-sm leading-relaxed text-ink">
          {meta?.title ? (
            <>
              <span className="font-semibold">{meta.title}</span>
              {meta.artist && (
                <span className="opacity-70"> · {meta.artist}</span>
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
      <p className="mt-1 text-[10px] uppercase tracking-wide text-ink opacity-50">
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
        className="w-full rounded"
        style={{ imageRendering: "pixelated", border: "1px solid var(--grid-line)" }}
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

export default function CapsuleCard({ capsule }: { capsule: CapsuleFeedItem }) {
  return (
    <article
      className="rounded-lg border p-4 shadow-sm"
      style={{
        borderColor: "var(--grid-line)",
        backgroundColor: "var(--bg)",
        boxShadow: "2px 3px 0 rgba(26, 23, 20, 0.06)",
      }}
    >
      {bodyFor(capsule)}
      <CardFooter capsule={capsule} />
    </article>
  );
}
