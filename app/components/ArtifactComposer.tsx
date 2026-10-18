"use client";

import { useEffect, useState } from "react";
import PixelCanvas from "@/app/components/PixelCanvas";
import CassetteInput from "@/app/components/CassetteInput";
import BadgePicker from "@/app/components/BadgePicker";
import PassDoodleCanvas from "@/app/components/PassDoodleCanvas";
import { isValidHttpUrl } from "@/app/components/trackUrl";
import { stripUrls } from "@/lib/text";

const TEXT_MAX_CHARS = 160;
const ALIAS_MAX_CHARS = 40;

type ComposerMode = "TEXT" | "DOODLE" | "SONG" | "PASS";

export interface CapsuleDto {
  id: string;
  deskId: string;
  type: string;
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  passParentId?: string | null;
  createdAt: string;
}

export interface ArtifactComposerProps {
  deskId: string;
  signingToken: string;
  onPublished: (capsule: CapsuleDto) => void;
  onCancel: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-request": "لينك الأغنية ده شكله مش مظبوط — الصق لينك https:// كامل.",
  "invalid-token": "توكن التوقيع بتاعك انتهى. خلّص جلسة تركيز تانية.",
  "session-not-found": "مش لاقيين الجلسة. خلّص جلسة تركيز جديدة.",
  "session-not-completed": "جلسة التركيز بتاعتك لسه مخلصتش.",
  "token-used": "التوكن ده اتستخدم قبل كده — أثر واحد في كل جلسة.",
  "empty-capsule": "اكتب ملاحظة أو الصق لينك الأغنية الأول.",
  "text-too-long": "الملاحظة أطول من 160 حرف.",
  "doodle-too-large": "الرسمة كبيرة أوي.",
  "alias-too-long": "الاسم أطول من 40 حرف.",
  // Pass-the-Doodle continuation errors (Wave 6):
  "already-continued": "حد خلّصها دلوقتي — عيد تحميل الصفحة.",
  "parent-not-found": "الرسمة اللي كان سيبها راحت. اعمل ريفرِش وحاول تاني.",
};

function friendlyType(type: string): string {
  if (type === "DOODLE") return "رسمتك";
  if (type === "CASSETTE") return "أغنيتك";
  if (type === "SEALED") return "ملاحظتك المختومة للي بعدك";
  if (type === "PASS_DOODLE") return "رسمتك";
  return "ملاحظتك";
}

/**
 * Post-focus creation sheet (PRD §3.3): Text Note, 1-Bit Pixel Doodle (P0),
 * Desk Cassette + Sealed Envelope (P1), Pass-the-Doodle (P2). Displays after
 * the focus timer hands back the signing token; submits once and then the
 * token is consumed server-side. Also hosts the P1 physical-spot badge
 * ratings, which do not consume the token.
 */
export default function ArtifactComposer({
  deskId,
  signingToken,
  onPublished,
  onCancel,
}: ArtifactComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("TEXT");
  const [text, setText] = useState("");
  const [doodleData, setDoodleData] = useState<string | null>(null);
  const [trackUrl, setTrackUrl] = useState("");
  const [sealed, setSealed] = useState(false);
  const [alias, setAlias] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<CapsuleDto | null>(null);

  // Pass-the-Doodle state (P2). On tab activation the composer checks for a
  // pending half-doodle; continue vs start mode is decided by the result.
  const [passChecked, setPassChecked] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passPending, setPassPending] = useState<{ id: string; doodleData: string } | null>(null);
  const [passMerged, setPassMerged] = useState<string | null>(null);
  const [passTopHalf, setPassTopHalf] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "PASS" || passChecked || passLoading) return;
    setPassLoading(true);
    fetch(`/api/desks/${encodeURIComponent(deskId)}/pass-doodle`)
      .then((res) => (res.ok ? res.json() : { pending: null }))
      .then((data: { pending?: { id: string; doodleData: string } | null }) => {
        setPassPending(
          data.pending && data.pending.id && typeof data.pending.doodleData === "string"
            ? { id: data.pending.id, doodleData: data.pending.doodleData }
            : null,
        );
      })
      .catch(() => setPassPending(null))
      .finally(() => {
        setPassLoading(false);
        setPassChecked(true);
      });
  }, [mode, passChecked, passLoading, deskId]);

  const passMode: "continue" | "start" = passPending ? "continue" : "start";

  const cleanedText = stripUrls(text);
  const trimmedUrl = trackUrl.trim();
  const canSubmit =
    !submitting &&
    (mode === "TEXT"
      ? cleanedText.length > 0
      : mode === "DOODLE"
        ? doodleData !== null
        : mode === "SONG"
          ? isValidHttpUrl(trimmedUrl)
          : passMode === "continue"
            ? passMerged !== null
            : passTopHalf !== null);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    type ApiError = { error?: string };
    const readError = async (res: Response): Promise<string> => {
      const data = (await res.json().catch(() => null)) as ApiError | null;
      return (
        (data?.error && ERROR_MESSAGES[data.error]) ||
        `مش قادرين نثبّت أثرك (${res.status}). حاول تاني.`
      );
    };

    try {
      // Pass-doodle CONTINUATION: finish someone else's half-doodle.
      if (mode === "PASS" && passMode === "continue" && passPending) {
        const res = await fetch(`/api/capsules/${encodeURIComponent(passPending.id)}/continue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: signingToken, doodleData: passMerged }),
        });
        if (!res.ok) {
          setError(await readError(res));
          setSubmitting(false);
          return;
        }
        const data = (await res.json()) as { capsule: CapsuleDto };
        setPublished(data.capsule);
        onPublished(data.capsule);
        return;
      }

      const body: Record<string, unknown> = { sessionToken: signingToken };
      if (mode === "TEXT" && cleanedText.length > 0) body.textContent = cleanedText;
      if (mode === "DOODLE" && doodleData) body.doodleData = doodleData;
      if (mode === "SONG") body.trackUrl = trimmedUrl;
      if (mode === "TEXT" && sealed) body.isSealed = true;
      if (mode === "PASS" && passTopHalf) {
        body.doodleData = passTopHalf;
        body.isPassDoodle = true;
      }
      if (alias.trim()) body.authorAlias = alias.trim();

      const res = await fetch("/api/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(await readError(res));
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { capsule: CapsuleDto };
      setPublished(data.capsule);
      onPublished(data.capsule);
    } catch {
      setError("النت وقع — ملاحظتك مّوصلتش. حاول تاني.");
      setSubmitting(false);
    }
  };

  if (published) {
    const passChild = published.type === "PASS_DOODLE" && published.passParentId != null;
    return (
      <section className="border border-accent p-4" aria-live="polite">
        <p className="text-sm font-bold text-accent">
          {published.type === "SEALED"
            ? "ملاحظتك المختومة مستنّية اللي بعدك."
            : published.type === "PASS_DOODLE" && !passChild
              ? "نصّك اتثبّت — مترقّب اللي يكمّله بعدك."
              : published.type === "PASS_DOODLE" && passChild
                ? "الرسمة اكتملت! اتنين رسّاموا، لوحة واحدة."
                : `اتثبّت على ترابيزة ${published.deskId}!`}
        </p>
        <p className="mt-1 text-xs opacity-70 text-ink">
          {published.type === "SEALED"
            ? "هتفضل مخبوحة لحد ما حد يلتقط كود الترابيزة دي."
            : published.type === "PASS_DOODLE" && !passChild
              ? "اللي هيلتقط الكود بعدك يرسم النص السفلي، وساعتها رسمتك الكاملة تظهر للكل."
              : `طلع فوق وشوف ${friendlyType(published.type)} فوق في اللوح.`}
        </p>
      </section>
    );
  }

  const tabButton = (value: ComposerMode, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setMode(value)}
      className={
        mode === value
          ? "border border-accent px-3 py-1.5 text-sm font-bold text-accent"
          : "border border-ink px-3 py-1.5 text-sm opacity-70 text-ink"
      }
    >
      {label}
    </button>
  );

  return (
    <section className="border border-ink p-4" aria-label="سيب أثرك">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">
          سيب أثرك على ترابيزة {deskId}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs opacity-60 text-ink"
        >
          اغلق
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tabButton("TEXT", "ملاحظة")}
        {tabButton("DOODLE", "رسمة")}
        {tabButton("SONG", "أغنية 🎵")}
        {tabButton("PASS", "باص-الرسمة ✏️")}
      </div>

      {mode === "TEXT" ? (
        <>
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={TEXT_MAX_CHARS}
              rows={4}
              placeholder={sealed ? "عايز بس اللي بعدك يقرأ إيه؟" : "الترابيزة دي شكلها إيه وانت قاعدة فيها؟ (لحد 160 حرف)"}
              className="w-full border border-ink bg-bg p-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-[10px] opacity-60 text-ink">
              فاّضي {TEXT_MAX_CHARS - cleanedText.length} — اللينكات بتتمسح أوتوماتيك.
            </p>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={sealed}
              onChange={(e) => setSealed(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            ✉ للي بعدك بس (ظرف مختوم)
          </label>
        </>
      ) : mode === "DOODLE" ? (
        <div className="mt-3">
          <PixelCanvas onChange={setDoodleData} />
        </div>
      ) : mode === "SONG" ? (
        <CassetteInput value={trackUrl} onChange={setTrackUrl} />
      ) : passLoading || !passChecked ? (
        <p className="mt-3 text-sm text-ink opacity-70" aria-live="polite">
          بندور على رسمة نصّية مستنّية على الترابيزة دي…
        </p>
      ) : passMode === "continue" && passPending ? (
        <div className="mt-3">
          <p className="text-sm font-bold text-accent">
            حد بدأ رسمة هنا — كمّلها!
          </p>
          <PassDoodleCanvas
            mode="continue"
            parentDoodleData={passPending.doodleData}
            onChange={setPassMerged}
          />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink opacity-80">
            ابدأ باص-رسمة (ارسم النص اللي فوق — اللي بعدك يكمّله)
          </p>
          <PassDoodleCanvas mode="start" onChange={setPassTopHalf} />
        </div>
      )}

      <label className="mt-3 block text-xs opacity-70 text-ink">
        الاسم (اختياري)
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value.slice(0, ALIAS_MAX_CHARS))}
          maxLength={ALIAS_MAX_CHARS}
          placeholder="مثلاً: طالب عمارة مصدوم"
          className="mt-1 w-full border border-ink bg-bg p-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {error ? (
        <p className="mt-2 text-xs font-bold text-accent" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={
          canSubmit
            ? "mt-3 w-full border border-accent bg-accent p-2.5 text-sm font-bold text-bg"
            : "mt-3 w-full border border-ink p-2.5 text-sm opacity-40 text-ink"
        }
      >
        {submitting
          ? "بيثبّت…"
          : mode === "PASS" && passMode === "continue"
            ? "كمّل الرسمة"
            : mode === "PASS"
              ? "ثبّت نصّي"
              : sealed
                ? "ختمها للي بعدك"
                : "ثبّت على الترابيزة"}
      </button>

      {/* P1 micro-reviews: badge ratings ride along with the token but never
          consume it (own verification, see app/api/desks/[id]/badges). */}
      <BadgePicker deskId={deskId} signingToken={signingToken} />
    </section>
  );
}
