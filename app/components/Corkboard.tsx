import type { CapsuleFeedItem } from "@/lib/feed";
import CapsuleCard from "./CapsuleCard";

export default function Corkboard({
  capsules,
  sealedPendingCount,
}: {
  capsules: CapsuleFeedItem[];
  sealedPendingCount: number;
}) {
  if (capsules.length === 0) {
    return (
      <section
        aria-label="لوحة الفلين بتاعة المكتب"
        className="flex flex-col items-center justify-center px-6 py-10 text-center"
        style={{
          border: "1px dashed var(--grid-line)",
          borderRadius: "var(--radius-lg)",
          background: "var(--paper)",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "var(--text-3xl)" }}>
          📌
        </span>
        <p
          className="mt-2"
          style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}
        >
          مفيش أثر هنا لسه. كن أول واحد سيب حاجة.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="لوحة الفلين بتاعة المكتب">
      <div
        className="mb-3 flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--ink-muted)" }}
      >
        <span aria-hidden="true">💌</span>
        <span>آخر رسالة من اللي قعد قبلك</span>
      </div>
      {sealedPendingCount > 0 && (
        <p
          className="mb-4 px-4 py-3"
          style={{
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
          }}
        >
          ✉ مظروف مختوم مستني اللي بعدك
        </p>
      )}
      <ul className="columns-1 gap-4 sm:columns-2">
        {capsules.map((capsule, index) => (
          <li key={capsule.id} className="mb-4 break-inside-avoid">
            <CapsuleCard capsule={capsule} featured={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}
