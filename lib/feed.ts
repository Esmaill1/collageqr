import { prisma } from "@/lib/db";
import type { Desk } from "@prisma/client";

/** OpenGraph-ish metadata for a cassette capsule (JSONB in DB). */
export interface TrackMetadata {
  title?: string | null;
  artist?: string | null;
  imageUrl?: string | null;
}

/**
 * The single feed item shape surfaced to Wave 2 components.
 * Matches the fields selected by getDeskFeed.
 */
export interface CapsuleFeedItem {
  id: string;
  type: "TEXT" | "DOODLE" | "CASSETTE" | "SEALED" | "PASS_DOODLE";
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  trackUrl: string | null;
  trackMetadata: TrackMetadata | null;
  passParentId: string | null;
  createdAt: Date;
}

/**
 * One half-doodle waiting for the next artist (PRD §3.3 P2). The parent's
 * doodleData is only a TOP HALF (rows 0–31) — never rendered in the feed;
 * it is offered to the next occupant via the composer's pass-doodle tab.
 */
export interface PendingPassDoodleItem {
  id: string;
  doodleData: string;
}

/**
 * A pass-doodle PARENT: type PASS_DOODLE with passParentId=null. Parents,
 * whether still pending or already completed by a child, never sit in the
 * feed themselves — the CHILD (passParentId=parent.id) is what publishes.
 */
const passDoodleParentFilter = {
  type: "PASS_DOODLE" as const,
  passParentId: null,
};

/**
 * A pending sealed envelope claimable by the current device. Content is
 * deliberately omitted — it must be unlocked with the atomic claim call
 * (PATCH /api/capsules/[id] { action: "open" }), never SSR'd into HTML.
 */
export interface ClaimableSealedItem {
  id: string;
  createdAt: Date;
}

export interface DeskFeedResult {
  desk: Desk | null;
  capsules: CapsuleFeedItem[];
  sealedPendingCount: number;
  claimableSealed: ClaimableSealedItem | null;
  pendingPassDoodle: PendingPassDoodleItem | null;
}

/**
 * The caller's device identity as seen by the SSR path.
 * `hasIdentity` is true only when the browser presented the server-issued
 * `dl_device` cookie — a cookie-less visitor is anonymous and must not be
 * offered a sealed-envelope claim.
 */
export interface FeedDevice {
  hash: string;
  hasIdentity: boolean;
}

const FEED_SELECT = {
  id: true,
  type: true,
  authorAlias: true,
  textContent: true,
  doodleData: true,
  trackUrl: true,
  trackMetadata: true,
  passParentId: true,
  createdAt: true,
} as const;

function toFeedItem(c: {
  id: string;
  type: CapsuleFeedItem["type"];
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  trackUrl: string | null;
  trackMetadata: unknown;
  passParentId: string | null;
  createdAt: Date;
}): CapsuleFeedItem {
  return {
    id: c.id,
    type: c.type,
    authorAlias: c.authorAlias,
    textContent: c.textContent,
    doodleData: c.doodleData,
    trackUrl: c.trackUrl,
    trackMetadata: (c.trackMetadata as TrackMetadata | null) ?? null,
    passParentId: c.passParentId,
    createdAt: c.createdAt,
  };
}

/**
 * The newest pass-doodle PARENT for a desk that is still pending —
 * published, and with no child capsule yet (passChildren none). Returns
 * { id, doodleData } so the composer can offer it to the next occupant,
 * or null when nothing is waiting.
 */
export async function getPendingPassDoodle(
  deskId: string,
): Promise<PendingPassDoodleItem | null> {
  const parent = await prisma.capsule.findFirst({
    where: {
      deskId,
      status: "PUBLISHED",
      ...passDoodleParentFilter,
      passChildren: { none: {} },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, doodleData: true },
  });
  if (!parent || !parent.doodleData) return null;
  return { id: parent.id, doodleData: parent.doodleData };
}

/**
 * Load a desk + its published corkboard feed in a single call, sized for
 * SSR (<1.2s target). Every sealed capsule stays out of the feed —
 * including opened-but-never-pinned ones whose secret content is still
 * there; an envelope becomes public only when pinning explicitly sets
 * isSealed=false. sealedPendingCount exposes how many are unopened and
 * waiting so the wax-seal hint can render.
 *
 * When the device has an established cookie identity, exactly one pending
 * sealed envelope whose author is a DIFFERENT device is surfaced as
 * claimableSealed (PRD §3.3 P1: "the very next unique device that scans
 * the desk sees a wax-sealed envelope prompt"). The author scanning their
 * own desk sees nothing. Anonymous visitors (no cookie yet — identity is
 * minted on the first API POST, e.g. /api/sessions/start) get
 * claimableSealed = null; the sealedPendingCount banner still shows.
 */
export async function getDeskFeed(
  deskId: string,
  device?: FeedDevice,
): Promise<DeskFeedResult> {
  const none: DeskFeedResult = {
    desk: null,
    capsules: [],
    sealedPendingCount: 0,
    claimableSealed: null,
    pendingPassDoodle: null,
  };

  const desk = await prisma.desk.findUnique({
    where: { id: deskId },
  });

  if (!desk) {
    return none;
  }

  const sealedFilter = {
    isSealed: true,
    isOpened: false,
  };

  const pendingSealedWhere = {
    deskId,
    status: "PUBLISHED" as const,
    ...sealedFilter,
  };

  const [capsules, sealedPendingCount, pendingPassDoodle, claimable] = await Promise.all([
    prisma.capsule.findMany({
      where: {
        deskId,
        status: "PUBLISHED",
        // Exclude on isSealed alone: an OPENED sealed envelope whose secret
        // content is still unpublished must not leak to the public feed
        // either. Pinning (the only public path) explicitly unseals it.
        NOT: [{ isSealed: true }, passDoodleParentFilter],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: FEED_SELECT,
    }),
    prisma.capsule.count({
      where: pendingSealedWhere,
    }),
    getPendingPassDoodle(deskId),
    // Claimable envelope: only for devices with an established cookie
    // identity. Pending sealed, authored by someone else, newest wins.
    device && device.hasIdentity
      ? prisma.capsule.findFirst({
          where: { ...pendingSealedWhere, NOT: { deviceHash: device.hash } },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    desk,
    capsules: capsules.map(toFeedItem),
    sealedPendingCount,
    claimableSealed: claimable ? { id: claimable.id, createdAt: claimable.createdAt } : null,
    pendingPassDoodle,
  };
}
