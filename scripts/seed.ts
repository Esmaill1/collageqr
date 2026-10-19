// Run with: npm run db:seed (Prisma loads DATABASE_URL from .env)
//
// Cold-start seed: pre-populates desks B01–B30 with two text capsules each
// (one public note and one sealed note) so the first student to scan a desk
// immediately receives a message from a previous occupant.
//
// Safe to re-run: seed-owned capsules are reconciled per desk while real user
// capsules are preserved. The content is checked in and deterministic, so the
// pilot does not require Gemini or any other network service.

import { PrismaClient } from "@prisma/client";
import { FALLBACK_POOL, SEALED_POOL } from "../lib/llm-seed";

const prisma = new PrismaClient();

const DESK_IDS = Array.from({ length: 30 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`);

function zoneFor(deskId: string): string {
  const n = parseInt(deskId.slice(1), 10);
  if (n <= 10) return "2nd Floor — Quiet Zone"; // B01–B10
  if (n <= 20) return "3rd Floor — Study Hall"; // B11–B20
  return "Ground Floor — Lounge"; // B21–B30
}

function deskIndex(deskId: string): number {
  return parseInt(deskId.slice(1), 10) - 1;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      "Missing DATABASE_URL. Add it to .env (or export it inline), then re-run:\n" +
        '  DATABASE_URL="postgresql://..." npx tsx scripts/seed.ts'
    );
    process.exit(1);
  }

  try {
    console.log("Loading deterministic local seed content...");
    let desksSeeded = 0;
    let capsulesCreated = 0;

    for (const deskId of DESK_IDS) {
      const i = deskIndex(deskId);
      await prisma.desk.upsert({
        where: { id: deskId },
        update: {},
        create: {
          id: deskId,
          zoneName: zoneFor(deskId),
          totalMinutes: 0,
          level: 1,
          tagCounts: {},
        },
      });

      const deviceHash = `seed-${deskId}`;
      const note = FALLBACK_POOL[i % FALLBACK_POOL.length];
      const sealedMessage = SEALED_POOL[i % SEALED_POOL.length];
      const noteId = `seed-${deskId.toLowerCase()}-note`;
      const sealedId = `seed-${deskId.toLowerCase()}-sealed`;

      await prisma.$transaction(async (tx) => {
        const oldSeedRows = await tx.capsule.findMany({
          where: { deskId, deviceHash },
          select: { id: true },
        });
        const oldSeedIds = oldSeedRows.map((row) => row.id);
        if (oldSeedIds.length > 0) {
          await tx.report.deleteMany({ where: { capsuleId: { in: oldSeedIds } } });
          await tx.capsule.deleteMany({ where: { id: { in: oldSeedIds } } });
        }

        await tx.capsule.create({
          data: {
            id: noteId,
            deskId,
            type: "TEXT",
            authorAlias: note.alias,
            textContent: note.text,
            status: "PUBLISHED",
            deviceHash,
          },
        });
        await tx.capsule.create({
          data: {
            id: sealedId,
            deskId,
            type: "SEALED",
            authorAlias: "DeskLore Seed",
            textContent: sealedMessage,
            isSealed: true,
            isOpened: false,
            status: "PUBLISHED",
            deviceHash,
          },
        });
      });

      desksSeeded++;
      capsulesCreated += 2;
      console.log(`  ${deskId}: seeded — public note, sealed note`);
    }

    console.log(`\nSeeded ${desksSeeded} desks, ${capsulesCreated} capsules.`);
    console.log("Seed-owned rows use device_hash seed-<desk> and are safe to reconcile on reruns.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\nCould not connect to the database. Is DATABASE_URL set and reachable?");
    if (message.length > 0) console.error(`Details: ${message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
