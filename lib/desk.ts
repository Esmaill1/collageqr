/**
 * Desk XP / progression system. 1 focus minute = 1 XP.
 * Named anchors come from PRD §3.1; intermediate levels are labelled with
 * a cohesive "desk evolution" theme and reached via a gently eased curve
 * so early levels feel rewarding.
 */
export interface LevelAnchor {
  level: number;
  xp: number;
  label: string;
}

export const LEVELS: LevelAnchor[] = [
  { level: 1, xp: 0, label: "Rookie Wooden Chair" },
  { level: 5, xp: 300, label: "Quiet Corner Spot" },
  { level: 15, xp: 1000, label: "Scholar's Hideout" },
  { level: 50, xp: 5000, label: "Hallowed Shrine of Lock-In" },
];

const FULL_LABELS: string[] = [
  /*  1 */ "Rookie Wooden Chair",
  /*  2 */ "Fresh Plywood Perch",
  /*  3 */ "Sturdy Study Stool",
  /*  4 */ "Well-Worn Bench",
  /*  5 */ "Quiet Corner Spot",
  /*  6 */ "Draft-Free Corner",
  /*  7 */ "Window-Light Ledge",
  /*  8 */ "Cornered Scholar's Seat",
  /*  9 */ "Reading Nook Regular",
  /* 10 */ "Sunlit Study Spot",
  /* 11 */ "Afternoon Alcove",
  /* 12 */ "Cozy Sanctuary",
  /* 13 */ "Motivated Maven's Seat",
  /* 14 */ "Deep-Focus Den",
  /* 15 */ "Scholar's Hideout",
  /* 16 */ "Second-Home Chair",
  /* 17 */ "Midnight Marathon Spot",
  /* 18 */ "Caffeine-Fueled Corner",
  /* 19 */ "Finals-Week Den",
  /* 20 */ "All-Nighter Alcove",
  /* 21 */ "Legend of the West Wing",
  /* 22 */ "Study Group HQ",
  /* 23 */ "Deadline Slayer's Desk",
  /* 24 */ "Markdown Maven's Chair",
  /* 25 */ "Exam-Season Anchor",
  /* 26 */ "Essay Engine Bench",
  /* 27 */ "Thesis-Tackling Table",
  /* 28 */ "Refill-Cup Corner",
  /* 29 */ "Resident Genius Seat",
  /* 30 */ "Note-Taking Nobility",
  /* 31 */ "Marathon Mind's Chair",
  /* 32 */ "Dean's Silent Favorite",
  /* 33 */ "Freshman-Folklore Spot",
  /* 34 */ "Term-Paper Throne",
  /* 35 */ "Coffee-Stained Classic",
  /* 36 */ "Midnight-Oil Memorial",
  /* 37 */ "Study Sage's Seat",
  /* 38 */ "Chapter-and-Verse Chair",
  /* 39 */ "Peer-Tutor Landmark",
  /* 40 */ "Cum-Laude Corner",
  /* 41 */ "Lodge of Long Readings",
  /* 42 */ "Semester Stalwart Seat",
  /* 43 */ "Quiet-Hours Guardian",
  /* 44 */ "The Undisturbed Alcove",
  /* 45 */ "Sanctum of Silence",
  /* 46 */ "Ancient Armchair of A+'s",
  /* 47 */ "Warden of Wisdom",
  /* 48 */ "Keeper-of-Notes Chair",
  /* 49 */ "The Final Frontier Bench",
  /* 50 */ "Hallowed Shrine of Lock-In",
];

/**
 * Map total focus minutes (XP) to a desk level.
 *
 * Within each segment between named anchors, the level progresses along a
 * gentle power curve (t^0.7) — faster early in a segment so players unlock
 * new titles quickly, then a longer climb toward the next anchor.
 * Capped at the top anchor's level (50).
 */
export function levelFromMinutes(minutes: number): number {
  const xp = Math.max(0, Math.floor(minutes));

  if (xp >= LEVELS[LEVELS.length - 1].xp) {
    return LEVELS[LEVELS.length - 1].level;
  }

  let anchor = LEVELS[0];
  let next = LEVELS[LEVELS.length - 1];

  for (let i = 0; i < LEVELS.length - 1; i++) {
    if (xp >= LEVELS[i].xp && xp < LEVELS[i + 1].xp) {
      anchor = LEVELS[i];
      next = LEVELS[i + 1];
      break;
    }
  }

  const t = (xp - anchor.xp) / (next.xp - anchor.xp);
  return anchor.level + Math.floor((next.level - anchor.level) * Math.pow(t, 0.7));
}

/**
 * Map a level number (clamped to [1, 50]) to its desk title from FULL_LABELS.
 */
export function levelLabel(level: number): string {
  const clamped = Math.min(50, Math.max(1, Math.floor(level)));
  return FULL_LABELS[clamped - 1];
}
