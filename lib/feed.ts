import { prisma } from "@/lib/db";
import type { Desk } from "@prisma/client";

/** Metadata kept for dormant future artifact types. */
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
  reportCount: number;
  status: "PUBLISHED";
  createdAt: Date;
}

/**
 * A pending sealed envelope claimable by the current device. Content is
 * deliberately omitted — it must be unlocked with the atomic claim call
 * (PATCH /api/capsules/[id] { action: "open" }), never SSR'd into HTML.
 */
export interface ClaimableSealedItem {
  id: string;
  createdAt: Date;
}

/** An envelope already opened by this device but not yet pinned or deleted. */
export interface OpenedSealedItem {
  id: string;
  createdAt: Date;
}

export interface DeskFeedResult {
  desk: Desk | null;
  capsules: CapsuleFeedItem[];
  sealedPendingCount: number;
  claimableSealed: ClaimableSealedItem | null;
  openedSealed: OpenedSealedItem | null;
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
  reportCount: true,
  status: true,
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
  reportCount: number;
  status: string;
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
    reportCount: c.reportCount,
    status: "PUBLISHED",
    createdAt: c.createdAt,
  };
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
    openedSealed: null,
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
    type: "SEALED" as const,
    ...sealedFilter,
  };

  const [capsules, sealedPendingCount, claimable, opened] = await Promise.all([
    prisma.capsule.findMany({
      where: {
        deskId,
        status: "PUBLISHED",
        type: { in: ["TEXT", "SEALED"] },
        // Exclude on isSealed alone: an OPENED sealed envelope whose secret
        // content is still unpublished must not leak to the public feed
        // either. Pinning (the only public path) explicitly unseals it.
        NOT: [{ isSealed: true }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: FEED_SELECT,
    }),
    prisma.capsule.count({
      where: pendingSealedWhere,
    }),
    // Claimable envelope: only for devices with an established cookie
    // identity. Pending sealed, authored by someone else, newest wins.
    device && device.hasIdentity
      ? prisma.capsule.findFirst({
          where: { ...pendingSealedWhere, NOT: { deviceHash: device.hash } },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        })
      : Promise.resolve(null),
    device && device.hasIdentity
      ? prisma.capsule.findFirst({
          where: {
            deskId,
            status: "PUBLISHED",
            type: "SEALED",
            isSealed: true,
            isOpened: true,
            openedByDeviceHash: device.hash,
          },
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
    openedSealed: opened ? { id: opened.id, createdAt: opened.createdAt } : null,
  };
}
