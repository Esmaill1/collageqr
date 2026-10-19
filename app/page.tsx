import { cookies, headers } from "next/headers";
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
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-5 text-center">
        <div className="card w-full p-8">
          <span className="text-4xl" aria-hidden="true">📌</span>
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
              ? "الترابيزة دي لسه متسجلةش. اتأكد من الاستيكر على ترابيزتك وامسح تاني."
              : "دوّر على استيكر DeskLore على ترابيزة في المكتبة، امسح الـ QR، وافتح حيطة الترابيزة دي."}
          </p>
        </div>
      </main>
    );
  }

  const prompt = getDeskPrompt(feed.desk.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-8 px-4 pb-16 pt-6">
      <DeskHeader desk={feed.desk} prompt={prompt} />
      <Corkboard capsules={feed.capsules} sealedPendingCount={feed.sealedPendingCount} />

      {/* Read first, then commit to a short focus session and leave a message. */}
      <DeskInteraction deskId={feed.desk.id} prompt={prompt} />

      {/* Wax-seal modal (PRD §3.3 P1): content is claimed client-side via
          app/api/capsules/[id], never SSR'd. */}
      {feed.claimableSealed ? (
        <SealedEnvelope capsuleId={feed.claimableSealed.id} />
      ) : null}
    </main>
  );
}
