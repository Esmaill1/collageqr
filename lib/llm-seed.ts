// lib/llm-seed.ts — seed content generation for the cold-start script.
// Optional LLM path (Gemini) with a deterministic hand-written fallback.

export type SeedNote = {
  text: string;
  alias: string;
};

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildPrompt(count: number): string {
  return `اكتب ${count} ملاحظة قصيرة (أقل من 160 حرف) باللهجة المصرية الجامعية، حكاي عن ملاحظة طالب تركها على ترابيزة في مكتبة الجامعة في تطبيق كبسولات الحكايات (DeskLore).

قواعد كل ملاحظة:
- 160 حرف على الأكثر. نص عادي بس.
- ممنوع روابط، أرقام تليفون، حسابات سوشيال، أو أسماء حقيقية لمحاضرين أو زمايل.
- ممنوع أي كلام بذيء أو فظ.
- مزيج من: تشجيع حلوة، كوميديا خفيفة، ووصف لأجواء المكتبة (مثلاً "التكييف هنا بيجمّد"، "ضوء الشمس الساعة 4 هنا حلو جدًا").
- كل ملاحظة معاها اسم مستعار قصير ومهضوم لصاحبها (مثلاً "شبح الرسالة"، "كبير جامدة"، "نائم سنة أولى"). أقصى 40 حرف.

رجّع JSON صارم وبس: مصفوفة فيها بالظبط ${count} كائن على الشكل {"text": "...", "alias": "..."}. من غير علامات ماركداون ومن غير أي كلام زيادة.`;
}

const SAFETY_PROMPT =
  "أنت بتولّد محتوى لطيف وودود لتطبيق مذاكرة لطلبة جامعة. رجّع بس مصفوفة JSON الصارمة اللي اتطلبت. كل ملاحظة أقصى 160 حرف وباللهجة المصرية الجامعية، نص عادي، بدون روابط، بدون كلام بذيء، وبدون أسماء حقيقية.";

export const FALLBACK_POOL: SeedNote[] = [
  { text: "نوّرت يا صاحبي. خدها فقرة فقرة وهتخلص بإذن الله.", alias: "مجهول" },
  { text: "التكييف هنا بيجمّد. هات بلوظ.", alias: "كبير جامدة" },
  { text: "أحسن ترابيزة في الدور ده. متقولش لحد.", alias: "حارس B14" },
  { text: "لو بتقرا الكلام ده، خد نفس عميق. إنت ماشي تمام يا بطل.", alias: "واحد هادي" },
  { text: "في حد بكى هنا قبل كده وكمان عدّى. إنت برضو هتعدي.", alias: "أسطورة الترابيزة" },
  { text: "شمس الساعة 4 على الترابيزة دي حاجة تانية خالص. ظبّط بريكك عليها.", alias: "صائد الشمس" },
  { text: "خلّصت ملخّص الرسالة هنا. دورك دلوقتي تعمل حاجة عظيمة.", alias: "شبح الرسالة" },
  { text: "رِجل الترابيزة بتهتز شوية. اعتبرها تحدي تركيز صغيرون.", alias: "محترف الترابيزة الهزّوتة" },
  { text: "الفيشة تحت الترابيزة دي غيّرت حياتي. لو لقيتها، سيبها لغيرك زي ما سيبوها ليك.", alias: "مشحون ومشكور" },
  { text: "ناجين نصفي الترم قعدوا على الترابيزة دي. إحنا خلصنا، وإنت كمان هتخلص.", alias: "الناجي دفعة '26" },
  { text: "خد نصيحة: شيل الموبايل بعيد، خد القهوة في إيدك، وعِش عشر تنفّسات عميق. يلا يا معلم.", alias: "غريب مؤدب" },
  { text: "الترابيزة دي سمعت تنهات أكتر من مكتب دكتور نفسي. كمّل يا صاحبي.", alias: "زميل التنهات" },
  { text: "سيبتلك بومودورو واحد هنا. ده بتاعك. صرّفه صح.", alias: "مورد التركيز" },
  { text: "اللي قعد قبلك مُؤمن فيك. بس ما قالهاش بصوت عالي.", alias: "المؤمن الصامت" },
  { text: "ذاكرت هنا وأنا بقلب مكسور. الترابيزة دي أقوى من شكلها، وإنت كمان أقوى من شكلك.", alias: "عاشق مثابر" },
  { text: "ضوء طبيعي جميل هنا. الكتب بتبقى 30% أكتر حلوة من نور الشمس.", alias: "طالب الوقت الذهبي" },
  { text: "في مكان ما، فيه ديدلاين بيخاف منك دلوقتي.", alias: "شبح الديدلاين" },
  { text: "أهلًا بيك. نفس الكرسي، فصل جديد. خليها تعدّ حلوة.", alias: "اللي قبلك" },
  { text: "ضاع قلمي هنا. لو لقيته، ده بتاعك ومعاه شوية حظ فكة.", alias: "مُتبرّع القلم" },
  { text: "الترابيزة دي طلّعت 3 معدلات كويسة. ضيف معدلك للعيلة.", alias: "أبو معدلات" },
  { text: "حمامة بصّت لي من الشباك ده وحكمت عليّا. اعمل أحسن مني يا صاحبي.", alias: "شاهد الحمام" },
  { text: "ركز عشرين دقيقة. إنت المستقبلي هيشكرك مقدمًا.", alias: "أنت (بعدين)" },
  { text: "الترابيزة دي بتهمس مع أرواح اللي سهرت عليها. أرواح مهذبة وبتساعد.", alias: "وسيط الأرواح" },
  { text: "لو وقفت ماتعرفش تكتب إيه، اكتب جملة شكلها وحش. الجمل الوحشة بتبقى مقالات حلوة في الآخر.", alias: "مدرب الجمل الوحشة" },
  { text: "المكينة في الدور ده بتبلع فلوس. جهّز فلوس مضبوطة وشوية جرأة.", alias: "جندي المكينة" },
  { text: "منطقة هدوء. سيب دماغك هو الأعلى صوت هنا.", alias: "محب السكوت" },
  { text: "الفصل الخامس بيكره كل الناس. ماتاخدهاش عليك شخصيًا.", alias: "ناجي الفصل الخامس" },
  { text: "قعدت هنا وناري عالي وديدلاين بيلحقني. الترابيزة شالت مني شوية من الوجع.", alias: "خريج الحمّى" },
  { text: "في خربشة صغيرة في خشب الترابيزة شبه قطّة. دي بقى صاحبتك في المذاكرة.", alias: "مكتشف قطة الخشب" },
  { text: "لما توصل الكلام ده، امتحاني يكون خلص خلاص. واحد منا الاتنين حر دلوقتي.", alias: "الطالب الهارب" },
];

// Sealed-envelope messages (English originals live in scripts/seed.ts, which is
// outside this file's edit scope; the translated pool is exported here so the
// seed script can switch to it in a later wave).
export const SEALED_POOL: string[] = [
  "افتحني بس لو كنت اللي هيقعد هنا بعدي. — اللي قبلك",
  "شِش — في فيشة كويسة تحت الترابيزة دي. سلّمها للي بعدك.",
  "سر صغير: مكينة البيع في الدور ده بتقبل حتى العملات الحزينة.",
  "الترابيزة دي استضافت سهر ليلة كاملة خلص بامتحان عدّى. شوية حظ ساكن في خشبها.",
  "لو النهاردة تقيل عليك، خبّي السر لحد قهوتك التانية. افتح بعدها.",
  "محجوز للروح الشجاعة الجاية. جوّاها: كلمة تشجيع مش رسمية أبدًا.",
  "تحذير: المحتويات ممكن تعمل إحساس مايتحكمش فيه بإنك 'هتقدر'.",
  "سيبت حاجة للي كان محتاجها أكتر. يا رب دي تكون انت.",
];

/** Compatibility export for older scripts; pilot seeding is fully local. */
export const PILOT_SEALED_POOL = SEALED_POOL;

// Deterministic-enough shuffle for seed variety.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  }
  return s.trim();
}

function parseNotes(json: string, count: number): SeedNote[] | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    const notes: SeedNote[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const { text, alias } = item as { text?: unknown; alias?: unknown };
      if (typeof text !== "string" || typeof alias !== "string") continue;
      if (text.length === 0 || text.length > 160) continue;
      if (alias.length === 0 || alias.length > 40) continue;
      notes.push({ text, alias });
      if (notes.length >= count) break;
    }
    return notes.length >= Math.min(count, 5) ? notes : null;
  } catch {
    return null;
  }
}

export async function generateSeedNotes(count: number): Promise<SeedNote[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(count) }] }],
          systemInstruction: { parts: [{ text: SAFETY_PROMPT }] },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no text");
      const notes = parseNotes(stripFences(text), count);
      if (notes) return notes;
    } catch {
      // fall through to template pool
    }
  }
  return shuffle(FALLBACK_POOL).slice(0, count);
}

// ---------------------------------------------------------------------------
// Procedural 1-bit doodles
//
// Encoding (must match PixelCanvas / CapsuleCard):
//   - canvas: 128 x 64, 1 bit per pixel
//   - 1024 bytes total (16 bytes per row = 128/8)
//   - byte index  = row * 16 + (col >> 3)
//   - bit within byte = col & 7  (bit set = ink)
//   - stored as base64 of the raw 1024-byte buffer
// ---------------------------------------------------------------------------

const CANVAS_BYTES_PER_ROW = 16; // 128 / 8
const CANVAS_BYTES = 1024; // 16 * 64

export type DoodleKind = "smiley" | "heart" | "star" | "arrow" | "wave";

function setBit(buf: Uint8Array, col: number, row: number): void {
  if (col < 0 || col >= 128 || row < 0 || row >= 64) return;
  const idx = row * CANVAS_BYTES_PER_ROW + (col >> 3);
  buf[idx] = buf[idx] | (1 << (col & 7));
}

function toBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i += 4096) {
    const chunk = buf.subarray(i, Math.min(i + 4096, buf.length));
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

function circle(buf: Uint8Array, cx: number, cy: number, r: number, fill = false): void {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (fill) {
        if (d2 <= r2) setBit(buf, x, y);
      } else if (d2 <= r2 && d2 > (r - 1.6) * (r - 1.6)) {
        setBit(buf, x, y);
      }
    }
  }
}

function line(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    setBit(buf, Math.round(x0 + t * (x1 - x0)), Math.round(y0 + t * (y1 - y0)));
  }
}

function drawSmiley(buf: Uint8Array): void {
  circle(buf, 64, 32, 18); // face outline
  circle(buf, 56, 25, 2, true); // left eye
  circle(buf, 72, 25, 2, true); // right eye
  // smile: lower arc of an auxiliary circle
  const sr = 13;
  for (let x = 51; x <= 77; x++) {
    const dx = x - 64;
    const y = 28 + Math.round(Math.sqrt(Math.max(0, sr * sr - dx * dx)));
    setBit(buf, x, y);
  }
}

function drawHeart(buf: Uint8Array): void {
  // Simple heart: two circles + two diagonals forming the point.
  circle(buf, 57, 26, 7);
  circle(buf, 71, 26, 7);
  line(buf, 50, 31, 64, 48);
  line(buf, 78, 31, 64, 48);
}

function drawStar(buf: Uint8Array): void {
  const cx = 64;
  const cy = 33;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 19 : 8;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  for (let i = 0; i < 10; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % 10];
    line(buf, p[0], p[1], q[0], q[1]);
  }
}

function drawArrow(buf: Uint8Array): void {
  const shaftY = 32;
  const shaftStart = 35;
  const headBase = 80;
  const tip = 93;
  // shaft
  for (let x = shaftStart; x <= headBase; x++) {
    setBit(buf, x, shaftY);
    setBit(buf, x, shaftY + 1);
  }
  // head
  line(buf, headBase, shaftY - 13, tip, shaftY);
  line(buf, headBase, shaftY + 13, tip, shaftY);
  line(buf, headBase, shaftY - 13, headBase, shaftY + 13);
}

function drawWave(buf: Uint8Array): void {
  for (let x = 8; x <= 120; x++) {
    const y = 32 + Math.round(11 * Math.sin(((x - 8) / 112) * Math.PI * 2));
    setBit(buf, x, y);
    setBit(buf, x, y + 1);
  }
}

export function generateProceduralDoodle(kind: DoodleKind): string {
  const buf = new Uint8Array(CANVAS_BYTES);
  switch (kind) {
    case "smiley":
      drawSmiley(buf);
      break;
    case "heart":
      drawHeart(buf);
      break;
    case "star":
      drawStar(buf);
      break;
    case "arrow":
      drawArrow(buf);
      break;
    case "wave":
      drawWave(buf);
      break;
  }
  return toBase64(buf);
}
