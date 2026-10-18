// Run with: DATABASE_URL="postgresql://..." npx tsx scripts/seed.ts
//
// Cold-start seed: pre-populates desks B01–B30 with 3 capsules each (note,
// doodle, sealed envelope) so the first student to scan a desk gets the full
// DeskLore experience (PRD §7).
//
// Idempotent: upserts desks, and only creates capsules for a desk that has
// none. Safe to re-run. All seed capsules carry "Seed" in the author alias
// for easy cleanup.

import { PrismaClient } from "@prisma/client";
import {
  generateSeedNotes,
  generateProceduralDoodle,
  type DoodleKind,
} from "../lib/llm-seed";

const prisma = new PrismaClient();

const DESK_IDS = Array.from({ length: 30 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`);

function zoneFor(deskId: string): string {
  const n = parseInt(deskId.slice(1), 10);
  if (n <= 10) return "2nd Floor — Quiet Zone"; // B01–B10
  if (n <= 20) return "3rd Floor — Study Hall"; // B11–B20
  return "Ground Floor — Lounge"; // B21–B30
}

// Deterministic tag variety: cycle three flavors across desks.
const TAG_VARIANTS: Record<string, number>[] = [{ outlet: 1 }, { cold_ac: 1 }, {}];

function tagCountsFor(deskId: string): Record<string, number> {
  return TAG_VARIANTS[parseInt(deskId.slice(1), 10) % TAG_VARIANTS.length];
}

const SEALED_POOL = [
  "Open me only if you're the next to sit here. — The one before you",
  "Psst — there's a good outlet under this desk. Pass it on.",
  "A tiny secret: the vending machine on this floor even accepts sad coins.",
  "This desk once hosted an all-nighter that aced the exam. Some luck lives in the wood.",
  "If today feels heavy, save this for after your second coffee. Then open.",
  "Reserved for the next brave soul. Inside: one unofficial pep talk.",
  "Warning: contents may cause uncontrollable feelings of 'you've got this'.",
  "Left something for whoever needed it most. Hopefully that's you.",
];

const DOODLE_KINDS: DoodleKind[] = ["smiley", "heart", "star", "arrow", "wave"];

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
    console.log("Generating seed notes (Gemini if GEMINI_API_KEY is set, template pool otherwise)...");
    const notes = await generateSeedNotes(30);

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
          tagCounts: tagCountsFor(deskId),
        },
      });

      const existing = await prisma.capsule.count({ where: { deskId } });
      if (existing > 0) {
        console.log(`  ${deskId}: ${existing} capsule(s) already present, skipping.`);
        continue;
      }

      const kind = DOODLE_KINDS[i % DOODLE_KINDS.length];
      const deviceHash = `seed-${deskId}`;
      const note = notes[i % notes.length];
      const sealedMessage = SEALED_POOL[i % SEALED_POOL.length];

      await prisma.$transaction([
        prisma.capsule.create({
          data: {
            deskId,
            type: "TEXT",
            authorAlias: note.alias,
            textContent: note.text,
            status: "PUBLISHED",
            deviceHash,
          },
        }),
        prisma.capsule.create({
          data: {
            deskId,
            type: "DOODLE",
            authorAlias: "DeskLore Seed",
            doodleData: generateProceduralDoodle(kind),
            status: "PUBLISHED",
            deviceHash,
          },
        }),
        prisma.capsule.create({
          data: {
            deskId,
            type: "SEALED",
            authorAlias: "DeskLore Seed",
            textContent: sealedMessage,
            isSealed: true,
            isOpened: false,
            status: "PUBLISHED",
            deviceHash,
          },
        }),
      ]);

      desksSeeded++;
      capsulesCreated += 3;
      console.log(`  ${deskId}: seeded — note, ${kind} doodle, sealed envelope`);
    }

    console.log(`\nSeeded ${desksSeeded} desks, ${capsulesCreated} capsules.`);
    console.log("All seed capsules have 'Seed' in their author alias so they're easy to find and clean up.");
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
