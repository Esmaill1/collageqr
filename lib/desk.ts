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
  { level: 1, xp: 0, label: "كرسي الخشب الجديد" },
  { level: 5, xp: 300, label: "ركنة هادية" },
  { level: 15, xp: 1000, label: "خروجة الدلع بتاعة الكلية" },
  { level: 50, xp: 5000, label: "حارة القُفْل الأثرية" },
];

const FULL_LABELS: string[] = [
  /*  1 */ "كرسي الخشب الجديد",
  /*  2 */ "قعدة الخشب المضغوط",
  /*  3 */ "الكرسي القوي بتاع المذاكرة",
  /*  4 */ "الدكة اللي اتراحت عليها كتير",
  /*  5 */ "ركنة هادية",
  /*  6 */ "الزاوية اللي مفيش فيها هوا بيلعب",
  /*  7 */ "الرف اللي بيشوف الشمس",
  /*  8 */ "قعدة الزاوية بتاعة اللي بيمذاكر بجد",
  /*  9 */ "زبون ركنة القراية الدائم",
  /* 10 */ "قعدة المذاكرة في ضو الشمس",
  /* 11 */ "ركنة الضهر",
  /* 12 */ "الحضن الدافي",
  /* 13 */ "قعدة اللي شغّال",
  /* 14 */ "عش التركيز العميق",
  /* 15 */ "خروجة الدلع بتاعة الكلية",
  /* 16 */ "كرسي البيت التاني",
  /* 17 */ "قعدة الماراثون بتاعة نص الليل",
  /* 18 */ "ركن القهوة اللي شغّالة",
  /* 19 */ "عش أسبوع الامتحانات",
  /* 20 */ "ركن السهر لحد الصبح",
  /* 21 */ "أسطورة الجناح الغربي",
  /* 22 */ "قاعدة شلة المذاكرة",
  /* 23 */ "مكتب بطل الديدلاين",
  /* 24 */ "كرسي بطل الماركداون",
  /* 25 */ "مرساة موسم الامتحانات",
  /* 26 */ "دكة محرك البرجراف",
  /* 27 */ "طرابيزة مقاتلة الرسالة",
  /* 28 */ "ركن الكوباية اللي بتتعبّي",
  /* 29 */ "قعدة اللي دماغه عالية",
  /* 30 */ "نبلاء التدوين",
  /* 31 */ "كرسي دماغ الماراثون",
  /* 32 */ "المفضل الصامت بتاع العميد",
  /* 33 */ "قعدة حكايات السنة الأولى",
  /* 34 */ "عرش بحث الترم",
  /* 35 */ "الكلاسيك اللي كلها بقع قهوة",
  /* 36 */ "نصب سهر الليل",
  /* 37 */ "قعدة شيخ المذاكرة",
  /* 38 */ "كرسي اللي حافظ آية آية",
  /* 39 */ "معلم شرح الزمايل",
  /* 40 */ "ركنة الشرف",
  /* 41 */ "عش القراية الطويلة",
  /* 42 */ "كرسي صامد الترم",
  /* 43 */ "حارس ساعات الهدوء",
  /* 44 */ "الركنة اللي ماحدش بيقلقها",
  /* 45 */ "محراب السكوت",
  /* 46 */ "الكرسي العتيق بتاع الامتياز",
  /* 47 */ "خفير الحكمة",
  /* 48 */ "كرسي حارس الملاحظات",
  /* 49 */ "دكة الحد الأخير",
  /* 50 */ "حارة القُفْل الأثرية",
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
