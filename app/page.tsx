import { cookies, headers } from "next/headers";
import Link from "next/link";
import { getDeskFeed } from "@/lib/feed";
import { getDeskPrompt } from "@/lib/prompts";
import {
  getAnonymousDeviceHash,
  getDeviceHashFromCookies,
} from "@/lib/device";
import DeskHeader from "./components/DeskHeader";
import Corkboard from "./components/Corkboard";
import DeskInteraction from "./components/DeskInteraction";
import SealedEnvelope from "./components/SealedEnvelope";

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ desk?: string }>;
}) {
  const { desk: deskId } = await searchParams;

  // Device identity comes from the server-issued dl_device cookie (Server
  // Components can read but not set cookies). A cookie-less visitor is
  // anonymous: hash is an IP-only provisional value marked hasIdentity/
  // false, so the feed never offers them a claimable sealed envelope.
  // The cookie is minted on their first API POST (e.g. /api/sessions/
  // start); a later refresh establishes the real identity.
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const deviceHash = getDeviceHashFromCookies(cookieStore, requestHeaders);
  const device = deviceHash.newCookie === undefined
    ? { hash: deviceHash.hash, hasIdentity: true }
    : { hash: getAnonymousDeviceHash(requestHeaders), hasIdentity: false };

  // Server-side fetch: SSR feed for <1.2s first paint, no client fetch.
  const feed = deskId ? await getDeskFeed(deskId, device) : null;

  if (!deskId || !feed || !feed.desk) {
    return (
      <main className="empty-page mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center px-5 text-center">
        <div className="empty-state card w-full p-8">
          <span className="pin-mark" aria-hidden="true" />
          <h1
            className="mt-4 text-xl font-bold"
            style={{ color: "var(--ink)" }}
          >
            {deskId ? "الترابيزة دي مش موجودة" : "امسح QR ترابيزة"}
          </h1>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--ink-muted)" }}
          >
            {deskId
              ? <>الكود <bdi dir="ltr">{deskId}</bdi> مش مسجّل. اتأكد من الاستيكر وامسح تاني.</>
              : "دوّر على استيكر DeskLore على ترابيزة في المكتبة، امسح الـ QR، وافتح حيطة الترابيزة دي."}
          </p>
          <Link href="/" className="btn btn-ghost btn-block mt-6">
            امسح استيكر تاني
          </Link>
        </div>
      </main>
    );
  }

  const prompt = getDeskPrompt(feed.desk.id);

  return (
    <main className="desk-page">
      <DeskHeader desk={feed.desk} prompt={prompt} />
      <div className="desk-grid">
        <section className="desk-story">
          <Corkboard capsules={feed.capsules} sealedPendingCount={feed.sealedPendingCount} />

          {/* The envelope is inline and deferable; secret content is claimed or
              recovered client-side and is never SSR'd. */}
          {feed.openedSealed ? (
            <SealedEnvelope
              key={`opened-${feed.openedSealed.id}`}
              capsuleId={feed.openedSealed.id}
              initiallyOpened
            />
          ) : null}
          {feed.claimableSealed ? (
            <SealedEnvelope
              key={`claimable-${feed.claimableSealed.id}`}
              capsuleId={feed.claimableSealed.id}
            />
          ) : null}
        </section>

        {/* Read first, then commit to a short focus session and leave a message. */}
        <DeskInteraction deskId={feed.desk.id} prompt={prompt} />
      </div>
    </main>
  );
}
